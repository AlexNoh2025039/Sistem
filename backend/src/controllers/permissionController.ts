
import type { Request, Response } from 'express';
import pool from '../db/connection.js';
import type { UserRole } from '../middlewares/authMiddleware.js';

interface PermissionUpdate {
  role: UserRole;
  permission_key: string;
  allowed: boolean;
}

interface UserPermissionUpdate {
  permission_key: string;
  allowed: boolean;
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

const isValidPermissionKey = (key: string): boolean => {
  return Object.values(rolePermissionKeys).some((permissions) =>
    permissions.includes(key),
  );
};

const isPermissionAllowedForRole = (
  role: UserRole,
  key: string,
): boolean => {
  return rolePermissionKeys[role].includes(key);
};

// Obtener permisos generales de todos los roles
export const getRolePermissions = async (
  _req: Request,
  res: Response,
) => {
  try {
    const result = await pool.query(
      `SELECT role, permission_key, allowed
       FROM role_permissions
       ORDER BY permission_key, role`,
    );

    return res.json(result.rows);
  } catch (error) {
    console.error('Error getting role permissions:', error);

    return res.status(500).json({
      error: 'No se pudieron obtener los permisos de los roles.',
    });
  }
};

// Actualizar permisos generales de los roles
export const updateRolePermissions = async (
  req: Request,
  res: Response,
) => {
  const permissions = req.body?.permissions;

  if (!Array.isArray(permissions)) {
    return res.status(400).json({
      error: 'La lista de permisos no es válida.',
    });
  }

  const seen = new Set<string>();

  for (const permission of permissions as PermissionUpdate[]) {
    if (
      !permission ||
      !validRoles.includes(permission.role) ||
      typeof permission.permission_key !== 'string' ||
      !isValidPermissionKey(permission.permission_key) ||
      typeof permission.allowed !== 'boolean'
    ) {
      return res.status(400).json({
        error: 'Uno o más permisos contienen datos inválidos.',
      });
    }

    if (
      permission.allowed &&
      !isPermissionAllowedForRole(
        permission.role,
        permission.permission_key,
      )
    ) {
      return res.status(403).json({
        error: `El permiso ${permission.permission_key} no corresponde al rol ${permission.role}.`,
      });
    }

    const uniqueKey = `${permission.role}:${permission.permission_key}`;

    if (seen.has(uniqueKey)) {
      return res.status(400).json({
        error: 'Hay permisos duplicados en la solicitud.',
      });
    }

    seen.add(uniqueKey);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const permission of permissions as PermissionUpdate[]) {
      await client.query(
        `INSERT INTO role_permissions
           (role, permission_key, allowed, actualizado_en)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (role, permission_key)
         DO UPDATE SET
           allowed = EXCLUDED.allowed,
           actualizado_en = NOW()`,
        [
          permission.role,
          permission.permission_key,
          permission.allowed,
        ],
      );
    }

    await client.query('COMMIT');

    return res.json({
      message: 'Permisos de los roles actualizados correctamente.',
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Error updating role permissions:', error);

    return res.status(500).json({
      error: 'No se pudieron actualizar los permisos de los roles.',
    });
  } finally {
    client.release();
  }
};

// Obtener permisos individuales de un usuario
export const getUserPermissions = async (
  req: Request,
  res: Response,
) => {
  const userId = Number(req.params.id);

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({
      error: 'El ID del usuario no es válido.',
    });
  }

  try {
    const userResult = await pool.query(
      `SELECT id, username, rol
       FROM usuarios
       WHERE id = $1`,
      [userId],
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Usuario no encontrado.',
      });
    }

    const user = userResult.rows[0];
    const role = user.rol as UserRole;

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: 'El usuario tiene un rol no válido.',
      });
    }

    const result = await pool.query(
      `SELECT
         keys.permission_key,
         COALESCE(rp.allowed, FALSE) AS role_allowed,
         upo.allowed AS override_allowed,
         COALESCE(upo.allowed, rp.allowed, FALSE) AS effective_allowed,
         CASE
           WHEN upo.user_id IS NOT NULL THEN 'individual'
           ELSE 'role'
         END AS source
       FROM UNNEST($2::text[]) AS keys(permission_key)
       LEFT JOIN role_permissions rp
         ON rp.role = $1
         AND rp.permission_key = keys.permission_key
       LEFT JOIN user_permission_overrides upo
         ON upo.user_id = $3
         AND upo.permission_key = keys.permission_key
       ORDER BY keys.permission_key`,
      [role, rolePermissionKeys[role], userId],
    );

    return res.json({
      user: {
        id: user.id,
        username: user.username,
        role,
      },
      permissions: result.rows,
    });
  } catch (error) {
    console.error('Error getting user permissions:', error);

    return res.status(500).json({
      error: 'No se pudieron obtener los permisos individuales.',
    });
  }
};

// Guardar la configuración individual completa de un usuario
export const updateUserPermissions = async (
  req: Request,
  res: Response,
) => {
  const userId = Number(req.params.id);
  const permissions = req.body?.permissions;

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({
      error: 'El ID del usuario no es válido.',
    });
  }

  if (!Array.isArray(permissions)) {
    return res.status(400).json({
      error: 'La lista de permisos no es válida.',
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `SELECT id, rol
       FROM usuarios
       WHERE id = $1
       FOR UPDATE`,
      [userId],
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        error: 'Usuario no encontrado.',
      });
    }

    const role = userResult.rows[0].rol as UserRole;

    if (!validRoles.includes(role)) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'El usuario tiene un rol no válido.',
      });
    }

    const allowedKeys = rolePermissionKeys[role];
    const receivedKeys = new Set<string>();

    for (const permission of permissions as UserPermissionUpdate[]) {
      if (
        !permission ||
        typeof permission.permission_key !== 'string' ||
        !allowedKeys.includes(permission.permission_key) ||
        typeof permission.allowed !== 'boolean'
      ) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          error: 'Uno o más permisos no corresponden al rol del usuario.',
        });
      }

      if (receivedKeys.has(permission.permission_key)) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          error: 'Hay permisos individuales duplicados.',
        });
      }

      receivedKeys.add(permission.permission_key);
    }

    if (
      receivedKeys.size !== allowedKeys.length ||
      !allowedKeys.every((key) => receivedKeys.has(key))
    ) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'Debes enviar la configuración completa de permisos del usuario.',
      });
    }

    await client.query(
      `DELETE FROM user_permission_overrides
       WHERE user_id = $1`,
      [userId],
    );

    for (const permission of permissions as UserPermissionUpdate[]) {
      await client.query(
        `INSERT INTO user_permission_overrides
           (user_id, permission_key, allowed, actualizado_en)
         VALUES ($1, $2, $3, NOW())`,
        [
          userId,
          permission.permission_key,
          permission.allowed,
        ],
      );
    }

    await client.query('COMMIT');

    return res.json({
      message: 'Permisos individuales actualizados correctamente.',
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Error updating user permissions:', error);

    return res.status(500).json({
      error: 'No se pudieron actualizar los permisos individuales.',
    });
  } finally {
    client.release();
  }
};
