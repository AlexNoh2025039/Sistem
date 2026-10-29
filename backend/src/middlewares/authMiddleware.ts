
import type { NextFunction, Request, Response } from 'express'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import pool from '../db/connection.js'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not configured in the .env file')
}

export type UserRole = 'admin' | 'user' | 'provider'

export interface TokenUser {
  id: number
  username: string
  rol: UserRole
}

declare global {
  namespace Express {
    interface Request {
      user?: TokenUser
    }
  }
}

const validRoles: UserRole[] = ['admin', 'user', 'provider']

export const verifyToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authorization = req.headers.authorization
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : null

  if (!token) {
    return res.status(401).json({
      error: 'Se requiere autenticación.',
    })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET)

    if (
      typeof decoded === 'string' ||
      !('id' in decoded) ||
      typeof decoded.id !== 'number' ||
      !Number.isSafeInteger(decoded.id) ||
      decoded.id <= 0
    ) {
      return res.status(401).json({
        error: 'El token no es válido.',
      })
    }

    const payload = decoded as JwtPayload

    const result = await pool.query(
      `SELECT id, username, rol
       FROM usuarios
       WHERE id = $1
       LIMIT 1`,
      [payload.id],
    )

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'La cuenta ya no existe.',
      })
    }

    const user = result.rows[0]

    if (
      typeof user.username !== 'string' ||
      !validRoles.includes(user.rol as UserRole)
    ) {
      return res.status(403).json({
        error: 'La cuenta tiene datos o un rol no válido.',
      })
    }

    req.user = {
      id: Number(user.id),
      username: user.username,
      rol: user.rol as UserRole,
    }

    return next()
  } catch (error: unknown) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError
    ) {
      return res.status(401).json({
        error: 'El token no es válido o ha expirado.',
      })
    }

    console.error('Error verifying token:', error)

    return res.status(500).json({
      error: 'El servicio de autenticación no está disponible.',
    })
  }
}

export const adminOnly = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Se requiere autenticación.',
    })
  }

  if (req.user.rol !== 'admin') {
    return res.status(403).json({
      error: 'Se requiere acceso de administrador.',
    })
  }

  return next()
}

export const providerOnly = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Se requiere autenticación.',
    })
  }

  if (req.user.rol !== 'provider') {
    return res.status(403).json({
      error: 'Se requiere acceso de proveedor.',
    })
  }

  return next()
}

export const userOnly = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Se requiere autenticación.',
    })
  }

  if (req.user.rol !== 'user') {
    return res.status(403).json({
      error: 'Se requiere acceso de usuario.',
    })
  }

  return next()
}
