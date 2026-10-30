
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db/connection.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not configured in the .env file');
}

export type UserRole = 'admin' | 'user' | 'provider';

export interface TokenUser {
  id: number;
  username: string;
  rol: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: TokenUser;
    }
  }
}

const validRoles: UserRole[] = ['admin', 'user', 'provider'];

// Verificar el token y obtener los datos actuales del usuario
export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authorization = req.headers.authorization;

  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      error: 'Debes iniciar sesión.',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET!);

    if (
      typeof decoded === 'string' ||
      typeof decoded.id !== 'number'
    ) {
      return res.status(401).json({
        error: 'Token inválido.',
      });
    }

    const result = await pool.query(
      `SELECT id, username, rol
       FROM usuarios
       WHERE id = $1`,
      [decoded.id],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'La cuenta del usuario ya no existe.',
      });
    }

    const user = result.rows[0];

    if (!validRoles.includes(user.rol as UserRole)) {
      return res.status(403).json({
        error: 'El rol de la cuenta no es válido.',
      });
    }

    req.user = {
      id: user.id,
      username: user.username,
      rol: user.rol as UserRole,
    };

    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: 'Token inválido o expirado.',
      });
    }

    console.error('Error verifying token:', error);

    return res.status(500).json({
      error: 'No se pudo verificar la autenticación.',
    });
  }
};

// Comprobar si el usuario es administrador
export const adminOnly = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.user?.rol !== 'admin') {
    return res.status(403).json({
      error: 'Se requiere acceso de administrador.',
    });
  }

  return next();
};

// Comprobar si el usuario es proveedor
export const providerOnly = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.user?.rol !== 'provider') {
    return res.status(403).json({
      error: 'Se requiere una cuenta de proveedor.',
    });
  }

  return next();
};

// Comprobar si el usuario es cliente
export const userOnly = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.user?.rol !== 'user') {
    return res.status(403).json({
      error: 'Se requiere una cuenta de usuario.',
    });
  }

  return next();
};

// Comprobar permisos individuales y permisos generales del rol
export const requirePermission = (permissionKey: string) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Debes iniciar sesión.',
      });
    }

    try {
      // Primero comprobamos si existe una configuración individual.
      const overrideResult = await pool.query(
        `SELECT allowed
         FROM user_permission_overrides
         WHERE user_id = $1
           AND permission_key = $2`,
        [req.user.id, permissionKey],
      );

      let allowed = false;

      if (overrideResult.rows.length > 0) {
        // La configuración individual tiene prioridad.
        allowed = overrideResult.rows[0].allowed === true;
      } else {
        // Si no existe configuración individual, consultamos el rol.
        const roleResult = await pool.query(
          `SELECT allowed
           FROM role_permissions
           WHERE role = $1
             AND permission_key = $2`,
          [req.user.rol, permissionKey],
        );

        allowed =
          roleResult.rows.length > 0 &&
          roleResult.rows[0].allowed === true;
      }

      if (!allowed) {
        return res.status(403).json({
          error: 'No tienes permiso para realizar esta acción.',
          permission: permissionKey,
        });
      }

      return next();
    } catch (error) {
      console.error('Error checking permissions:', error);

      return res.status(500).json({
        error: 'No se pudieron verificar los permisos.',
      });
    }
  };
};
