
import { Request, Response } from 'express';
import pool from '../db/connection.js';

export const listAdminProviders = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.usuario_id, p.nombre_proveedor, p.nit,
              p.nombre_empresa, p.contacto,
              p.telefono, p.telefono_2, p.correo, p.direccion, p.creado_en,
              u.username
       FROM proveedores p
       LEFT JOIN usuarios u ON u.id = p.usuario_id
       WHERE u.id IS NULL OR u.rol = 'provider'
       ORDER BY p.creado_en DESC`,
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Error listing provider profiles:', error);
    return res.status(500).json({
      error: 'No se pudieron obtener los proveedores.',
    });
  }
};

export const createAdminProvider = async (req: Request, res: Response) => {
  const {
    nombre_proveedor,
    correo,
    nit,
    nombre_empresa,
    contacto,
    telefono,
    telefono_2,
    direccion,
  } = req.body ?? {};

  const cleanProviderName =
    typeof nombre_proveedor === 'string' ? nombre_proveedor.trim() : '';
  const cleanEmail = typeof correo === 'string' ? correo.trim().toLowerCase() : '';
  const cleanNit = typeof nit === 'string' ? nit.trim() : '';
  const cleanCompany =
    typeof nombre_empresa === 'string' ? nombre_empresa.trim() : '';
  const cleanContact = typeof contacto === 'string' ? contacto.trim() : '';
  const cleanPhone = typeof telefono === 'string' ? telefono.trim() : '';
  const cleanPhone2 = typeof telefono_2 === 'string' ? telefono_2.trim() : '';
  const cleanAddress = typeof direccion === 'string' ? direccion.trim() : '';

  if (
    cleanProviderName.length < 2 ||
    cleanProviderName.length > 120 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
    cleanEmail.length > 150 ||
    cleanNit.length < 1 ||
    cleanNit.length > 30 ||
    cleanCompany.length < 2 ||
    cleanCompany.length > 120 ||
    cleanContact.length < 1 ||
    cleanContact.length > 120 ||
    cleanPhone.length < 1 ||
    cleanPhone.length > 30 ||
    cleanPhone2.length > 30 ||
    cleanAddress.length < 1 ||
    cleanAddress.length > 500
  ) {
    return res.status(400).json({
      error: 'Revisá el nombre, el correo y los campos obligatorios de la ficha del proveedor.',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const providerResult = await client.query(
      `INSERT INTO proveedores
         (nombre_proveedor, nit, nombre_empresa, contacto, telefono, telefono_2,
          correo, direccion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, usuario_id, nombre_proveedor, nit, nombre_empresa, contacto, telefono,
                 telefono_2, correo, direccion, creado_en`,
      [
        cleanProviderName,
        cleanNit,
        cleanCompany,
        cleanContact,
        cleanPhone,
        cleanPhone2 || null,
        cleanEmail,
        cleanAddress,
      ],
    );

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Ficha de proveedor creada correctamente.',
      provider: providerResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      const constraint =
        'constraint' in error && typeof error.constraint === 'string'
          ? error.constraint
          : '';
      return res.status(409).json({
        error: constraint.includes('nit')
          ? 'Ese NIT ya está registrado.'
          : constraint.includes('correo')
            ? 'Ese correo electrónico ya está registrado.'
            : 'Ya existe un proveedor con esos datos únicos.',
      });
    }

    console.error('Error creating provider profile:', error);
    return res.status(500).json({
      error: 'No se pudo crear la ficha del proveedor.',
    });
  } finally {
    client.release();
  }
};

export const updateAdminProvider = async (req: Request, res: Response) => {
  const providerId = Number(req.params.id);
  if (!Number.isInteger(providerId) || providerId <= 0) {
    return res.status(400).json({ error: 'ID de proveedor inválido.' });
  }

  const {
    nombre_proveedor,
    correo,
    nit,
    nombre_empresa,
    contacto,
    telefono,
    telefono_2,
    direccion,
  } = req.body ?? {};

  const cleanProviderName =
    typeof nombre_proveedor === 'string' ? nombre_proveedor.trim() : '';
  const cleanEmail = typeof correo === 'string' ? correo.trim().toLowerCase() : '';
  const cleanNit = typeof nit === 'string' ? nit.trim() : '';
  const cleanCompany =
    typeof nombre_empresa === 'string' ? nombre_empresa.trim() : '';
  const cleanContact = typeof contacto === 'string' ? contacto.trim() : '';
  const cleanPhone = typeof telefono === 'string' ? telefono.trim() : '';
  const cleanPhone2 = typeof telefono_2 === 'string' ? telefono_2.trim() : '';
  const cleanAddress = typeof direccion === 'string' ? direccion.trim() : '';

  if (
    cleanProviderName.length < 2 ||
    cleanProviderName.length > 120 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
    cleanEmail.length > 150 ||
    cleanNit.length < 1 ||
    cleanNit.length > 30 ||
    cleanCompany.length < 2 ||
    cleanCompany.length > 120 ||
    cleanContact.length < 1 ||
    cleanContact.length > 120 ||
    cleanPhone.length < 1 ||
    cleanPhone.length > 30 ||
    cleanPhone2.length > 30 ||
    cleanAddress.length < 1 ||
    cleanAddress.length > 500
  ) {
    return res.status(400).json({
      error: 'Revisá el nombre, el correo y los campos obligatorios de la ficha del proveedor.',
    });
  }

  try {
    const result = await pool.query(
      `UPDATE proveedores p
       SET nombre_proveedor = $1,
           nit = $2,
           nombre_empresa = $3,
           contacto = $4,
           telefono = $5,
           telefono_2 = $6,
           correo = $7,
           direccion = $8
       WHERE p.id = $9
         AND (
           p.usuario_id IS NULL OR EXISTS (
             SELECT 1 FROM usuarios u
             WHERE u.id = p.usuario_id AND u.rol = 'provider'
           )
         )
       RETURNING p.id, p.usuario_id, p.nombre_proveedor, p.nit,
                 p.nombre_empresa, p.contacto, p.telefono, p.telefono_2,
                 p.correo, p.direccion, p.creado_en`,
      [
        cleanProviderName,
        cleanNit,
        cleanCompany,
        cleanContact,
        cleanPhone,
        cleanPhone2 || null,
        cleanEmail,
        cleanAddress,
        providerId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró la ficha del proveedor.' });
    }

    return res.json({
      message: 'Ficha de proveedor actualizada correctamente.',
      provider: result.rows[0],
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      return res.status(409).json({ error: 'Ese NIT ya está registrado.' });
    }

    console.error('Error updating provider profile:', error);
    return res.status(500).json({
      error: 'No se pudo actualizar la ficha del proveedor.',
    });
  }
};

export const deleteAdminProvider = async (req: Request, res: Response) => {
  const providerId = Number(req.params.id);
  if (!Number.isInteger(providerId) || providerId <= 0) {
    return res.status(400).json({ error: 'ID de proveedor inválido.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const provider = await client.query(
      `SELECT p.id
       FROM proveedores p
       WHERE p.id = $1
         AND (
           p.usuario_id IS NULL OR EXISTS (
             SELECT 1 FROM usuarios u
             WHERE u.id = p.usuario_id AND u.rol = 'provider'
           )
         )
       FOR UPDATE`,
      [providerId],
    );

    if (provider.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No se encontró la ficha del proveedor.' });
    }

    const products = await client.query(
      'SELECT COUNT(*)::int AS total FROM productos WHERE proveedor_id = $1',
      [providerId],
    );
    const productCount = Number(products.rows[0].total);

    if (productCount > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `No se puede eliminar este proveedor porque tiene ${productCount} producto(s) asociado(s). Reasigná o eliminá esos productos primero.`,
      });
    }

    await client.query('DELETE FROM proveedores WHERE id = $1', [providerId]);
    await client.query('COMMIT');

    return res.json({ message: 'Ficha de proveedor eliminada correctamente.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting provider profile:', error);
    return res.status(500).json({
      error: 'No se pudo eliminar la ficha del proveedor.',
    });
  } finally {
    client.release();
  }
};

export const getProviderProfile = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, usuario_id, nit, nombre_empresa, descripcion, contacto,
              telefono, telefono_2, correo, direccion, creado_en
       FROM proveedores
       WHERE usuario_id = $1`,
      [req.user!.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Todavía no has creado tu perfil de proveedor.',
      });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Error retrieving provider profile:', error);
    return res.status(500).json({ error: 'No se pudo obtener el perfil.' });
  }
};

export const saveProviderProfile = async (req: Request, res: Response) => {
  const {
    nombre_empresa,
    descripcion,
    telefono,
    telefono_2,
    correo,
    direccion,
    nit,
    contacto,
  } = req.body;

  if (
    typeof nombre_empresa !== 'string' ||
    nombre_empresa.trim().length < 2 ||
    nombre_empresa.trim().length > 120
  ) {
    return res.status(400).json({
      error: 'El nombre de la empresa debe tener entre 2 y 120 caracteres.',
    });
  }

  const optionalText = (value: unknown, max: number): string | null => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || value.length > max) {
      throw new Error('INVALID_PROFILE_FIELD');
    }
    return value.trim();
  };

  try {
    const description = optionalText(descripcion, 5000);
    const phone = optionalText(telefono, 30);
    const email = optionalText(correo, 150);
    const address = optionalText(direccion, 500);
    const cleanNit = optionalText(nit, 30);
    const cleanContact = optionalText(contacto, 120);
    const phone2 = optionalText(telefono_2, 30);

    const result = await pool.query(
      `INSERT INTO proveedores
         (usuario_id, nit, nombre_empresa, descripcion, contacto, telefono,
          telefono_2, correo, direccion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (usuario_id)
       DO UPDATE SET
         nit = COALESCE(EXCLUDED.nit, proveedores.nit),
         nombre_empresa = EXCLUDED.nombre_empresa,
         descripcion = EXCLUDED.descripcion,
         contacto = COALESCE(EXCLUDED.contacto, proveedores.contacto),
         telefono = EXCLUDED.telefono,
         telefono_2 = COALESCE(EXCLUDED.telefono_2, proveedores.telefono_2),
         correo = EXCLUDED.correo,
         direccion = EXCLUDED.direccion
       RETURNING id, usuario_id, nit, nombre_empresa, descripcion, contacto,
                 telefono, telefono_2, correo, direccion, creado_en`,
      [
        req.user!.id,
        cleanNit,
        nombre_empresa.trim(),
        description,
        cleanContact,
        phone,
        phone2,
        email,
        address,
      ],
    );

    return res.json({
      message: 'Perfil de proveedor guardado correctamente.',
      profile: result.rows[0],
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PROFILE_FIELD') {
      return res.status(400).json({
        error: 'Uno de los campos del perfil tiene un formato o longitud inválidos.',
      });
    }

    console.error('Error saving provider profile:', error);
    return res.status(500).json({ error: 'No se pudo guardar el perfil.' });
  }
};
