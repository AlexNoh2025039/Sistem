
import { NextFunction, Request, Response } from 'express';
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
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (typeof decoded === 'string' || typeof decoded.id !== 'number') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const result = await pool.query(
      'SELECT id, username, rol FROM usuarios WHERE id = $1',
      [decoded.id],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User account no longer exists' });
    }

    const user = result.rows[0];
    const validRoles: UserRole[] = ['admin', 'user', 'provider'];

    if (!validRoles.includes(user.rol as UserRole)) {
      return res.status(403).json({ error: 'Invalid account role' });
    }

    req.user = {
      id: user.id,
      username: user.username,
      rol: user.rol as UserRole,
    };

    return next();
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError
    ) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    console.error('Error verifying token:', error);
    return res.status(500).json({ error: 'Authentication service unavailable' });
  }
};

export const adminOnly = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.user?.rol !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required' });
  }

  return next();
};

export const providerOnly = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.user?.rol !== 'provider') {
    return res.status(403).json({ error: 'Provider access required' });
  }

  return next();
};

export const userOnly = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.user?.rol !== 'user') {
    return res.status(403).json({ error: 'User access required' });
  }

  return next();
};
