
import type { Request, Response } from 'express'
import pool from './db/connection.js'
  
const validRoles = ['admin', 'user', 'provider'] as const

const validPermissions = [
  'cart.manage',
  'orders.create',
  'orders.view',
  'permissions.manage',
  'products.deactivate',
  'products.edit',
  'products.publish',
  'products.view',
  'provider.profile.manage',
  'users.change_role',
  'users.create',
  'users.delete',
  'users.edit',
  'users.view',
] as const

type UserRole = (typeof validRoles)[number]
type PermissionKey = (typeof validPermissions)[number]

const isValidUserId = (id: number): boolean =>
  Number.isSafeInteger(id) && id > 0

export const getRolePermissions = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT role, permission_key, allowed
       FROM role_permissions
       ORDER BY role, permission_key`,
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Error al consultar permisos:', error)
    res.status(500).json({
      error: 'No se pudieron consultar los permisos.',
    })
  }
}

export const updateRolePermission = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { role, permissionKey, allowed } = req.body ?? {}

  if (
    typeof role !== 'string' ||
    !validRoles.includes(role as UserRole) ||
    typeof permissionKey !== 'string' ||
    !validPermissions.includes(permissionKey as PermissionKey) ||
    typeof allowed !== 'boolean'
  ) {
    res.status(400).json({
      error: 'El rol, permiso o valor enviado no es válido.',
    })
    return
  }

  if (role === 'admin' && allowed === false) {
    res.status(403).json({
      error:
        'Los permisos base del rol administrador no se pueden desactivar. Usá excepciones individuales.',
    })
    return
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const currentPermission = await client.query(
      `SELECT allowed
       FROM role_permissions
       WHERE role = $1 AND permission_key = $2
       FOR UPDATE`,
      [role, permissionKey],
    )

    if (currentPermission.rows.length === 0) {
      await client.query('ROLLBACK')
      res.status(404).json({
        error: 'No se encontró el permiso solicitado.',
      })
      return
    }

    await client.query(
      `UPDATE role_permissions
       SET allowed = $1, actualizado_en = CURRENT_TIMESTAMP
       WHERE role = $2 AND permission_key = $3`,
      [allowed, role, permissionKey],
    )

    await client.query('COMMIT')

    res.json({
      message: 'Permiso actualizado correctamente.',
      role,
      permissionKey,
      allowed,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error al actualizar permisos:', error)
    res.status(500).json({
      error: 'No se pudo actualizar el permiso.',
    })
  } finally {
    client.release()
  }
}

export const getUserPermissionOverrides = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = Number(req.params.id)

  if (!isValidUserId(userId)) {
    res.status(400).json({
      error: 'El ID del usuario no es válido.',
    })
    return
  }

  try {
    const userResult = await pool.query(
      `SELECT id, username, rol
       FROM usuarios
       WHERE id = $1`,
      [userId],
    )

    if (userResult.rows.length === 0) {
      res.status(404).json({
        error: 'No se encontró el usuario.',
      })
      return
    }

    const overridesResult = await pool.query(
      `SELECT permission_key, allowed, actualizado_en
       FROM user_permission_overrides
       WHERE user_id = $1
       ORDER BY permission_key`,
      [userId],
    )

    res.json({
      user: userResult.rows[0],
      overrides: overridesResult.rows,
    })
  } catch (error) {
    console.error(
      'Error al consultar excepciones individuales:',
      error,
    )
    res.status(500).json({
      error: 'No se pudieron consultar las excepciones individuales.',
    })
  }
}

export const updateUserPermissionOverride = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = Number(req.params.id)
  const { permissionKey, allowed } = req.body ?? {}

  if (!isValidUserId(userId)) {
    res.status(400).json({
      error: 'El ID del usuario no es válido.',
    })
    return
  }

  if (
    typeof permissionKey !== 'string' ||
    !validPermissions.includes(permissionKey as PermissionKey) ||
    typeof allowed !== 'boolean'
  ) {
    res.status(400).json({
      error: 'El permiso o el valor enviado no es válido.',
    })
    return
  }

  try {
    const userResult = await pool.query(
      `SELECT id, rol
       FROM usuarios
       WHERE id = $1`,
      [userId],
    )

    if (userResult.rows.length === 0) {
      res.status(404).json({
        error: 'No se encontró el usuario.',
      })
      return
    }

    if (
      permissionKey === 'permissions.manage' &&
      allowed === false &&
      userResult.rows[0].rol === 'admin'
    ) {
      res.status(403).json({
        error:
          'No se puede denegar permissions.manage a una cuenta administradora.',
      })
      return
    }

    const result = await pool.query(
      `INSERT INTO user_permission_overrides
         (user_id, permission_key, allowed)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, permission_key)
       DO UPDATE SET
         allowed = EXCLUDED.allowed,
         actualizado_en = CURRENT_TIMESTAMP
       RETURNING user_id, permission_key, allowed, actualizado_en`,
      [userId, permissionKey, allowed],
    )

    res.json({
      message: 'Excepción individual actualizada correctamente.',
      override: result.rows[0],
    })
  } catch (error) {
    console.error(
      'Error al actualizar excepción individual:',
      error,
    )
    res.status(500).json({
      error: 'No se pudo actualizar la excepción individual.',
    })
  }
}

export const deleteUserPermissionOverride = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const userId = Number(req.params.id)
  const permissionKey = req.params.permissionKey

  if (!isValidUserId(userId)) {
    res.status(400).json({
      error: 'El ID del usuario no es válido.',
    })
    return
  }

  if (
    typeof permissionKey !== 'string' ||
    !validPermissions.includes(permissionKey as PermissionKey)
  ) {
    res.status(400).json({
      error: 'El permiso solicitado no es válido.',
    })
    return
  }

  try {
    const userResult = await pool.query(
      `SELECT id, rol
       FROM usuarios
       WHERE id = $1`,
      [userId],
    )

    if (userResult.rows.length === 0) {
      res.status(404).json({
        error: 'No se encontró el usuario.',
      })
      return
    }

    if (
      permissionKey === 'permissions.manage' &&
      userResult.rows[0].rol === 'admin'
    ) {
      res.status(403).json({
        error:
          'No se puede modificar la excepción de permissions.manage para una cuenta administradora.',
      })
      return
    }

    const result = await pool.query(
      `DELETE FROM user_permission_overrides
       WHERE user_id = $1
         AND permission_key = $2
       RETURNING user_id, permission_key`,
      [userId, permissionKey],
    )

    if (result.rowCount === 0) {
      res.status(404).json({
        error: 'No existe una excepción para ese permiso.',
      })
      return
    }

    res.json({
      message:
        'Excepción eliminada. El permiso vuelve a heredarse del rol.',
      userId,
      permissionKey,
    })
  } catch (error) {
    console.error(
      'Error al eliminar excepción individual:',
      error,
    )
    res.status(500).json({
      error: 'No se pudo eliminar la excepción individual.',
    })
  }
}

export const getMyEffectivePermissions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      error: 'No autenticado.',
    })
    return
  }

  try {
    const [roleResult, overrideResult] = await Promise.all([
      pool.query(
        `SELECT permission_key, allowed
         FROM role_permissions
         WHERE role = $1`,
        [req.user.rol],
      ),
      pool.query(
        `SELECT permission_key, allowed
         FROM user_permission_overrides
         WHERE user_id = $1`,
        [req.user.id],
      ),
    ])

    const rolePermissions = new Map<string, boolean>(
      roleResult.rows.map((row) => [
        row.permission_key,
        row.allowed === true,
      ]),
    )

    const overrides = new Map<string, boolean>(
      overrideResult.rows.map((row) => [
        row.permission_key,
        row.allowed === true,
      ]),
    )

    const effectivePermissions = Object.fromEntries(
      validPermissions.map((permissionKey) => [
        permissionKey,
        overrides.has(permissionKey)
          ? overrides.get(permissionKey) === true
          : rolePermissions.get(permissionKey) === true,
      ]),
    )

    res.json({
      userId: req.user.id,
      role: req.user.rol,
      permissions: effectivePermissions,
    })
  } catch (error) {
    console.error('Error al consultar permisos efectivos:', error)

    res.status(500).json({
      error: 'No se pudieron consultar los permisos efectivos.',
    })
  }
}
