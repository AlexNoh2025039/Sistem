import type { UserRole } from '../middlewares/authMiddleware.js';
import pool from './connection.js';

const roles: UserRole[] = ['admin', 'user', 'provider'];

const defaultPermissions: Array<{
  key: string;
  allowedRoles: UserRole[];
}> = [
  { key: 'users.view', allowedRoles: ['admin'] },
  { key: 'users.create', allowedRoles: ['admin'] },
  { key: 'users.edit', allowedRoles: ['admin'] },
  { key: 'users.delete', allowedRoles: ['admin'] },
  { key: 'users.role.change', allowedRoles: ['admin'] },
  { key: 'permissions.manage', allowedRoles: ['admin'] },
  { key: 'orders.view', allowedRoles: ['admin', 'user', 'provider'] },
  { key: 'cart.manage', allowedRoles: ['user'] },
  { key: 'orders.create', allowedRoles: ['user'] },
  { key: 'provider.profile.manage', allowedRoles: ['provider'] },
];

export const initializePermissions = async (): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE public.usuarios
        ADD COLUMN IF NOT EXISTS nombre_completo VARCHAR(150),
        ADD COLUMN IF NOT EXISTS telefono VARCHAR(30),
        ADD COLUMN IF NOT EXISTS direccion VARCHAR(500),
        ADD COLUMN IF NOT EXISTS forma_pago VARCHAR(100),
        ADD COLUMN IF NOT EXISTS descripcion VARCHAR(2000)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.clientes (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        correo VARCHAR(150) NOT NULL UNIQUE,
        telefono VARCHAR(30) NOT NULL,
        direccion VARCHAR(500),
        descripcion VARCHAR(2000),
        forma_pago VARCHAR(100),
        creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      ALTER TABLE public.clientes
        ADD COLUMN IF NOT EXISTS direccion VARCHAR(500),
        ADD COLUMN IF NOT EXISTS descripcion VARCHAR(2000),
        ADD COLUMN IF NOT EXISTS forma_pago VARCHAR(100)
    `);

    await client.query(`
      ALTER TABLE public.proveedores
        ADD COLUMN IF NOT EXISTS nit VARCHAR(30),
        ADD COLUMN IF NOT EXISTS nombre_proveedor VARCHAR(120),
        ADD COLUMN IF NOT EXISTS contacto VARCHAR(120),
        ADD COLUMN IF NOT EXISTS telefono_2 VARCHAR(30)
    `);

    await client.query(`
      ALTER TABLE public.proveedores
      ALTER COLUMN usuario_id DROP NOT NULL
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS proveedores_nit_unique
      ON public.proveedores (nit)
      WHERE nit IS NOT NULL AND nit <> ''
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.role_permissions (
        role VARCHAR(30) NOT NULL
          CHECK (role IN ('admin', 'user', 'provider')),
        permission_key VARCHAR(80) NOT NULL,
        allowed BOOLEAN NOT NULL DEFAULT FALSE,
        actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (role, permission_key)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
        user_id INTEGER NOT NULL
          REFERENCES public.usuarios(id) ON DELETE CASCADE,
        permission_key VARCHAR(80) NOT NULL,
        allowed BOOLEAN NOT NULL,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, permission_key)
      )
    `);

    await client.query(`
      INSERT INTO public.role_permissions
        (role, permission_key, allowed, actualizado_en)
      SELECT role, 'users.role.change', allowed, actualizado_en
      FROM public.role_permissions
      WHERE permission_key = 'users.change_role'
      ON CONFLICT (role, permission_key) DO NOTHING
    `);

    const seedValues = roles.flatMap((role) =>
      defaultPermissions.map((permission) => ({
        role,
        key: permission.key,
        allowed: permission.allowedRoles.includes(role),
      })),
    );
    const parameters = seedValues.flatMap(({ role, key, allowed }) => [
      role,
      key,
      allowed,
    ]);
    const valuePlaceholders = seedValues
      .map((_, index) => {
        const offset = index * 3;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
      })
      .join(', ');

    await client.query(
      `INSERT INTO public.role_permissions (role, permission_key, allowed)
       VALUES ${valuePlaceholders}
       ON CONFLICT (role, permission_key) DO NOTHING`,
      parameters,
    );

    await client.query(`
      DELETE FROM public.role_permissions
      WHERE permission_key IN (
        'products.view',
        'products.publish',
        'products.edit',
        'products.deactivate'
      )
    `);

    await client.query(`
      DELETE FROM public.user_permission_overrides
      WHERE permission_key IN (
        'products.view',
        'products.publish',
        'products.edit',
        'products.deactivate'
      )
    `);

    await client.query(`
      INSERT INTO public.user_permission_overrides
        (user_id, permission_key, allowed, creado_en, actualizado_en)
      SELECT user_id, 'users.role.change', allowed, creado_en, actualizado_en
      FROM public.user_permission_overrides
      WHERE permission_key = 'users.change_role'
      ON CONFLICT (user_id, permission_key) DO NOTHING
    `);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
