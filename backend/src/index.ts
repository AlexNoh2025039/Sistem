
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

import pool from './db/connection.js';

import {
  registerUser,
  loginUser,
  listUsers,
  deleteUser,
  changePassword,
  changeUserRole,
} from './controllers/userController.js';

import {
  getProfile,
  updateProfile,
  saveProfilePhoto,
} from './controllers/profileController.js';

import {
  verifyToken,
  adminOnly,
  providerOnly,
  userOnly,
  requirePermission,
} from './middlewares/authMiddleware.js';

import {
  uploadProfilePhoto,
  uploadProductImage,
} from './middlewares/uploadMiddleware.js';

import {
  getProviderProfile,
  saveProviderProfile,
} from './controllers/providerController.js';

import {
  listProducts,
  getProductById,
  listMyProducts,
  createProduct,
  updateProduct,
  deactivateProduct,
} from './controllers/productController.js';

import {
  getCart,
  addCartItem,
  removeCartItem,
  checkout,
  listMyOrders,
} from './controllers/orderController.js';

import {
  getRolePermissions,
  updateRolePermissions,
  getUserPermissions,
  updateUserPermissions,
} from './controllers/permissionController.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.resolve(currentDirectory, '../uploads');

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDirectory));

// Procesamiento de imágenes de perfil.
const handleProfilePhotoUpload = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  uploadProfilePhoto.single('photo')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'La imagen no puede superar los 2 MB.',
        });
      }

      return res.status(400).json({
        error: 'No se pudo procesar la imagen.',
      });
    }

    if (error) {
      return res.status(400).json({
        error: error.message || 'Imagen no válida.',
      });
    }

    next();
  });
};

// Procesamiento de imágenes de productos.
const handleProductImageUpload = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
  uploadProductImage.single('image')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'La imagen del producto no puede superar los 5 MB.',
        });
      }

      return res.status(400).json({
        error: 'No se pudo procesar la imagen del producto.',
      });
    }

    if (error) {
      return res.status(400).json({
        error: error.message || 'Imagen del producto no válida.',
      });
    }

    next();
  });
};

// Estado de la API.
app.get('/api/health', (_req, res) => {
  res.json({ message: 'API is running' });
});

// Autenticación y registro público.
app.post('/api/login', loginUser);
app.post('/api/register', registerUser);

// Administración de usuarios.
app.post(
  '/api/admin/users',
  verifyToken,
  adminOnly,
  requirePermission('users.create'),
  registerUser,
);

app.get(
  '/api/users',
  verifyToken,
  adminOnly,
  requirePermission('users.view'),
  listUsers,
);

app.delete(
  '/api/users/:id',
  verifyToken,
  adminOnly,
  requirePermission('users.delete'),
  deleteUser,
);

app.patch(
  '/api/users/:id/role',
  verifyToken,
  adminOnly,
  requirePermission('users.role.change'),
  changeUserRole,
);

// Administración de permisos por rol.
app.get(
  '/api/admin/permissions',
  verifyToken,
  adminOnly,
  getRolePermissions,
);

app.put(
  '/api/admin/permissions',
  verifyToken,
  adminOnly,
  updateRolePermissions,
);

// Administración de permisos individuales.
app.get(
  '/api/admin/users/:id/permissions',
  verifyToken,
  adminOnly,
  getUserPermissions,
);

app.put(
  '/api/admin/users/:id/permissions',
  verifyToken,
  adminOnly,
  updateUserPermissions,
);

// Perfil personal.
app.get('/api/profile', verifyToken, getProfile);
app.patch('/api/profile', verifyToken, updateProfile);
app.patch('/api/profile/password', verifyToken, changePassword);

app.post(
  '/api/profile/photo',
  verifyToken,
  handleProfilePhotoUpload,
  saveProfilePhoto,
);

// Perfil comercial del proveedor.
app.get(
  '/api/provider/profile',
  verifyToken,
  providerOnly,
  getProviderProfile,
);

app.put(
  '/api/provider/profile',
  verifyToken,
  providerOnly,
  saveProviderProfile,
);

// Catálogo público.
app.get('/api/products', listProducts);
app.get('/api/products/:id', getProductById);

// Productos propios del administrador o proveedor.
app.get(
  '/api/provider/products',
  verifyToken,
  requirePermission('products.view'),
  listMyProducts,
);

app.post(
  '/api/provider/products',
  verifyToken,
  requirePermission('products.publish'),
  handleProductImageUpload,
  createProduct,
);

app.put(
  '/api/provider/products/:id',
  verifyToken,
  requirePermission('products.edit'),
  handleProductImageUpload,
  updateProduct,
);

app.patch(
  '/api/provider/products/:id/deactivate',
  verifyToken,
  requirePermission('products.deactivate'),
  deactivateProduct,
);

// Carrito y compras.
app.get(
  '/api/cart',
  verifyToken,
  userOnly,
  requirePermission('cart.manage'),
  getCart,
);

app.post(
  '/api/cart/items',
  verifyToken,
  userOnly,
  requirePermission('cart.manage'),
  addCartItem,
);

app.delete(
  '/api/cart/items/:productId',
  verifyToken,
  userOnly,
  requirePermission('cart.manage'),
  removeCartItem,
);

// Pedidos.
app.post(
  '/api/orders/checkout',
  verifyToken,
  userOnly,
  requirePermission('orders.create'),
  checkout,
);

app.get(
  '/api/orders',
  verifyToken,
  userOnly,
  requirePermission('orders.view'),
  listMyOrders,
);

// Inicio del servidor.
const startServer = async () => {
  try {
    await pool.query('SELECT 1');

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Could not connect to PostgreSQL:', error);
    process.exitCode = 1;
  }
};

void startServer();
