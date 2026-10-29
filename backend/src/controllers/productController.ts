
import { Request, Response } from 'express';
import pool from '../db/connection.js';

const getProviderId = async (userId: number): Promise<number | null> => {
  const result = await pool.query(
    'SELECT id FROM proveedores WHERE usuario_id = $1',
    [userId],
  );

  return result.rows[0]?.id ?? null;
};

const getProductImage = (req: Request): string | null => {
  if (req.file) {
    return `/uploads/${req.file.filename}`;
  }

  return typeof req.body.imagen_url === 'string'
    ? req.body.imagen_url.trim() || null
    : null;
};

export const listProducts = async (req: Request, res: Response) => {
  const { categoria, search } = req.query;

  try {
    const result = await pool.query(
      `SELECT p.id, p.proveedor_id, p.nombre, p.descripcion,
              p.categoria, p.marca, p.modelo, p.precio,
              p.existencias, p.imagen_url, p.activo,
              pr.nombre_empresa
       FROM productos p
       JOIN proveedores pr ON pr.id = p.proveedor_id
       WHERE p.activo = TRUE
         AND p.existencias >= 0
         AND ($1::text IS NULL OR p.categoria = $1)
         AND (
           $2::text IS NULL OR
           p.nombre ILIKE '%' || $2 || '%' OR
           COALESCE(p.marca, '') ILIKE '%' || $2 || '%' OR
           COALESCE(p.modelo, '') ILIKE '%' || $2 || '%'
         )
       ORDER BY p.creado_en DESC`,
      [
        typeof categoria === 'string' ? categoria : null,
        typeof search === 'string' ? search.trim() : null,
      ],
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Error listing products:', error);
    return res.status(500).json({
      error: 'No se pudieron obtener los productos.',
    });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      error: 'ID de producto inválido.',
    });
  }

  try {
    const result = await pool.query(
      `SELECT p.id, p.proveedor_id, p.nombre, p.descripcion,
              p.categoria, p.marca, p.modelo, p.precio,
              p.existencias, p.imagen_url, p.activo,
              pr.nombre_empresa
       FROM productos p
       JOIN proveedores pr ON pr.id = p.proveedor_id
       WHERE p.id = $1 AND p.activo = TRUE`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado.',
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error retrieving product:', error);
    return res.status(500).json({
      error: 'No se pudo obtener el producto.',
    });
  }
};

export const listMyProducts = async (req: Request, res: Response) => {
  try {
    const providerId = await getProviderId(req.user!.id);

    if (!providerId) {
      return res.status(404).json({
        error: 'No se encontró el registro del proveedor.',
      });
    }

    const result = await pool.query(
      `SELECT p.id, p.proveedor_id, p.nombre, p.descripcion,
              p.categoria, p.marca, p.modelo, p.precio,
              p.existencias, p.imagen_url, p.activo,
              p.creado_en, p.actualizado_en
       FROM productos p
       WHERE p.proveedor_id = $1
       ORDER BY p.creado_en DESC`,
      [providerId],
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Error listing provider products:', error);
    return res.status(500).json({
      error: 'No se pudieron obtener tus productos.',
    });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  const {
    nombre,
    descripcion,
    categoria,
    marca,
    modelo,
    precio,
    existencias,
  } = req.body;

  const parsedPrice = Number(precio);
  const parsedStock = Number(existencias);

  if (
    typeof nombre !== 'string' ||
    nombre.trim().length < 1 ||
    nombre.trim().length > 150 ||
    !Number.isFinite(parsedPrice) ||
    parsedPrice < 0 ||
    !Number.isInteger(parsedStock) ||
    parsedStock < 0
  ) {
    return res.status(400).json({
      error: 'Nombre, precio o existencias inválidos.',
    });
  }

  try {
    const providerId = await getProviderId(req.user!.id);

    if (!providerId) {
      return res.status(409).json({
        error: 'No se encontró el registro del proveedor.',
      });
    }

    const imagenProducto = getProductImage(req);

    const result = await pool.query(
      `INSERT INTO productos
         (proveedor_id, nombre, descripcion, categoria, marca,
          modelo, precio, existencias, imagen_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        providerId,
        nombre.trim(),
        typeof descripcion === 'string' ? descripcion.trim() : null,
        typeof categoria === 'string' ? categoria.trim() : null,
        typeof marca === 'string' ? marca.trim() : null,
        typeof modelo === 'string' ? modelo.trim() : null,
        parsedPrice,
        parsedStock,
        imagenProducto,
      ],
    );

    return res.status(201).json({
      message: 'Producto creado correctamente.',
      product: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating product:', error);
    return res.status(500).json({
      error: 'No se pudo crear el producto.',
    });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  const {
    nombre,
    descripcion,
    categoria,
    marca,
    modelo,
    precio,
    existencias,
  } = req.body;

  const parsedPrice = Number(precio);
  const parsedStock = Number(existencias);

  if (
    !Number.isInteger(id) ||
    id <= 0 ||
    typeof nombre !== 'string' ||
    nombre.trim().length < 1 ||
    nombre.trim().length > 150 ||
    !Number.isFinite(parsedPrice) ||
    parsedPrice < 0 ||
    !Number.isInteger(parsedStock) ||
    parsedStock < 0
  ) {
    return res.status(400).json({
      error: 'Datos del producto inválidos.',
    });
  }

  try {
    const providerId = await getProviderId(req.user!.id);

    if (!providerId) {
      return res.status(409).json({
        error: 'Perfil de proveedor no encontrado.',
      });
    }

    const imagenProducto = getProductImage(req);

    const result = await pool.query(
      `UPDATE productos
       SET nombre = $1,
           descripcion = $2,
           categoria = $3,
           marca = $4,
           modelo = $5,
           precio = $6,
           existencias = $7,
           imagen_url = $8,
           actualizado_en = NOW()
       WHERE id = $9
         AND proveedor_id = $10
         AND activo = TRUE
       RETURNING *`,
      [
        nombre.trim(),
        typeof descripcion === 'string' ? descripcion.trim() : null,
        typeof categoria === 'string' ? categoria.trim() : null,
        typeof marca === 'string' ? marca.trim() : null,
        typeof modelo === 'string' ? modelo.trim() : null,
        parsedPrice,
        parsedStock,
        imagenProducto,
        id,
        providerId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado o no te pertenece.',
      });
    }

    return res.json({
      message: 'Producto actualizado correctamente.',
      product: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(500).json({
      error: 'No se pudo actualizar el producto.',
    });
  }
};

export const deactivateProduct = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      error: 'ID de producto inválido.',
    });
  }

  try {
    const providerId = await getProviderId(req.user!.id);

    if (!providerId) {
      return res.status(409).json({
        error: 'Perfil de proveedor no encontrado.',
      });
    }

    const result = await pool.query(
      `UPDATE productos
       SET activo = FALSE,
           actualizado_en = NOW()
       WHERE id = $1
         AND proveedor_id = $2
         AND activo = TRUE
       RETURNING id`,
      [id, providerId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Producto no encontrado o no te pertenece.',
      });
    }

    return res.json({
      message: 'Producto desactivado correctamente.',
    });
  } catch (error) {
    console.error('Error deactivating product:', error);
    return res.status(500).json({
      error: 'No se pudo desactivar el producto.',
    });
  }
};
