
import { Request, Response } from 'express';
import pool from '../db/connection.js';

export const getProviderProfile = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, usuario_id, nombre_empresa, descripcion,
              telefono, correo, direccion, creado_en
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
    correo,
    direccion,
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

    const result = await pool.query(
      `INSERT INTO proveedores
         (usuario_id, nombre_empresa, descripcion, telefono, correo, direccion)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (usuario_id)
       DO UPDATE SET
         nombre_empresa = EXCLUDED.nombre_empresa,
         descripcion = EXCLUDED.descripcion,
         telefono = EXCLUDED.telefono,
         correo = EXCLUDED.correo,
         direccion = EXCLUDED.direccion
       RETURNING id, usuario_id, nombre_empresa, descripcion,
                 telefono, correo, direccion, creado_en`,
      [
        req.user!.id,
        nombre_empresa.trim(),
        description,
        phone,
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
