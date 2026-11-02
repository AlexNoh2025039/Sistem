import { useEffect, useState } from 'react';
import Login from './pages/login';
import Register from './pages/register';
import Users from './pages/Users';
import CreateUser from './pages/createUser';
import Profile from './pages/profile';
import Products from './pages/Products';
import ProductForm from './pages/ProductForm';
import PublicProducts from './pages/PublicProducts';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import RolePermissions from './pages/RolePermissions';
import type { Product } from './services/api';
import './index.css';
import './styles/Design3D.css';

type Page =
  | 'login'
  | 'register'
  | 'users'
  | 'create-user'
  | 'profile'
  | 'products'
  | 'product-form'
  | 'public-products'
  | 'cart'
  | 'orders'
  | 'role-permissions';

type StoredUser = {
  id: number;
  username: string;
  role: 'admin' | 'user' | 'provider';
};

type EffectivePermission = {
  permission_key: string;
  effective_allowed: boolean;
};

const API_URL = 'http://localhost:3000/api';

function getStoredUser(): StoredUser | null {
  try {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) return null;

    const user = JSON.parse(storedUser) as StoredUser;

    if (
      !user ||
      typeof user.id !== 'number' ||
      typeof user.username !== 'string' ||
      !['admin', 'user', 'provider'].includes(user.role)
    ) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

function getInitialPage(): Page {
  const user = getStoredUser();

  if (user?.role === 'admin') return 'users';
  if (user?.role === 'provider') return 'products';
  if (user?.role === 'user') return 'public-products';

  return 'login';
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(localStorage.getItem('token') && getStoredUser()),
  );

  const [currentPage, setCurrentPage] = useState<Page>(getInitialPage);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [permissionsLoading, setPermissionsLoading] = useState(
    () => getStoredUser()?.role === 'admin',
  );
  const [permissionsError, setPermissionsError] = useState('');

  const user = getStoredUser();

  const canViewProducts =
    user?.role === 'admin' && permissions['products.view'] === true;

  useEffect(() => {
    if (!localStorage.getItem('token') || !getStoredUser()) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setIsAuthenticated(false);
      setCurrentPage('login');
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user || user.role !== 'admin') {
      setPermissions({});
      setPermissionsLoading(false);
      setPermissionsError('');
      return;
    }

    const token = localStorage.getItem('token');

    if (!token) {
      setPermissionsLoading(false);
      return;
    }

    let active = true;

    const loadPermissions = async () => {
      setPermissionsLoading(true);
      setPermissionsError('');

      try {
        const response = await fetch(
          `${API_URL}/admin/users/${user.id}/permissions`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || 'No se pudieron consultar los permisos.',
          );
        }

        if (!Array.isArray(data.permissions)) {
          throw new Error(
            'El servidor devolvió un formato de permisos inválido.',
          );
        }

        const effectivePermissions: Record<string, boolean> = {};

        (data.permissions as EffectivePermission[]).forEach((permission) => {
          effectivePermissions[permission.permission_key] =
            permission.effective_allowed === true;
        });

        if (active) {
          setPermissions(effectivePermissions);
        }
      } catch (error) {
        if (active) {
          setPermissions({});
          setPermissionsError(
            error instanceof Error
              ? error.message
              : 'No se pudieron consultar los permisos.',
          );
        }
      } finally {
        if (active) {
          setPermissionsLoading(false);
        }
      }
    };

    void loadPermissions();

    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.id, user?.role]);

  useEffect(() => {
    if (user?.role === 'admin' && !permissionsLoading && !canViewProducts) {
      if (currentPage === 'products' || currentPage === 'product-form') {
        setCurrentPage('users');
        setSelectedProduct(null);
      }
    }
  }, [
    user?.role,
    permissionsLoading,
    canViewProducts,
    currentPage,
  ]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    setIsAuthenticated(false);
    setCurrentPage('login');
    setSelectedProduct(null);
    setPermissions({});
    setPermissionsLoading(false);
    setPermissionsError('');
  };

  const handleLoginSuccess = () => {
    const loggedUser = getStoredUser();

    if (!loggedUser || !localStorage.getItem('token')) {
      handleLogout();
      return;
    }

    setCurrentPage(getInitialPage());
    setIsAuthenticated(true);

    if (loggedUser.role === 'admin') {
      setPermissionsLoading(true);
    }
  };

  const handleUserCreated = () => {
    setCurrentPage('login');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    if (currentPage === 'register') {
      return <Register onBackToLogin={() => setCurrentPage('login')} />;
    }

    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onNavigateToRegister={() => setCurrentPage('register')}
      />
    );
  }

  if (!user || !localStorage.getItem('token')) {
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onNavigateToRegister={() => setCurrentPage('register')}
      />
    );
  }

  if (user.role === 'admin' && permissionsLoading) {
    return <main className="app-loading">Verificando permisos...</main>;
  }

  if (user.role === 'admin' && permissionsError) {
    return (
      <main className="app-loading">
        <p>{permissionsError}</p>
        <button type="button" onClick={handleLogout}>
          Volver a iniciar sesión
        </button>
      </main>
    );
  }

  if (user.role === 'provider') {
    switch (currentPage) {
      case 'profile':
        return (
          <Profile
            onNavigateToUsers={() => setCurrentPage('products')}
            onNavigateToCreateUser={() => setCurrentPage('products')}
            onLogout={handleLogout}
          />
        );

      case 'product-form':
        return (
          <ProductForm
            product={selectedProduct}
            onBack={() => setCurrentPage('products')}
            onSaved={() => {
              setSelectedProduct(null);
              setCurrentPage('products');
            }}
          />
        );

      case 'products':
      default:
        return (
          <Products
            onCreateProduct={() => {
              setSelectedProduct(null);
              setCurrentPage('product-form');
            }}
            onEditProduct={(product) => {
              setSelectedProduct(product);
              setCurrentPage('product-form');
            }}
            onLogout={handleLogout}
            onNavigateToProfile={() => setCurrentPage('profile')}
          />
        );
    }
  }

  if (user.role === 'user') {
    switch (currentPage) {
      case 'profile':
        return (
          <Profile
            onNavigateToUsers={() => setCurrentPage('public-products')}
            onNavigateToCreateUser={() => setCurrentPage('public-products')}
            onLogout={handleLogout}
          />
        );

      case 'cart':
        return (
          <Cart
            onBack={() => setCurrentPage('public-products')}
            onNavigateToOrders={() => setCurrentPage('orders')}
            onLogout={handleLogout}
          />
        );

      case 'orders':
        return (
          <Orders
            onBack={() => setCurrentPage('public-products')}
            onLogout={handleLogout}
          />
        );

      case 'public-products':
      default:
        return (
          <PublicProducts
            onLogout={handleLogout}
            onNavigate={(page) => setCurrentPage(page)}
          />
        );
    }
  }

  switch (currentPage) {
    case 'create-user':
      return (
        <CreateUser
          onBack={() => setCurrentPage('users')}
          onUserCreated={handleUserCreated}
          onNavigateToProfile={() => setCurrentPage('profile')}
          onNavigateToUsers={() => setCurrentPage('users')}
          onLogout={handleLogout}
        />
      );

    case 'profile':
      return (
        <Profile
          onNavigateToUsers={() => setCurrentPage('users')}
          onNavigateToCreateUser={() => setCurrentPage('create-user')}
          onLogout={handleLogout}
        />
      );

    case 'role-permissions':
      return (
        <RolePermissions
          onNavigateToUsers={() => setCurrentPage('users')}
          onNavigateToProfile={() => setCurrentPage('profile')}
          onLogout={handleLogout}
        />
      );

    case 'products':
      if (!canViewProducts) {
        return (
          <Users
            onLogout={handleLogout}
            onNavigateToProfile={() => setCurrentPage('profile')}
            onNavigateToRolePermissions={() =>
              setCurrentPage('role-permissions')
            }
            onNavigateToProducts={() => setCurrentPage('products')}
            canViewProducts={canViewProducts}
            permissions={permissions}
          />
        );
      }

      return (
        <Products
          onCreateProduct={() => {
            if (permissions['products.create'] !== true) return;
            setSelectedProduct(null);
            setCurrentPage('product-form');
          }}
          onEditProduct={(product) => {
            if (permissions['products.edit'] !== true) return;
            setSelectedProduct(product);
            setCurrentPage('product-form');
          }}
          onLogout={handleLogout}
          onNavigateToProfile={() => setCurrentPage('profile')}
        />
      );

    case 'product-form':
      if (
        !canViewProducts ||
        (selectedProduct === null &&
          permissions['products.create'] !== true) ||
        (selectedProduct !== null &&
          permissions['products.edit'] !== true)
      ) {
        setCurrentPage('users');

        return (
          <Users
            onLogout={handleLogout}
            onNavigateToProfile={() => setCurrentPage('profile')}
            onNavigateToRolePermissions={() =>
              setCurrentPage('role-permissions')
            }
            onNavigateToProducts={() => setCurrentPage('products')}
            canViewProducts={canViewProducts}
            permissions={permissions}
          />
        );
      }

      return (
        <ProductForm
          product={selectedProduct}
          onBack={() => {
            setSelectedProduct(null);
            setCurrentPage('products');
          }}
          onSaved={() => {
            setSelectedProduct(null);
            setCurrentPage('products');
          }}
        />
      );

    case 'users':
    default:
      return (
        <Users
          onLogout={handleLogout}
          onNavigateToProfile={() => setCurrentPage('profile')}
          onNavigateToRolePermissions={() =>
            setCurrentPage('role-permissions')
          }
          onNavigateToProducts={() => setCurrentPage('products')}
          canViewProducts={canViewProducts}
          permissions={permissions}
        />
      );
  }
}

export default App;