
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
} from './middlewares/authMiddleware.js';

import {
  uploadProfilePhoto,
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

const app = express();
const PORT = Number(process.env.PORT) || 3000;

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.resolve(currentDirectory, '../uploads');

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDirectory));

app.get('/api/health', (_req, res) => {
  res.json({ message: 'API is running' });
});

// Autenticación y registro público
app.post('/api/login', loginUser);
app.post('/api/register', registerUser);

// Administración de usuarios
app.post('/api/admin/users', verifyToken, adminOnly, registerUser);
app.get('/api/users', verifyToken, adminOnly, listUsers);
app.delete('/api/users/:id', verifyToken, adminOnly, deleteUser);
app.patch('/api/users/:id/role', verifyToken, adminOnly, changeUserRole);

// Perfil personal
app.get('/api/profile', verifyToken, getProfile);
app.patch('/api/profile', verifyToken, updateProfile);
app.patch('/api/profile/password', verifyToken, changePassword);

app.post(
  '/api/profile/photo',
  verifyToken,
  (req, res, next) => {
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

      return next();
    });
  },
  saveProfilePhoto,
);

// Perfil comercial del proveedor
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

// Catálogo público
app.get('/api/products', listProducts);
app.get('/api/products/:id', getProductById);

// Administración de productos del proveedor
app.get(
  '/api/provider/products',
  verifyToken,
  providerOnly,
  listMyProducts,
);

app.post(
  '/api/provider/products',
  verifyToken,
  providerOnly,
  createProduct,
);

app.put(
  '/api/provider/products/:id',
  verifyToken,
  providerOnly,
  updateProduct,
);

app.patch(
  '/api/provider/products/:id/deactivate',
  verifyToken,
  providerOnly,
  deactivateProduct,
);

// Carrito y compras de usuarios
app.get('/api/cart', verifyToken, userOnly, getCart);
app.post('/api/cart/items', verifyToken, userOnly, addCartItem);

app.delete(
  '/api/cart/items/:productId',
  verifyToken,
  userOnly,
  removeCartItem,
);

app.post('/api/orders/checkout', verifyToken, userOnly, checkout);
app.get('/api/orders', verifyToken, userOnly, listMyOrders);

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
