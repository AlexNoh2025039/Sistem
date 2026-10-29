
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
import type { Product } from './services/api'
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

  useEffect(() => {
    if (!localStorage.getItem('token') || !getStoredUser()) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setIsAuthenticated(false)
      setCurrentPage('login')
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setIsAuthenticated(false)
    setCurrentPage('login')
    setSelectedProduct(null)
  }

  const handleLoginSuccess = () => {
    const user = getStoredUser()

    if (!user || !localStorage.getItem('token')) {
      handleLogout()
      return
    }

    setCurrentPage(getInitialPage())
    setIsAuthenticated(true)
  }

  const handleUserCreated = () => {
    setCurrentPage('login')
    setIsAuthenticated(false)
  }

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
