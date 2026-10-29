
import type { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../db/connection.js'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not configured in the .env file')
}

const validRoles = ['admin', 'user', 'provider'] as const
type UserRole = (typeof validRoles)[number]

const isDuplicateKeyError = (error: unknown): boolean => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code === '23505'
  )
}

const registerAccount = async (req: Request, res: Response) => {
  const { username, password } = req.body ?? {}

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username.trim().length < 3 ||
    username.trim().length > 50 ||
    password.length < 8 ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    return res.status(400).json({
      error:
        'El usuario debe tener entre 3 y 50 caracteres y la contraseña al menos 8 caracteres, con un máximo de 72 bytes.',
    })
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10)

    const result = await pool.query(
      `INSERT INTO usuarios (username, password, rol)
       VALUES ($1, $2, 'user')
       RETURNING id, username, rol AS role, saldo`,
      [username.trim(), passwordHash],
    )

    return res.status(201).json({
      message: 'Usuario registrado correctamente.',
      user: result.rows[0],
    })
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      return res.status(409).json({
        error: 'Ese nombre de usuario ya existe.',
      })
    }

    console.error('Error registering user:', error)

    return res.status(500).json({
      error: 'No se pudo registrar el usuario.',
    })
  }
}

export const registerUser = async (req: Request, res: Response) => {
  return registerAccount(req, res)
}

export const createUserByAdmin = async (
  req: Request,
  res: Response,
) => {
  return registerAccount(req, res)
}

export const loginUser = async (req: Request, res: Response) => {
  const { username, password } = req.body ?? {}

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !username.trim() ||
    !password
  ) {
    return res.status(400).json({
      error: 'Ingresá tu usuario y contraseña.',
    })
  }

  try {
    const result = await pool.query(
      `SELECT id, username, password, rol, saldo
       FROM usuarios
       WHERE username = $1
       LIMIT 1`,
      [username.trim()],
    )

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Usuario o contraseña incorrectos.',
      })
    }

    const user = result.rows[0]
    const passwordMatches = await bcrypt.compare(
      password,
      user.password,
    )

    if (!passwordMatches) {
      return res.status(401).json({
        error: 'Usuario o contraseña incorrectos.',
      })
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        rol: user.rol,
      },
      JWT_SECRET,
      { expiresIn: '1h' },
    )

    return res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.rol,
        saldo: user.saldo,
      },
    })
  } catch (error) {
    console.error('Error logging in:', error)

    return res.status(500).json({
      error: 'No se pudo iniciar sesión.',
    })
  }
}

export const listUsers = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, username, rol AS role, saldo
       FROM usuarios
       ORDER BY id`,
    )

    return res.status(200).json(result.rows)
  } catch (error) {
    console.error('Error listing users:', error)

    return res.status(500).json({
      error: 'No se pudieron cargar los usuarios.',
    })
  }
}

export const deleteUser = async (req: Request, res: Response) => {
  const userId = Number(req.params.id)

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return res.status(400).json({
      error: 'El ID del usuario no es válido.',
    })
  }

  if (userId === req.user?.id) {
    return res.status(400).json({
      error: 'No podés eliminar tu propia cuenta.',
    })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(
      'SELECT pg_advisory_xact_lock($1, $2)',
      [726194, 1],
    )

    const targetResult = await client.query(
      `SELECT id, rol
       FROM usuarios
       WHERE id = $1
       FOR UPDATE`,
      [userId],
    )

    if (targetResult.rows.length === 0) {
      await client.query('ROLLBACK')

      return res.status(404).json({
        error: 'El usuario no existe.',
      })
    }

    if (targetResult.rows[0].rol === 'admin') {
      const adminResult = await client.query(
        `SELECT COUNT(*)::int AS total
         FROM usuarios
         WHERE rol = 'admin'`,
      )

      if (adminResult.rows[0].total <= 1) {
        await client.query('ROLLBACK')

        return res.status(409).json({
          error: 'No se puede eliminar al último administrador.',
        })
      }
    }

    await client.query(
      'DELETE FROM usuarios WHERE id = $1',
      [userId],
    )

    await client.query('COMMIT')

    return res.status(200).json({
      message: 'Usuario eliminado correctamente.',
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error deleting user:', error)

    return res.status(500).json({
      error: 'No se pudo eliminar el usuario.',
    })
  } finally {
    client.release()
  }
}

export const changePassword = async (
  req: Request,
  res: Response,
) => {
  const { currentPassword, newPassword } = req.body ?? {}
  const userId = req.user?.id

  if (!userId) {
    return res.status(401).json({
      error: 'No hay una sesión activa.',
    })
  }

  if (
    typeof currentPassword !== 'string' ||
    typeof newPassword !== 'string' ||
    newPassword.length < 8 ||
    Buffer.byteLength(newPassword, 'utf8') > 72
  ) {
    return res.status(400).json({
      error:
        'La nueva contraseña debe tener al menos 8 caracteres y máximo 72 bytes.',
    })
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({
      error: 'La nueva contraseña debe ser diferente de la actual.',
    })
  }

  try {
    const result = await pool.query(
      'SELECT password FROM usuarios WHERE id = $1',
      [userId],
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'El usuario no existe.',
      })
    }

    const matches = await bcrypt.compare(
      currentPassword,
      result.rows[0].password,
    )

    if (!matches) {
      return res.status(400).json({
        error: 'La contraseña actual es incorrecta.',
      })
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)

    await pool.query(
      'UPDATE usuarios SET password = $1 WHERE id = $2',
      [passwordHash, userId],
    )

    return res.status(200).json({
      message: 'Contraseña actualizada correctamente.',
    })
  } catch (error) {
    console.error('Error changing password:', error)

    return res.status(500).json({
      error: 'No se pudo cambiar la contraseña.',
    })
  }
}

export const changeUserRole = async (
  req: Request,
  res: Response,
) => {
  const userId = Number(req.params.id)
  const { role } = req.body ?? {}
  const currentUserId = req.user?.id

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return res.status(400).json({
      error: 'El ID del usuario no es válido.',
    })
  }

  if (userId === currentUserId) {
    return res.status(400).json({
      error: 'No podés cambiar tu propio rol.',
    })
  }

  if (
    typeof role !== 'string' ||
    !validRoles.includes(role as UserRole)
  ) {
    return res.status(400).json({
      error: 'El rol indicado no es válido.',
    })
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(
      'SELECT pg_advisory_xact_lock($1, $2)',
      [726194, 1],
    )

    const targetResult = await client.query(
      `SELECT id, username, rol
       FROM usuarios
       WHERE id = $1
       FOR UPDATE`,
      [userId],
    )

    if (targetResult.rows.length === 0) {
      await client.query('ROLLBACK')

      return res.status(404).json({
        error: 'El usuario no existe.',
      })
    }

    const target = targetResult.rows[0]

    if (target.rol === 'admin' && role !== 'admin') {
      const adminResult = await client.query(
        `SELECT COUNT(*)::int AS total
         FROM usuarios
         WHERE rol = 'admin'`,
      )

      if (adminResult.rows[0].total <= 1) {
        await client.query('ROLLBACK')

        return res.status(409).json({
          error:
            'No se puede cambiar el rol del último administrador.',
        })
      }
    }

    await client.query(
      'UPDATE usuarios SET rol = $1 WHERE id = $2',
      [role, userId],
    )

    if (role === 'provider') {
      await client.query(
        `INSERT INTO proveedores (usuario_id)
         VALUES ($1)
         ON CONFLICT (usuario_id) DO NOTHING`,
        [userId],
      )
    }

    await client.query('COMMIT')

    return res.status(200).json({
      message: 'Rol actualizado correctamente.',
      user: {
        id: target.id,
        username: target.username,
        role,
      },
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error changing user role:', error)

    return res.status(500).json({
      error: 'No se pudo cambiar el rol del usuario.',
    })
  } finally {
    client.release()
  }
}
