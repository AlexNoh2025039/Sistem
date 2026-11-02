
import type { Request, Response } from 'express';
import { unlink } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from '../db/connection.js';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const uploadDirectory = resolve(currentDirectory, '../../uploads');

async function removeUploadedPhoto(photoPath: unknown): Promise<void> {
  if (typeof photoPath !== 'string') return;

  const filename = photoPath.startsWith('/uploads/')
    ? photoPath.slice('/uploads/'.length)
    : '';

  if (!filename || basename(filename) !== filename) return;

  try {
    await unlink(resolve(uploadDirectory, filename));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code !== 'ENOENT') {
      console.error('No se pudo eliminar la foto:', error);
    }
  }
}

export const getProfile = async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      error: 'Debes iniciar sesión.',
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         id,
         username,
         correo,
         rol AS role,
         foto_perfil AS "photoUrl"
       FROM usuarios
       WHERE id = $1`,
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado.',
      });
    }

    return res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error consultando perfil:', error);

    return res.status(500).json({
      error: 'No se pudo consultar el perfil.',
    });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      error: 'Debes iniciar sesión.',
    });
  }

  const { username, correo } = req.body;

  if (
    typeof username !== 'string' ||
    typeof correo !== 'string' ||
    !username.trim() ||
    !correo.trim()
  ) {
    return res.status(400).json({
      error: 'El nombre de usuario y el correo son obligatorios.',
    });
  }

  const cleanUsername = username.trim();
  const cleanCorreo = correo.trim().toLowerCase();

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(cleanCorreo)) {
    return res.status(400).json({
      error: 'Ingresa un correo electrónico válido.',
    });
  }

  try {
    const existingUser = await pool.query(
      `SELECT username, correo
       FROM usuarios
       WHERE (
         LOWER(username) = LOWER($1)
         OR LOWER(correo) = LOWER($2)
       )
       AND id <> $3`,
      [cleanUsername, cleanCorreo, userId],
    );

    const usernameExists = existingUser.rows.some(
      (user) =>
        user.username.toLowerCase() === cleanUsername.toLowerCase(),
    );

    const emailExists = existingUser.rows.some(
      (user) => user.correo.toLowerCase() === cleanCorreo,
    );

    if (usernameExists) {
      return res.status(409).json({
        error: 'Ese nombre de usuario ya está en uso.',
      });
    }

    if (emailExists) {
      return res.status(409).json({
        error: 'Ese correo electrónico ya está registrado.',
      });
    }

    const result = await pool.query(
      `UPDATE usuarios
       SET username = $1,
           correo = $2
       WHERE id = $3
       RETURNING
         id,
         username,
         correo,
         rol AS role,
         foto_perfil AS "photoUrl"`,
      [cleanUsername, cleanCorreo, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado.',
      });
    }

    return res.json({
      message: 'Perfil actualizado correctamente.',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('Error actualizando perfil:', error);

    return res.status(500).json({
      error: 'No se pudo actualizar el perfil.',
    });
  }
};

export const saveProfilePhoto = async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    if (req.file) {
      await removeUploadedPhoto(`/uploads/${req.file.filename}`);
    }

    return res.status(401).json({
      error: 'Debes iniciar sesión.',
    });
  }

  if (!req.file) {
    return res.status(400).json({
      error: 'Selecciona una imagen JPG, PNG o WebP.',
    });
  }

  const photoPath = `/uploads/${req.file.filename}`;

  let client;

  try {
    client = await pool.connect();

    await client.query('BEGIN');

    const current = await client.query(
      `SELECT foto_perfil
       FROM usuarios
       WHERE id = $1
       FOR UPDATE`,
      [userId],
    );

    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      await removeUploadedPhoto(photoPath);

      return res.status(404).json({
        error: 'Usuario no encontrado.',
      });
    }

    const previousPhoto: string | null = current.rows[0].foto_perfil;

    const result = await client.query(
      `UPDATE usuarios
       SET foto_perfil = $1
       WHERE id = $2
       RETURNING foto_perfil AS "photoUrl"`,
      [photoPath, userId],
    );

    await client.query('COMMIT');

    if (previousPhoto && previousPhoto !== photoPath) {
      await removeUploadedPhoto(previousPhoto);
    }

    return res.json({
      message: 'Foto de perfil actualizada correctamente.',
      photoUrl: result.rows[0].photoUrl,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error revirtiendo la transacción:', rollbackError);
      }
    }

    console.error('Error guardando foto de perfil:', error);

    await removeUploadedPhoto(photoPath);

    return res.status(500).json({
      error: 'No se pudo guardar la foto de perfil.',
    });
  } finally {
    client?.release();
  }
};
