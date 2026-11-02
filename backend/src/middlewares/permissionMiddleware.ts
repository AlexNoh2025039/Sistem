import { Request, Response, NextFunction } from 'express';
import pool from '../db/connection.js';

export const requirePermission = (permissionKey: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    try {
      const userOverride = await pool.query(
        `SELECT allowed
         FROM user_permission_overrides
         WHERE user_id = $1 AND permission_key = $2`,
        [req.user.id, permissionKey],
      );

      if (userOverride.rows.length > 0) {
        if (userOverride.rows[0].allowed) {
          return next();
        }

        return res.status(403).json({
          error: 'You do not have permission to perform this action.',
          permission: permissionKey,
        });
      }

      const rolePermission = await pool.query(
        `SELECT allowed
         FROM role_permissions
         WHERE role = $1 AND permission_key = $2`,
        [req.user.rol, permissionKey],
      );

      if (rolePermission.rows.length === 0 || !rolePermission.rows[0].allowed) {
        return res.status(403).json({
          error: 'You do not have permission to perform this action.',
          permission: permissionKey,
        });
      }

      return next();
    } catch (error) {
      console.error('Error checking permission:', error);

      return res.status(500).json({
        error: 'Could not verify permissions.',
      });
    }
  };
};