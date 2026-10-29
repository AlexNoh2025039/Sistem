
import { useEffect, useState } from 'react'
import Login from './pages/login'
import Register from './pages/register'
import Users from './pages/Users'
import CreateUser from './pages/createUser'
import Profile from './pages/profile'
import Products from './pages/Products'
import ProductForm from './pages/ProductForm'
import PublicProducts from './pages/PublicProducts'
import Cart from './pages/Cart'
import Orders from './pages/Orders'
import {
  getMyEffectivePermissions,
  type EffectivePermissions,
  type Product,
} from './services/api'
import './index.css'
import './styles/Design3D.css'

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

type StoredUser = {
  id: number
  username: string
  role: 'admin' | 'user' | 'provider'
}

function getStoredUser(): StoredUser | null {
  try {
    const storedUser = localStorage.getItem('user')
    if (!storedUser) return null

    const user = JSON.parse(storedUser) as StoredUser

    if (
      !user ||
      typeof user.id !== 'number' ||
      typeof user.username !== 'string' ||
      !['admin', 'user', 'provider'].includes(user.role)
    ) {
      return null
    }

    return user
  } catch {
    return null
  }
}

function getInitialPage(): Page {
  const user = getStoredUser()

  if (user?.role === 'admin') return 'users'
  if (user?.role === 'provider') return 'products'
  if (user?.role === 'user') return 'public-products'

  return 'login'
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(localStorage.getItem('token') && getStoredUser()),
  )

  const [currentPage, setCurrentPage] = useState<Page>(getInitialPage)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [permissions, setPermissions] =
    useState<EffectivePermissions | null>(null)
  const [permissionsLoading, setPermissionsLoading] = useState(false)
  const [permissionsError, setPermissionsError] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('token') || !getStoredUser()) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setIsAuthenticated(false)
      setCurrentPage('login')
      setPermissions(null)
      return
    }

    setIsAuthenticated(true)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setPermissions(null)
      setPermissionsLoading(false)
      setPermissionsError('')
      return
    }

    const token = localStorage.getItem('token')

    if (!token || !getStoredUser()) {
      setPermissions(null)
      setPermissionsLoading(false)
      setPermissionsError('La sesión no es válida.')
      return
    }

    let cancelled = false

    const loadPermissions = async () => {
      setPermissionsLoading(true)
      setPermissionsError('')

      try {
        const result = await getMyEffectivePermissions(token)

        if (cancelled) return

        setPermissions(result.permissions)
      } catch (error) {
        if (cancelled) return

        setPermissions(null)
        setPermissionsError(
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar los permisos.',
        )
      } finally {
        if (!cancelled) {
          setPermissionsLoading(false)
        }
      }
    }

    void loadPermissions()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setIsAuthenticated(false)
    setCurrentPage('login')
    setSelectedProduct(null)
    setPermissions(null)
    setPermissionsError('')
  }

  const handleLoginSuccess = () => {
    const user = getStoredUser()

    if (!user || !localStorage.getItem('token')) {
      handleLogout()
      return
    }

    setPermissions(null)
    setPermissionsError('')
    setCurrentPage(getInitialPage())
    setIsAuthenticated(true)
  }

  const handleUserCreated = () => {
    setCurrentPage('login')
    setIsAuthenticated(false)
    setPermissions(null)
  }

  const hasPermission = (
    permission: keyof EffectivePermissions,
  ): boolean => permissions?.[permission] === true

  if (!isAuthenticated) {
    if (currentPage === 'register') {
      return <Register onBackToLogin={() => setCurrentPage('login')} />
    }

    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onNavigateToRegister={() => setCurrentPage('register')}
      />
    )
  }

  const user = getStoredUser()

  if (!user || !localStorage.getItem('token')) {
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onNavigateToRegister={() => setCurrentPage('register')}
      />
    )
  }

  if (permissionsLoading) {
    return (
      <main className="app-permission-status">
        <h2>Cargando permisos...</h2>
        <p>Estamos verificando los accesos de tu cuenta.</p>
      </main>
    )
  }

  if (permissionsError || !permissions) {
    return (
      <main className="app-permission-status">
        <h2>No se pudieron cargar los permisos</h2>
        <p>{permissionsError || 'No hay permisos disponibles para esta sesión.'}</p>
        <button type="button" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </main>
    )
  }

  let requiredPermission: keyof EffectivePermissions | null = null

  switch (currentPage) {
    case 'users':
      requiredPermission = 'users.view'
      break

    case 'create-user':
      requiredPermission = 'users.create'
      break

    case 'products':
      requiredPermission = 'products.view'
      break

    case 'product-form':
      requiredPermission = selectedProduct
        ? 'products.edit'
        : 'products.publish'
      break

    case 'cart':
      requiredPermission = 'cart.manage'
      break

    case 'orders':
      requiredPermission = 'orders.view'
      break

    default:
      requiredPermission = null
  }

  const pageAllowedByRole =
    (user.role === 'admin' &&
      ['users', 'create-user', 'profile'].includes(currentPage)) ||
    (user.role === 'provider' &&
      ['products', 'product-form', 'profile'].includes(currentPage)) ||
    (user.role === 'user' &&
      ['public-products', 'cart', 'orders', 'profile'].includes(currentPage))

  const pageAllowedByPermission =
    requiredPermission === null || hasPermission(requiredPermission)

  if (!pageAllowedByRole || !pageAllowedByPermission) {
    const fallbackPage: Page =
      user.role === 'admin'
        ? 'users'
        : user.role === 'provider'
          ? 'products'
          : 'public-products'

    const fallbackPermission =
      fallbackPage === 'users'
        ? 'users.view'
        : fallbackPage === 'products'
          ? 'products.view'
          : null

    const fallbackAllowed =
      fallbackPermission === null || hasPermission(fallbackPermission)

    return (
      <main className="app-permission-status">
        <h2>Acceso no autorizado</h2>
        <p>
          Tu cuenta no tiene permiso para acceder a esta sección.
        </p>

        {fallbackAllowed && (
          <button
            type="button"
            onClick={() => {
              setSelectedProduct(null)
              setCurrentPage(fallbackPage)
            }}
          >
            Volver
          </button>
        )}

        <button type="button" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </main>
    )
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
        )

      case 'product-form':
        return (
          <ProductForm
            product={selectedProduct}
            onBack={() => setCurrentPage('products')}
            onSaved={() => {
              setSelectedProduct(null)
              setCurrentPage('products')
            }}
          />
        )

      case 'products':
      default:
        return (
          <Products
            onCreateProduct={() => {
              setSelectedProduct(null)
              setCurrentPage('product-form')
            }}
            onEditProduct={(product) => {
              setSelectedProduct(product)
              setCurrentPage('product-form')
            }}
            onLogout={handleLogout}
            onNavigateToProfile={() => setCurrentPage('profile')}
          />
        )
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
        )

      case 'cart':
        return (
          <Cart
            onBack={() => setCurrentPage('public-products')}
            onNavigateToOrders={() => setCurrentPage('orders')}
            onLogout={handleLogout}
          />
        )

      case 'orders':
        return (
          <Orders
            onBack={() => setCurrentPage('public-products')}
            onLogout={handleLogout}
          />
        )

      case 'public-products':
      default:
        return (
          <PublicProducts
            onLogout={handleLogout}
            onNavigate={(page) => setCurrentPage(page)}
          />
        )
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
      )

    case 'profile':
      return (
        <Profile
          onNavigateToUsers={() => setCurrentPage('users')}
          onNavigateToCreateUser={() => setCurrentPage('create-user')}
          onLogout={handleLogout}
        />
      )

    case 'users':
    default:
      return (
        <Users
          onLogout={handleLogout}
          onNavigateToProfile={() => setCurrentPage('profile')}
        />
      )
  }
}

export default App
