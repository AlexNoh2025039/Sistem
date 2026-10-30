

BEGIN;
 
-- 1. ELIMINAR TABLAS ANTERIORES

DROP TABLE IF EXISTS pedido_items CASCADE;

DROP TABLE IF EXISTS pedidos CASCADE;

DROP TABLE IF EXISTS carrito_items CASCADE;

DROP TABLE IF EXISTS carritos CASCADE;

DROP TABLE IF EXISTS productos CASCADE;

DROP TABLE IF EXISTS proveedores CASCADE;

DROP TABLE IF EXISTS role_permissions CASCADE;

DROP TABLE IF EXISTS usuarios CASCADE;
 
-- 2. USUARIOS

CREATE TABLE usuarios (

    id SERIAL PRIMARY KEY,

    username VARCHAR(120) NOT NULL UNIQUE,

    correo VARCHAR(150) UNIQUE,

    password VARCHAR(255) NOT NULL,
 
    rol VARCHAR(30) NOT NULL DEFAULT 'user'

        CHECK (rol IN ('admin', 'provider', 'user')),
 
    saldo NUMERIC(12,2) NOT NULL DEFAULT 1000.00

        CHECK (saldo >= 0),
 
    foto_perfil TEXT,

    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()

);
 
-- 3. PROVEEDORES

CREATE TABLE proveedores (

    id SERIAL PRIMARY KEY,
 
    usuario_id INTEGER NOT NULL UNIQUE

        REFERENCES usuarios(id) ON DELETE CASCADE,
 
    nombre_empresa VARCHAR(120),

    descripcion TEXT,

    telefono VARCHAR(30),

    correo VARCHAR(150),

    direccion TEXT,
 
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()

);
 
-- 4. PRODUCTOS

CREATE TABLE productos (

    id SERIAL PRIMARY KEY,
 
    proveedor_id INTEGER NOT NULL

        REFERENCES proveedores(id) ON DELETE CASCADE,
 
    nombre VARCHAR(150) NOT NULL,

    descripcion TEXT,

    categoria VARCHAR(80),

    marca VARCHAR(80),

    modelo VARCHAR(100),
 
    precio NUMERIC(12,2) NOT NULL

        CHECK (precio >= 0),
 
    existencias INTEGER NOT NULL DEFAULT 0

        CHECK (existencias >= 0),
 
    imagen_url TEXT,

    activo BOOLEAN NOT NULL DEFAULT TRUE,
 
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()

);
 
-- 5. CARRITOS

CREATE TABLE carritos (

    id SERIAL PRIMARY KEY,
 
    usuario_id INTEGER NOT NULL UNIQUE

        REFERENCES usuarios(id) ON DELETE CASCADE,
 
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()

);
 
-- 6. PRODUCTOS DEL CARRITO

CREATE TABLE carrito_items (

    id SERIAL PRIMARY KEY,
 
    carrito_id INTEGER NOT NULL

        REFERENCES carritos(id) ON DELETE CASCADE,
 
    producto_id INTEGER NOT NULL

        REFERENCES productos(id) ON DELETE CASCADE,
 
    cantidad INTEGER NOT NULL

        CHECK (cantidad > 0),
 
    UNIQUE (carrito_id, producto_id)

);
 
-- 7. PEDIDOS

CREATE TABLE pedidos (

    id SERIAL PRIMARY KEY,
 
    usuario_id INTEGER

        REFERENCES usuarios(id) ON DELETE SET NULL,
 
    estado VARCHAR(20) NOT NULL DEFAULT 'confirmado'

        CHECK (

            estado IN (

                'confirmado',

                'enviado',

                'entregado',

                'cancelado'

            )

        ),
 
    total NUMERIC(12,2) NOT NULL DEFAULT 0

        CHECK (total >= 0),
 
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()

);
 
-- 8. DETALLES DE PEDIDOS

CREATE TABLE pedido_items (

    id SERIAL PRIMARY KEY,
 
    pedido_id INTEGER NOT NULL

        REFERENCES pedidos(id) ON DELETE CASCADE,
 
    producto_id INTEGER

        REFERENCES productos(id) ON DELETE SET NULL,
 
    nombre_producto VARCHAR(150) NOT NULL,
 
    precio_unitario NUMERIC(12,2) NOT NULL

        CHECK (precio_unitario >= 0),
 
    cantidad INTEGER NOT NULL

        CHECK (cantidad > 0),
 
    subtotal NUMERIC(12,2) NOT NULL

        CHECK (subtotal >= 0)

);
 
-- 9. PERMISOS POR ROL

CREATE TABLE role_permissions (

    role VARCHAR(30) NOT NULL

        CHECK (role IN ('admin', 'user', 'provider')),
 
    permission_key VARCHAR(80) NOT NULL,

    allowed BOOLEAN NOT NULL DEFAULT FALSE,
 
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 
    PRIMARY KEY (role, permission_key)

);
 
-- 10. PERMISOS INICIALES

INSERT INTO role_permissions (role, permission_key, allowed)

VALUES

    ('admin', 'users.view', TRUE),

    ('admin', 'users.create', TRUE),

    ('admin', 'users.edit', TRUE),

    ('admin', 'users.delete', TRUE),

    ('admin', 'users.change_role', TRUE),

    ('admin', 'permissions.manage', TRUE),
 
    ('user', 'users.view', FALSE),

    ('user', 'users.create', FALSE),

    ('user', 'users.edit', FALSE),

    ('user', 'users.delete', FALSE),

    ('user', 'users.change_role', FALSE),

    ('user', 'permissions.manage', FALSE),
 
    ('provider', 'users.view', FALSE),

    ('provider', 'users.create', FALSE),

    ('provider', 'users.edit', FALSE),

    ('provider', 'users.delete', FALSE),

    ('provider', 'users.change_role', FALSE),

    ('provider', 'permissions.manage', FALSE),
 
    ('admin', 'products.view', TRUE),

    ('admin', 'products.publish', TRUE),

    ('admin', 'products.edit', TRUE),

    ('admin', 'products.deactivate', TRUE),
 
    ('user', 'products.view', TRUE),

    ('user', 'products.publish', FALSE),

    ('user', 'products.edit', FALSE),

    ('user', 'products.deactivate', FALSE),
 
    ('provider', 'products.view', TRUE),

    ('provider', 'products.publish', TRUE),

    ('provider', 'products.edit', TRUE),

    ('provider', 'products.deactivate', TRUE),
 
    ('admin', 'provider.profile.manage', TRUE),

    ('user', 'provider.profile.manage', FALSE),

    ('provider', 'provider.profile.manage', TRUE),
 
    ('admin', 'cart.manage', TRUE),

    ('user', 'cart.manage', TRUE),

    ('provider', 'cart.manage', FALSE),
 
    ('admin', 'orders.create', TRUE),

    ('admin', 'orders.view', TRUE),

    ('user', 'orders.create', TRUE),

    ('user', 'orders.view', TRUE),

    ('provider', 'orders.create', FALSE),

    ('provider', 'orders.view', FALSE)
 
ON CONFLICT (role, permission_key) DO NOTHING;
 
-- 11. ÍNDICES

CREATE INDEX idx_productos_proveedor

    ON productos(proveedor_id);
 
CREATE INDEX idx_productos_catalogo

    ON productos(activo, categoria);
 
CREATE INDEX idx_pedidos_usuario

    ON pedidos(usuario_id);
 
CREATE INDEX idx_pedido_items_pedido

    ON pedido_items(pedido_id);
 
COMMIT;
 
-- 12. VERIFICAR TABLAS

SELECT table_name

FROM information_schema.tables

WHERE table_schema = 'public'

  AND table_name IN (

      'usuarios',

      'proveedores',

      'productos',

      'carritos',

      'carrito_items',

      'pedidos',

      'pedido_items',

      'role_permissions'

  )

ORDER BY table_name;
 
-- 13. VERIFICAR PERMISOS

SELECT role, permission_key, allowed

FROM role_permissions

ORDER BY role, permission_key;
 
 
SELECT role, permission_key, allowed

FROM role_permissions

ORDER BY role, permission_key;
 
 
CREATE TABLE IF NOT EXISTS user_permission_overrides (

    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,

    permission_key VARCHAR(80) NOT NULL,

    allowed BOOLEAN NOT NULL,

    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, permission_key)

);

 