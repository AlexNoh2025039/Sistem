
BEGIN;

 
-- 1. ELIMINAR TABLAS ANTERIORES
 

DROP TABLE IF EXISTS pedido_items CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS carrito_items CASCADE;
DROP TABLE IF EXISTS carritos CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS proveedores CASCADE;
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
-- Al eliminar al usuario, se elimina su perfil.
 

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
-- Al eliminar al proveedor, se eliminan sus productos.
 
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
-- Al eliminar al usuario, se elimina su carrito.
 
CREATE TABLE carritos (
    id SERIAL PRIMARY KEY,

    usuario_id INTEGER NOT NULL UNIQUE
        REFERENCES usuarios(id) ON DELETE CASCADE,

    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


 -- 6. PRODUCTOS DEL CARRITO
-- Se eliminan si desaparece el carrito o el producto.
 
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
-- El historial permanece aunque se elimine al usuario.
 
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
-- Se conserva el nombre, precio y cantidad históricos.
 
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


 -- 9. ÍNDICES
 
CREATE INDEX idx_productos_proveedor
    ON productos(proveedor_id);

CREATE INDEX idx_productos_catalogo
    ON productos(activo, categoria);

CREATE INDEX idx_pedidos_usuario
    ON pedidos(usuario_id);

CREATE INDEX idx_pedido_items_pedido
    ON pedido_items(pedido_id);


COMMIT;


 -- 10. VERIFICAR TABLAS
 
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
      'pedido_items'
  )
ORDER BY table_name;


 
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS tabla_referenciada,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.constraint_schema = kcu.constraint_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.constraint_schema = tc.constraint_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
   AND rc.constraint_schema = tc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.constraint_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
