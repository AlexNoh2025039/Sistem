
import { Request, Response } from 'express';
import pool from '../db/connection.js';

export const getCart = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT ci.producto_id, ci.cantidad,
              p.nombre, p.precio, p.existencias, p.imagen_url,
              (p.precio * ci.cantidad) AS subtotal
       FROM carritos c
       JOIN carrito_items ci ON ci.carrito_id = c.id
       JOIN productos p ON p.id = ci.producto_id
       WHERE c.usuario_id = $1
       ORDER BY ci.id`,
      [req.user!.id],
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Error retrieving cart:', error);
    return res.status(500).json({ error: 'No se pudo obtener el carrito.' });
  }
};

export const addCartItem = async (req: Request, res: Response) => {
  const productId = Number(req.body.producto_id);
  const quantity = Number(req.body.cantidad);

  if (
    !Number.isInteger(productId) ||
    productId <= 0 ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return res.status(400).json({
      error: 'El producto y la cantidad deben ser válidos.',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const product = await client.query(
      `SELECT id, existencias FROM productos
       WHERE id = $1 AND activo = TRUE
       FOR UPDATE`,
      [productId],
    );

    if (product.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Producto no disponible.' });
    }

    const cartResult = await client.query(
      `INSERT INTO carritos (usuario_id)
       VALUES ($1)
       ON CONFLICT (usuario_id)
       DO UPDATE SET usuario_id = EXCLUDED.usuario_id
       RETURNING id`,
      [req.user!.id],
    );

    const cartId = cartResult.rows[0].id;

    const itemResult = await client.query(
      `INSERT INTO carrito_items (carrito_id, producto_id, cantidad)
       VALUES ($1, $2, $3)
       ON CONFLICT (carrito_id, producto_id)
       DO UPDATE SET cantidad = carrito_items.cantidad + EXCLUDED.cantidad
       RETURNING cantidad`,
      [cartId, productId, quantity],
    );

    if (itemResult.rows[0].cantidad > product.rows[0].existencias) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'La cantidad solicitada supera las existencias disponibles.',
      });
    }

    await client.query('COMMIT');

    return res.status(201).json({ message: 'Producto agregado al carrito.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adding cart item:', error);
    return res.status(500).json({ error: 'No se pudo agregar el producto.' });
  } finally {
    client.release();
  }
};

export const removeCartItem = async (req: Request, res: Response) => {
  const productId = Number(req.params.productId);

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: 'ID de producto inválido.' });
  }

  try {
    const result = await pool.query(
      `DELETE FROM carrito_items ci
       USING carritos c
       WHERE ci.carrito_id = c.id
         AND c.usuario_id = $1
         AND ci.producto_id = $2
       RETURNING ci.producto_id`,
      [req.user!.id, productId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Producto no encontrado en el carrito.' });
    }

    return res.json({ message: 'Producto eliminado del carrito.' });
  } catch (error) {
    console.error('Error removing cart item:', error);
    return res.status(500).json({ error: 'No se pudo eliminar el producto.' });
  }
};

export const checkout = async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const cartResult = await client.query(
      `SELECT c.id
       FROM carritos c
       WHERE c.usuario_id = $1
       FOR UPDATE`,
      [req.user!.id],
    );

    if (cartResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Tu carrito está vacío.' });
    }

    const cartId = cartResult.rows[0].id;

    const itemsResult = await client.query(
      `SELECT ci.producto_id, ci.cantidad,
              p.nombre, p.precio, p.existencias, p.activo
       FROM carrito_items ci
       JOIN productos p ON p.id = ci.producto_id
       WHERE ci.carrito_id = $1
       ORDER BY p.id
       FOR UPDATE OF p`,
      [cartId],
    );

    if (itemsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Tu carrito está vacío.' });
    }

    let totalCents = 0;

    for (const item of itemsResult.rows) {
      if (!item.activo || item.cantidad > item.existencias) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `No hay existencias suficientes para ${item.nombre}.`,
        });
      }

      const priceCents = Math.round(Number(item.precio) * 100);
      totalCents += priceCents * Number(item.cantidad);
    }

    const balanceResult = await client.query(
      'SELECT saldo FROM usuarios WHERE id = $1 FOR UPDATE',
      [req.user!.id],
    );

    if (balanceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    const balanceCents = Math.round(Number(balanceResult.rows[0].saldo) * 100);

    if (balanceCents < totalCents) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Saldo insuficiente.',
        total: (totalCents / 100).toFixed(2),
        saldo: (balanceCents / 100).toFixed(2),
      });
    }

    const orderResult = await client.query(
      `INSERT INTO pedidos (usuario_id, estado, total)
       VALUES ($1, 'confirmado', $2)
       RETURNING id, usuario_id, estado, total, creado_en`,
      [req.user!.id, (totalCents / 100).toFixed(2)],
    );

    const order = orderResult.rows[0];

    for (const item of itemsResult.rows) {
      const priceCents = Math.round(Number(item.precio) * 100);
      const subtotalCents = priceCents * Number(item.cantidad);

      await client.query(
        `INSERT INTO pedido_items
           (pedido_id, producto_id, nombre_producto,
            precio_unitario, cantidad, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          order.id,
          item.producto_id,
          item.nombre,
          (priceCents / 100).toFixed(2),
          item.cantidad,
          (subtotalCents / 100).toFixed(2),
        ],
      );

      await client.query(
        `UPDATE productos
         SET existencias = existencias - $1,
             actualizado_en = NOW()
         WHERE id = $2`,
        [item.cantidad, item.producto_id],
      );
    }

    await client.query(
      'UPDATE usuarios SET saldo = saldo - $1 WHERE id = $2',
      [(totalCents / 100).toFixed(2), req.user!.id],
    );

    await client.query(
      'DELETE FROM carrito_items WHERE carrito_id = $1',
      [cartId],
    );

    const newBalance = await client.query(
      'SELECT saldo FROM usuarios WHERE id = $1',
      [req.user!.id],
    );

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Compra confirmada correctamente.',
      order,
      saldo_restante: newBalance.rows[0].saldo,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error checking out:', error);
    return res.status(500).json({ error: 'No se pudo completar la compra.' });
  } finally {
    client.release();
  }
};

export const listMyOrders = async (req: Request, res: Response) => {
  try {
    const orders = await pool.query(
      `SELECT id, estado, total, creado_en
       FROM pedidos
       WHERE usuario_id = $1
       ORDER BY creado_en DESC`,
      [req.user!.id],
    );

    const result = await Promise.all(
      orders.rows.map(async (order) => {
        const items = await pool.query(
          `SELECT nombre_producto, precio_unitario, cantidad, subtotal
           FROM pedido_items
           WHERE pedido_id = $1
           ORDER BY id`,
          [order.id],
        );

        return { ...order, items: items.rows };
      }),
    );

    return res.json(result);
  } catch (error) {
    console.error('Error listing orders:', error);
    return res.status(500).json({ error: 'No se pudieron obtener los pedidos.' });
  }
};
