
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/connection.js';
import type { UserRole } from '../middlewares/authMiddleware.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not configured in the .env file');
}

const validRoles: UserRole[] = ['admin', 'user', 'provider'];

// Registrar un usuario o crear una cuenta desde el panel administrativo.
export const registerUser = async (req: Request, res: Response) => {
  const { username, password } = req.body ?? {};

  const role: UserRole =
    req.user?.rol === 'admin' && validRoles.includes(req.body?.role)
      ? req.body.role
      : 'user';

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username.trim().length < 1 ||
    username.trim().length > 50 ||
    password.length < 8 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    return res.status(400).json({
      error:
        'El usuario debe tener entre 1 y 50 caracteres y la contraseña al menos 8 caracteres, con un máximo de 72 bytes.',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await client.query(
      `INSERT INTO usuarios (username, password, rol)
       VALUES ($1, $2, $3)
       RETURNING id, username, rol AS role, saldo`,
      [username.trim(), passwordHash, role],
    );

    const newUser = result.rows[0];

    // Administradores y proveedores tienen su propio perfil comercial.
    if (role === 'admin' || role === 'provider') {
      await client.query(
        `INSERT INTO proveedores (usuario_id)
         VALUES ($1)
         ON CONFLICT (usuario_id) DO NOTHING`,
        [newUser.id],
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Usuario registrado correctamente.',
      user: newUser,
    });
  } catch (error: unknown) {
    await client.query('ROLLBACK');

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      return res.status(409).json({
        error: 'Ese nombre de usuario ya existe.',
      });
    }

    console.error('Error registering user:', error);

    return res.status(500).json({
      error: 'No se pudo registrar el usuario.',
    });
  } finally {
    client.release();
  }
};

// Iniciar sesión.
export const loginUser = async (req: Request, res: Response) => {
  const { username, password } = req.body ?? {};

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !username.trim() ||
    !password
  ) {
    return res.status(400).json({
      error: 'Ingresa un nombre de usuario y una contraseña válidos.',
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, username, password, rol, saldo
       FROM usuarios
       WHERE username = $1`,
      [username.trim()],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Usuario o contraseña incorrectos.',
      });
    }

    const user = result.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password);

    if (!passwordValid) {
      return res.status(401).json({
        error: 'Usuario o contraseña incorrectos.',
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        rol: user.rol,
      },
      JWT_SECRET!,
      { expiresIn: '1h' },
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.rol,
        saldo: user.saldo,
      },
    });
  } catch (error) {
    console.error('Error logging in:', error);

    return res.status(500).json({
      error: 'Error interno del servidor.',
    });
  }
};

// Obtener todos los usuarios.
export const listUsers = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, username, rol AS role, saldo
       FROM usuarios
       ORDER BY id`,
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Error listing users:', error);

    return res.status(500).json({
      error: 'No se pudieron obtener los usuarios.',
    });
  }
};

// Eliminar un usuario.
export const deleteUser = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      error: 'El ID del usuario no es válido.',
    });
  }

  if (req.user?.id === id) {
    return res.status(403).json({
      error: 'No puedes eliminar tu propia cuenta.',
    });
  }

  try {
    const result = await pool.query(
      'DELETE FROM usuarios WHERE id = $1 RETURNING id',
      [id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado.',
      });
    }

    return res.json({
      message: 'Usuario eliminado correctamente.',
    });
  } catch (error) {
    console.error('Error deleting user:', error);

    return res.status(409).json({
      error:
        'No se pudo eliminar el usuario. Puede tener perfiles, pedidos u otros registros asociados.',
    });
  }
};

// Cambiar la contraseña del usuario autenticado.
export const changePassword = async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body ?? {};
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      error: 'Debes iniciar sesión.',
    });
  }

  if (
    typeof currentPassword !== 'string' ||
    typeof newPassword !== 'string' ||
    currentPassword.length === 0 ||
    newPassword.length < 8 ||
    Buffer.byteLength(newPassword, 'utf8') > 72
  ) {
    return res.status(400).json({
      error:
        'La nueva contraseña debe tener al menos 8 caracteres y no superar los 72 bytes.',
    });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({
      error: 'La nueva contraseña debe ser diferente de la actual.',
    });
  }

  try {
    const result = await pool.query(
      'SELECT password FROM usuarios WHERE id = $1',
      [userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado.',
      });
    }

    const valid = await bcrypt.compare(
      currentPassword,
      result.rows[0].password,
    );

    if (!valid) {
      return res.status(400).json({
        error: 'La contraseña actual es incorrecta.',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE usuarios SET password = $1 WHERE id = $2',
      [passwordHash, userId],
    );

    return res.json({
      message: 'Contraseña actualizada correctamente.',
    });
  } catch (error) {
    console.error('Error changing password:', error);

    return res.status(500).json({
      error: 'No se pudo actualizar la contraseña.',
    });
  }
};

// Cambiar el rol de un usuario.
export const changeUserRole = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { role } = req.body ?? {};

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      error: 'El ID del usuario no es válido.',
    });
  }

  if (typeof role !== 'string' || !validRoles.includes(role as UserRole)) {
    return res.status(400).json({
      error: 'El rol debe ser admin, user o provider.',
    });
  }

  if (req.user?.id === id) {
    return res.status(403).json({
      error: 'No puedes cambiar tu propio rol.',
    });
  }

  const newRole = role as UserRole;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const target = await client.query(
      `SELECT id, username, rol
       FROM usuarios
       WHERE id = $1
       FOR UPDATE`,
      [id],
    );

    if (target.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        error: 'Usuario no encontrado.',
      });
    }

    const targetUser = target.rows[0];

    if (targetUser.rol === 'admin' && newRole !== 'admin') {
      const admins = await client.query(
        `SELECT COUNT(*)::int AS total
         FROM usuarios
         WHERE rol = 'admin'`,
      );

      if (admins.rows[0].total <= 1) {
        await client.query('ROLLBACK');

        return res.status(409).json({
          error: 'No se puede quitar el rol al único administrador.',
        });
      }
    }

    const result = await client.query(
      `UPDATE usuarios
       SET rol = $1
       WHERE id = $2
       RETURNING id, username, rol AS role, saldo`,
      [newRole, id],
    );

    // Crear el perfil comercial si el nuevo rol lo necesita.
    if (newRole === 'admin' || newRole === 'provider') {
      await client.query(
        `INSERT INTO proveedores (usuario_id)
         VALUES ($1)
         ON CONFLICT (usuario_id) DO NOTHING`,
        [id],
      );
    }

    // Conservar solamente las excepciones compatibles con el nuevo rol.
    const rolePermissionKeys: Record<UserRole, string[]> = {
      admin: [
        'users.view',
        'users.create',
        'users.edit',
        'users.delete',
        'users.role.change',
        'permissions.manage',
        'products.view',
        'products.publish',
        'products.edit',
        'products.deactivate',
        'orders.view',
      ],
      user: [
        'products.view',
        'cart.manage',
        'orders.create',
        'orders.view',
      ],
      provider: [
        'products.view',
        'products.publish',
        'products.edit',
        'products.deactivate',
        'provider.profile.manage',
        'orders.view',
      ],
    };

    await client.query(
      `DELETE FROM user_permission_overrides
       WHERE user_id = $1
         AND NOT (permission_key = ANY($2::text[]))`,
      [id, rolePermissionKeys[newRole]],
    );

    await client.query('COMMIT');

    return res.json({
      message: 'Rol actualizado correctamente.',
      user: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Error changing user role:', error);

    return res.status(500).json({
      error: 'No se pudo actualizar el rol.',
    });
  } finally {
    client.release();
  }
};
