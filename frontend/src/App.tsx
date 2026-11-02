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
import ProviderForm from './pages/ProviderForm';
import Providers from './pages/Providers';
import type { AdminPage } from './components/AdminSidebar';
import type { AdminProvider, Product, UserRole } from './services/api';
import './index.css';
import './styles/Design3D.css';

type Page =
  | 'login'
  | 'register'
  | 'users'
  | 'providers'
  | 'admins'
  | 'create-user'
  | 'create-provider'
  | 'edit-provider'
  | 'create-product'
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

const API_URL = (
  import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
).replace(/\/$/, '');

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
  if (user?.role === 'provider') return 'profile';
  if (user?.role === 'user') return 'public-products';

  return 'login';
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(localStorage.getItem('token') && getStoredUser()),
  );

  const [currentPage, setCurrentPage] = useState<Page>(getInitialPage);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProvider, setSelectedProvider] =
    useState<AdminProvider | null>(null);

  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [permissionsLoading, setPermissionsLoading] = useState(
    () => getStoredUser()?.role === 'admin',
  );
  const [permissionsError, setPermissionsError] = useState('');

  const user = getStoredUser();

  const canViewProducts = user?.role === 'admin';

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

  const handleUserCreated = () => setCurrentPage('users');

  const handleNavigateToUserRole = (role: UserRole | 'all') => {
    setCurrentPage(
      role === 'all' || role === 'user'
        ? 'users'
        : role === 'provider'
          ? 'providers'
          : 'admins',
    );
  };
  const handleNavigateToAdminPage = (page: AdminPage) => {
    if (page === 'create-product') setSelectedProduct(null);
    if (page === 'create-provider') setSelectedProvider(null);
    setCurrentPage(page);
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
    return (
      <Profile
        onNavigateToUsers={() => setCurrentPage('profile')}
        onNavigateToUserRole={handleNavigateToUserRole}
        onNavigateToCreateUser={() => setCurrentPage('profile')}
        onLogout={handleLogout}
      />
    );
  }

  if (user.role === 'user') {
    switch (currentPage) {
      case 'profile':
        return (
          <Profile
            onNavigateToUsers={() => setCurrentPage('public-products')}
            onNavigateToUserRole={handleNavigateToUserRole}
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
    case 'providers':
      return (
        <Providers
          canViewProducts={canViewProducts}
          onLogout={handleLogout}
          onNavigateToProfile={() => setCurrentPage('profile')}
          onNavigateToRolePermissions={() =>
            setCurrentPage('role-permissions')
          }
          onNavigateToProducts={() => setCurrentPage('products')}
          onNavigateToUserRole={handleNavigateToUserRole}
          onNavigateToPage={handleNavigateToAdminPage}
          onEditProvider={(provider) => {
            setSelectedProvider(provider);
            setCurrentPage('edit-provider');
          }}
        />
      );

    case 'create-user':
      return (
        <CreateUser
          key="new-client"
          onBack={() => setCurrentPage('users')}
          onUserCreated={handleUserCreated}
          onNavigateToProfile={() => setCurrentPage('profile')}
          onNavigateToUsers={() => setCurrentPage('users')}
          onNavigateToUserRole={handleNavigateToUserRole}
          onNavigateToProducts={() => setCurrentPage('products')}
          onNavigateToPage={handleNavigateToAdminPage}
          onNavigateToRolePermissions={() =>
            setCurrentPage('role-permissions')
          }
          canViewProducts={canViewProducts}
          onLogout={handleLogout}
        />
      );

    case 'create-provider':
      return (
        <ProviderForm
          provider={null}
          onBack={() => setCurrentPage('providers')}
          onSaved={() => setCurrentPage('providers')}
          canViewProducts={canViewProducts}
          onNavigateToPage={handleNavigateToAdminPage}
          onLogout={handleLogout}
        />
      );

    case 'edit-provider':
      return (
        <ProviderForm
          provider={selectedProvider}
          onBack={() => setCurrentPage('providers')}
          onSaved={() => {
            setSelectedProvider(null);
            setCurrentPage('providers');
          }}
          canViewProducts={canViewProducts}
          onNavigateToPage={handleNavigateToAdminPage}
          onLogout={handleLogout}
        />
      );

    case 'profile':
      return (
        <Profile
          onNavigateToUsers={() => setCurrentPage('users')}
          onNavigateToUserRole={handleNavigateToUserRole}
          onNavigateToCreateUser={() => setCurrentPage('create-user')}
          onNavigateToProducts={() => setCurrentPage('products')}
          onNavigateToPage={handleNavigateToAdminPage}
          onNavigateToRolePermissions={() =>
            setCurrentPage('role-permissions')
          }
          canViewProducts={canViewProducts}
          onLogout={handleLogout}
        />
      );

    case 'role-permissions':
      return (
        <RolePermissions
          onNavigateToUsers={() => setCurrentPage('users')}
          onNavigateToUserRole={handleNavigateToUserRole}
          onNavigateToProducts={() => setCurrentPage('products')}
          onNavigateToPage={handleNavigateToAdminPage}
          onNavigateToProfile={() => setCurrentPage('profile')}
          canViewProducts={canViewProducts}
          onLogout={handleLogout}
        />
      );

    case 'create-product':
      return (
        <ProductForm
          product={null}
          onBack={() => setCurrentPage('products')}
          onSaved={() => setCurrentPage('products')}
          adminNavigation={{
            canViewProducts,
            onNavigateToUsers: () => setCurrentPage('users'),
            onNavigateToRolePermissions: () => setCurrentPage('role-permissions'),
            onNavigateToProfile: () => setCurrentPage('profile'),
            onLogout: handleLogout,
            onNavigateToUserRole: handleNavigateToUserRole,
            onNavigateToPage: handleNavigateToAdminPage,
          }}
        />
      );

    case 'products':
      return (
        <Products
          onCreateProduct={() => {
            setSelectedProduct(null);
            setCurrentPage('create-product');
          }}
          onEditProduct={(product) => {
            setSelectedProduct(product);
            setCurrentPage('product-form');
          }}
          onLogout={handleLogout}
          onNavigateToProfile={() => setCurrentPage('profile')}
          adminNavigation={{
            canViewProducts,
            readOnlyCatalog: true,
            onNavigateToUsers: () => setCurrentPage('users'),
            onNavigateToUserRole: handleNavigateToUserRole,
            onNavigateToPage: handleNavigateToAdminPage,
            onNavigateToRolePermissions: () =>
              setCurrentPage('role-permissions'),
          }}
        />
      );

    case 'product-form':
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
          adminNavigation={{
            canViewProducts,
            onNavigateToUsers: () => setCurrentPage('users'),
            onNavigateToRolePermissions: () =>
              setCurrentPage('role-permissions'),
            onNavigateToProfile: () => setCurrentPage('profile'),
            onLogout: handleLogout,
            onNavigateToUserRole: handleNavigateToUserRole,
            onNavigateToPage: handleNavigateToAdminPage,
          }}
        />
      );

    case 'users':
    case 'admins':
    default:
      return (
        <Users
          onLogout={handleLogout}
          onNavigateToProfile={() => setCurrentPage('profile')}
          onNavigateToRolePermissions={() =>
            setCurrentPage('role-permissions')
          }
          onNavigateToProducts={() => setCurrentPage('products')}
          onNavigateToUserRole={handleNavigateToUserRole}
          onNavigateToPage={handleNavigateToAdminPage}
          userRole={currentPage === 'admins' ? 'admin' : 'all'}
          canViewProducts={canViewProducts}
          permissions={permissions}
        />
      );
  }
}

export default App;