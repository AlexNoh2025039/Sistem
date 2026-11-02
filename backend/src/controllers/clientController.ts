import type { Request, Response } from 'express';
import pool from '../db/connection.js';

export const listAdminClients = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, nombre, correo, telefono, direccion, descripcion,
              forma_pago, creado_en
       FROM clientes
       ORDER BY creado_en DESC`,
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Error listing client records:', error);
    return res.status(500).json({
      error: 'No se pudieron obtener las fichas de cliente.',
    });
  }
};

export const createAdminClient = async (req: Request, res: Response) => {
  const { nombre, correo, telefono, direccion, descripcion, forma_pago } =
    req.body ?? {};
  const cleanName = typeof nombre === 'string' ? nombre.trim() : '';
  const cleanEmail = typeof correo === 'string' ? correo.trim().toLowerCase() : '';
  const cleanPhone = typeof telefono === 'string' ? telefono.trim() : '';
  const cleanAddress =
    typeof direccion === 'string' ? direccion.trim() : '';
  const cleanDescription =
    typeof descripcion === 'string' ? descripcion.trim() : '';
  const cleanPaymentMethod =
    typeof forma_pago === 'string' ? forma_pago.trim() : '';

  if (
    cleanName.length < 1 ||
    cleanName.length > 150 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
    cleanEmail.length > 150 ||
    cleanPhone.length < 1 ||
    cleanPhone.length > 30 ||
    cleanAddress.length > 500 ||
    cleanDescription.length > 2000 ||
    cleanPaymentMethod.length > 100
  ) {
    return res.status(400).json({
      error: 'Ingresá un nombre, un correo válido y un teléfono.',
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO clientes
         (nombre, correo, telefono, direccion, descripcion, forma_pago)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre, correo, telefono, direccion, descripcion,
                 forma_pago, creado_en`,
      [
        cleanName,
        cleanEmail,
        cleanPhone,
        cleanAddress || null,
        cleanDescription || null,
        cleanPaymentMethod || null,
      ],
    );

    return res.status(201).json({
      message: 'Ficha de cliente creada correctamente.',
      client: result.rows[0],
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      return res.status(409).json({
        error: 'Ya existe una ficha de cliente con ese correo electrónico.',
      });
    }

    console.error('Error creating client record:', error);
    return res.status(500).json({
      error: 'No se pudo crear la ficha del cliente.',
    });
  }
};

export const updateAdminClient = async (req: Request, res: Response) => {
  const clientId = Number(req.params.id);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return res.status(400).json({ error: 'ID de cliente inválido.' });
  }

  const { nombre, correo, telefono, direccion, descripcion, forma_pago } =
    req.body ?? {};
  const cleanName = typeof nombre === 'string' ? nombre.trim() : '';
  const cleanEmail = typeof correo === 'string' ? correo.trim().toLowerCase() : '';
  const cleanPhone = typeof telefono === 'string' ? telefono.trim() : '';
  const cleanAddress = typeof direccion === 'string' ? direccion.trim() : '';
  const cleanDescription =
    typeof descripcion === 'string' ? descripcion.trim() : '';
  const cleanPaymentMethod =
    typeof forma_pago === 'string' ? forma_pago.trim() : '';

  if (
    cleanName.length < 1 ||
    cleanName.length > 150 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
    cleanEmail.length > 150 ||
    cleanPhone.length < 1 ||
    cleanPhone.length > 30 ||
    cleanAddress.length > 500 ||
    cleanDescription.length > 2000 ||
    cleanPaymentMethod.length > 100
  ) {
    return res.status(400).json({
      error: 'Ingresá un nombre, un correo válido y un teléfono.',
    });
  }

  try {
    const result = await pool.query(
      `UPDATE clientes
       SET nombre = $1,
           correo = $2,
           telefono = $3,
           direccion = $4,
           descripcion = $5,
           forma_pago = $6
       WHERE id = $7
       RETURNING id, nombre, correo, telefono, direccion, descripcion,
                 forma_pago, creado_en`,
      [
        cleanName,
        cleanEmail,
        cleanPhone,
        cleanAddress || null,
        cleanDescription || null,
        cleanPaymentMethod || null,
        clientId,
      ],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: 'No se encontró la ficha del cliente.' });
    }

    return res.json({
      message: 'Ficha de cliente actualizada correctamente.',
      client: result.rows[0],
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      return res.status(409).json({
        error: 'Ya existe otra ficha de cliente con ese correo electrónico.',
      });
    }

    console.error('Error updating client record:', error);
    return res.status(500).json({
      error: 'No se pudo actualizar la ficha del cliente.',
    });
  }
};

export const deleteAdminClient = async (req: Request, res: Response) => {
  const clientId = Number(req.params.id);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return res.status(400).json({ error: 'ID de cliente inválido.' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM clientes WHERE id = $1 RETURNING id',
      [clientId],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: 'No se encontró la ficha del cliente.' });
    }

    return res.json({ message: 'Ficha de cliente eliminada correctamente.' });
  } catch (error) {
    console.error('Error deleting client record:', error);
    return res.status(500).json({
      error: 'No se pudo eliminar la ficha del cliente.',
    });
  }
};
