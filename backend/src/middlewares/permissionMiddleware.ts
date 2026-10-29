
import type { RequestHandler } from 'express'
import pool from '../db/connection.js'

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

type PermissionKey = (typeof validPermissions)[number]

export const requirePermission = (
  permissionKey: PermissionKey,
): RequestHandler => {
  return async (req, res, next): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'No autenticado.',
      })
      return
    }

    if (!validPermissions.includes(permissionKey)) {
      res.status(500).json({
        error: 'Permiso no válido.',
      })
      return
    }

    try {
      // La excepción individual tiene prioridad sobre el permiso del rol.
      const overrideResult = await pool.query(
        `SELECT allowed
         FROM user_permission_overrides
         WHERE user_id = $1
           AND permission_key = $2
         LIMIT 1`,
        [req.user.id, permissionKey],
      )

      if (overrideResult.rows.length > 0) {
        const allowed = overrideResult.rows[0].allowed === true

        if (allowed) {
          next()
          return
        }

        res.status(403).json({
          error: 'No tenés permiso para realizar esta operación.',
          permission: permissionKey,
        })
        return
      }

      // Sin excepción individual, se utiliza la configuración del rol.
      const roleResult = await pool.query(
        `SELECT allowed
         FROM role_permissions
         WHERE role = $1
           AND permission_key = $2
         LIMIT 1`,
        [req.user.rol, permissionKey],
      )

      if (
        roleResult.rows.length === 0 ||
        roleResult.rows[0].allowed !== true
      ) {
        res.status(403).json({
          error: 'No tenés permiso para realizar esta operación.',
          permission: permissionKey,
        })
        return
      }

      next()
    } catch (error: unknown) {
      console.error('Error al comprobar permisos:', error)

      res.status(500).json({
        error: 'Error interno al comprobar los permisos.',
      })
    }
  }
}
