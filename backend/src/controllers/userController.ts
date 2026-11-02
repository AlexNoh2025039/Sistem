
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

const rolePermissionKeys: Record<UserRole, string[]> = {
  admin: [
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
    'users.role.change',
    'permissions.manage',
    'orders.view',
  ],
  user: [
    'cart.manage',
    'orders.create',
    'orders.view',
  ],
  provider: [
    'provider.profile.manage',
    'orders.view',
  ],
};

// Registrar un usuario o crear una cuenta desde el panel administrativo.
export const registerUser = async (req: Request, res: Response) => {
  const {
    username,
    correo,
    password,
    nombre_completo,
    telefono,
  } = req.body ?? {};

  const isAdminCreation = req.user?.rol === 'admin';

  const role: UserRole =
    isAdminCreation && validRoles.includes(req.body?.role)
      ? req.body.role
      : 'user';

  const cleanUsername =
    typeof username === 'string' ? username.trim() : '';

  const cleanEmail =
    typeof correo === 'string' ? correo.trim().toLowerCase() : '';
  const cleanFullName =
    typeof nombre_completo === 'string' ? nombre_completo.trim() : null;
  const cleanPhone = typeof telefono === 'string' ? telefono.trim() : null;

  if (
    !cleanUsername ||
    cleanUsername.length > 50 ||
    typeof password !== 'string' ||
    password.length < 8 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    return res.status(400).json({
      error:
        'El usuario debe tener entre 1 y 50 caracteres y la contraseña al menos 8 caracteres, con un máximo de 72 bytes.',
    });
  }

  if (
    (cleanFullName !== null && cleanFullName.length > 150) ||
    (cleanPhone !== null && cleanPhone.length > 30)
  ) {
    return res.status(400).json({
      error: 'El nombre de contacto o teléfono supera la longitud permitida.',
    });
  }

  if (
    !cleanEmail ||
    cleanEmail.length > 150 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
  ) {
    return res.status(400).json({
      error: 'Ingresa un correo electrónico válido.',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await client.query(
      `INSERT INTO usuarios
         (username, correo, password, rol, nombre_completo, telefono)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, correo, rol AS role, saldo,
                 nombre_completo, telefono`,
      [
        cleanUsername,
        cleanEmail,
        passwordHash,
        role,
        cleanFullName || null,
        cleanPhone || null,
      ],
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
      const constraint =
        'constraint' in error && typeof error.constraint === 'string'
          ? error.constraint
          : '';

      if (constraint.includes('correo')) {
        return res.status(409).json({
          error: 'Ese correo electrónico ya está registrado.',
        });
      }

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

// Iniciar sesión con nombre de usuario o correo electrónico.
export const loginUser = async (req: Request, res: Response) => {
  const { identifier, username, password } = req.body ?? {};

  // Se conserva username como alternativa para clientes anteriores.
  const loginIdentifier =
    typeof identifier === 'string'
      ? identifier.trim()
      : typeof username === 'string'
        ? username.trim()
        : '';

  if (!loginIdentifier || typeof password !== 'string' || !password) {
    return res.status(400).json({
      error: 'Ingresa tu correo o nombre de usuario y tu contraseña.',
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, username, password, rol, saldo
       FROM usuarios
       WHERE LOWER(username) = LOWER($1)
          OR LOWER(correo) = LOWER($1)
       ORDER BY CASE
         WHEN LOWER(username) = LOWER($1) THEN 0
         ELSE 1
       END
       LIMIT 1`,
      [loginIdentifier],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Usuario, correo o contraseña incorrectos.',
      });
    }

    const user = result.rows[0];
    const passwordValid = await bcrypt.compare(password, user.password);

    if (!passwordValid) {
      return res.status(401).json({
        error: 'Usuario, correo o contraseña incorrectos.',
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
      `SELECT id, username, correo, rol AS role, saldo,
              nombre_completo, telefono, direccion, forma_pago, descripcion
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
       RETURNING id, username, correo, rol AS role, saldo`,
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

export const updateManagedUser = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const {
    username,
    correo,
    nombre_completo,
    telefono,
    direccion,
    forma_pago,
    descripcion,
    password,
    role,
  } = req.body ?? {};
  const updatesUsername = username !== undefined;
  const updatesEmail = correo !== undefined;
  const updatesContactName = nombre_completo !== undefined;
  const updatesPhone = telefono !== undefined;
  const updatesAddress = direccion !== undefined;
  const updatesPaymentMethod = forma_pago !== undefined;
  const updatesDescription = descripcion !== undefined;
  const updatesPassword = password !== undefined;
  const updatesRole = role !== undefined;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      error: 'El ID del usuario no es válido.',
    });
  }

  if (
    updatesUsername &&
    (typeof username !== 'string' ||
      username.trim().length < 1 ||
      username.trim().length > 50)
  ) {
    return res.status(400).json({
      error: 'El nombre de usuario debe tener entre 1 y 50 caracteres.',
    });
  }

  if (
    updatesEmail &&
    (typeof correo !== 'string' ||
      correo.trim().length > 150 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim()))
  ) {
    return res.status(400).json({
      error: 'Ingresa un correo electrónico válido.',
    });
  }

  if (
    updatesContactName &&
    (typeof nombre_completo !== 'string' || nombre_completo.trim().length > 150)
  ) {
    return res.status(400).json({
      error: 'El nombre de contacto no puede superar los 150 caracteres.',
    });
  }

  if (
    updatesPhone &&
    (typeof telefono !== 'string' || telefono.trim().length > 30)
  ) {
    return res.status(400).json({
      error: 'El teléfono no puede superar los 30 caracteres.',
    });
  }

  if (
    updatesAddress &&
    (typeof direccion !== 'string' || direccion.trim().length > 500)
  ) {
    return res.status(400).json({
      error: 'La dirección no puede superar los 500 caracteres.',
    });
  }

  if (
    updatesPaymentMethod &&
    (typeof forma_pago !== 'string' || forma_pago.trim().length > 100)
  ) {
    return res.status(400).json({
      error: 'La forma de pago no puede superar los 100 caracteres.',
    });
  }

  if (
    updatesDescription &&
    (typeof descripcion !== 'string' || descripcion.trim().length > 2000)
  ) {
    return res.status(400).json({
      error: 'Los comentarios no pueden superar los 2000 caracteres.',
    });
  }

  if (
    password !== undefined &&
    (typeof password !== 'string' ||
      password.length < 8 ||
      Buffer.byteLength(password, 'utf8') > 72)
  ) {
    return res.status(400).json({
      error: 'La contraseña debe tener entre 8 caracteres y 72 bytes.',
    });
  }

  if (
    role !== undefined &&
    (typeof role !== 'string' ||
      !validRoles.includes(role as UserRole))
  ) {
    return res.status(400).json({
      error: 'El rol debe ser admin, user o provider.',
    });
  }

  if (
    !updatesUsername &&
    !updatesEmail &&
    !updatesContactName &&
    !updatesPhone &&
    !updatesAddress &&
    !updatesPaymentMethod &&
    !updatesDescription &&
    !updatesPassword &&
    !updatesRole
  ) {
    return res.status(400).json({
      error: 'Debes indicar al menos un dato para actualizar.',
    });
  }

  const client = await pool.connect();

  try {
    const passwordHash =
      typeof password === 'string' ? await bcrypt.hash(password, 10) : null;

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
    const newRole: UserRole =
      (role as UserRole | undefined) ?? (targetUser.rol as UserRole);

    if (
      updatesUsername ||
      updatesEmail ||
      updatesContactName ||
      updatesPhone ||
      updatesAddress ||
      updatesPaymentMethod ||
      updatesDescription ||
      updatesPassword
    ) {
      const permission = await client.query(
        `SELECT COALESCE(
           (SELECT allowed
            FROM user_permission_overrides
            WHERE user_id = $1 AND permission_key = $2),
           (SELECT allowed
            FROM role_permissions
            WHERE role = $3 AND permission_key = $2),
           FALSE
         ) AS allowed`,
        [req.user?.id, 'users.edit', req.user?.rol],
      );

      if (!permission.rows[0].allowed) {
        await client.query('ROLLBACK');

        return res.status(403).json({
          error: 'No tenés permiso para editar usuarios.',
          permission: 'users.edit',
        });
      }
    }

    if (role !== undefined && newRole !== targetUser.rol) {
      if (req.user?.id === id) {
        await client.query('ROLLBACK');

        return res.status(403).json({
          error: 'No puedes cambiar tu propio rol.',
        });
      }

      const permission = await client.query(
        `SELECT COALESCE(
           (SELECT allowed
            FROM user_permission_overrides
            WHERE user_id = $1
              AND permission_key IN ($2, $4)
              AND allowed = TRUE
            LIMIT 1),
           (SELECT allowed
            FROM role_permissions
            WHERE role = $3
              AND permission_key IN ($2, $4)
              AND allowed = TRUE
            LIMIT 1),
           FALSE
         ) AS allowed`,
        [
          req.user?.id,
          'users.role.change',
          req.user?.rol,
          'users.edit',
        ],
      );

      if (!permission.rows[0].allowed) {
        await client.query('ROLLBACK');

        return res.status(403).json({
          error: 'No tenés permiso para cambiar roles.',
          permission: 'users.role.change',
        });
      }

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
    }

    const result = await client.query(
      `UPDATE usuarios
       SET username = COALESCE($1, username),
           correo = COALESCE($2, correo),
           nombre_completo = CASE WHEN $3 THEN $4 ELSE nombre_completo END,
           telefono = CASE WHEN $5 THEN $6 ELSE telefono END,
           direccion = CASE WHEN $7 THEN $8 ELSE direccion END,
           forma_pago = CASE WHEN $9 THEN $10 ELSE forma_pago END,
           descripcion = CASE WHEN $11 THEN $12 ELSE descripcion END,
           password = COALESCE($13, password),
           rol = $14
       WHERE id = $15
       RETURNING id, username, correo, rol AS role, saldo,
                 nombre_completo, telefono, direccion, forma_pago, descripcion`,
      [
        updatesUsername ? username.trim() : null,
        updatesEmail ? correo.trim().toLowerCase() : null,
        updatesContactName,
        updatesContactName ? nombre_completo.trim() || null : null,
        updatesPhone,
        updatesPhone ? telefono.trim() || null : null,
        updatesAddress,
        updatesAddress ? direccion.trim() || null : null,
        updatesPaymentMethod,
        updatesPaymentMethod ? forma_pago.trim() || null : null,
        updatesDescription,
        updatesDescription ? descripcion.trim() || null : null,
        passwordHash,
        newRole,
        id,
      ],
    );

    if (role !== undefined && newRole !== targetUser.rol) {
      if (newRole === 'admin' || newRole === 'provider') {
        await client.query(
          `INSERT INTO proveedores (usuario_id)
           VALUES ($1)
           ON CONFLICT (usuario_id) DO NOTHING`,
          [id],
        );
      }

      await client.query(
        `DELETE FROM user_permission_overrides
         WHERE user_id = $1
           AND NOT (permission_key = ANY($2::text[]))`,
        [id, rolePermissionKeys[newRole]],
      );
    }

    await client.query('COMMIT');

    return res.json({
      message: 'Usuario actualizado correctamente.',
      user: result.rows[0],
    });
  } catch (error: unknown) {
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
        error: constraint.includes('correo')
          ? 'Ese correo electrónico ya está registrado.'
          : 'Ese nombre de usuario ya existe.',
      });
    }

    console.error('Error updating user:', error);

    return res.status(500).json({
      error: 'No se pudo actualizar el usuario.',
    });
  } finally {
    client.release();
  }
};
