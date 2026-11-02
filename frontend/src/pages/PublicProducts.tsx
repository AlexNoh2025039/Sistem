
import { useCallback, useEffect, useState } from 'react'
import {
  getProducts,
  getPhotoUrl,
  addCartItem,
} from '../services/api'
import type { Product } from '../services/api'
import '../styles/Products.css'

type PublicProductsProps = {
  onLogout: () => void
  onNavigate: (page: 'profile' | 'cart' | 'orders') => void
}

function PublicProducts({
  onLogout,
  onNavigate,
}: PublicProductsProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cartLoading, setCartLoading] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const [cartError, setCartError] = useState('')
  const [quantities, setQuantities] = useState<Record<number, number>>({})

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const data = await getProducts()
      setProducts(data.filter((product) => product.activo))
    } catch (err) {
      console.error('Error al cargar productos:', err)
      setError(
        'No se pudieron cargar los productos. Verificá tu conexión e intentá nuevamente.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const handleAddToCart = async (product: Product) => {
    const token = localStorage.getItem('token')

    if (!token) {
      setCartError('Tu sesión expiró. Iniciá sesión nuevamente.')
      return
    }

    const quantity = quantities[product.id] ?? 1

    if (!Number.isInteger(quantity) || quantity < 1) {
      setCartError('Ingresá una cantidad válida.')
      return
    }

    if (quantity > product.existencias) {
      setCartError(
        `Solo hay ${product.existencias} unidades disponibles de ${product.nombre}.`,
      )
      return
    }

    try {
      setCartLoading(product.id)
      setCartError('')
      setNotice('')

      await addCartItem(product.id, quantity, token)

      setNotice(`${product.nombre} se agregó al carrito.`)
    } catch (err) {
      console.error('Error al agregar al carrito:', err)
      setCartError(
        err instanceof Error
          ? err.message
          : 'No se pudo agregar el producto al carrito.',
      )
    } finally {
      setCartLoading(null)
    }
  }

  const handleQuantityChange = (
    product: Product,
    value: string,
  ) => {
    const parsedValue = Number(value)

    if (value === '') {
      setQuantities((current) => ({
        ...current,
        [product.id]: 1,
      }))
      return
    }

    if (!Number.isInteger(parsedValue)) return

    setQuantities((current) => ({
      ...current,
      [product.id]: Math.max(
        1,
        Math.min(parsedValue, Math.max(product.existencias, 1)),
      ),
    }))
  }

  return (
    <main className="products-page">
      <header className="products-header">
        <div className="products-brand">
          <h1>Catálogo de productos</h1>
          <p>Encontrá lo que necesitás y compralo fácilmente.</p>
        </div>

        <nav className="products-nav" aria-label="Navegación principal">
          <button
            className="products-nav-button"
            type="button"
            onClick={() => onNavigate('profile')}
          >
            Mi perfil
          </button>

          <button
            className="products-nav-button"
            type="button"
            onClick={() => onNavigate('cart')}
          >
            Mi carrito
          </button>

          <button
            className="products-nav-button"
            type="button"
            onClick={() => onNavigate('orders')}
          >
            Mis pedidos
          </button>

          <button
            className="products-primary-button"
            type="button"
            onClick={onLogout}
          >
            Cerrar sesión
          </button>
        </nav>
      </header>

      <section className="products-welcome">
        <div>
          <h2>¡Bienvenido a la tienda!</h2>
          <p>Explorá el catálogo y agregá tus productos al carrito.</p>
        </div>
      </section>

      <section className="products-stats" aria-label="Resumen del catálogo">
        <article className="products-stat-card">
          <span>Productos disponibles</span>
          <strong>{products.length}</strong>
        </article>

        <article className="products-stat-card">
          <span>Unidades disponibles</span>
          <strong>
            {products.reduce(
              (total, product) => total + product.existencias,
              0,
            )}
          </strong>
        </article>
      </section>

      {notice && (
        <div className="products-alert products-alert--success" role="status">
          <p>{notice}</p>
          <button type="button" onClick={() => onNavigate('cart')}>
            Ir al carrito
          </button>
        </div>
      )}

      {cartError && (
        <div className="products-alert" role="alert">
          <p>{cartError}</p>
          <button type="button" onClick={() => setCartError('')}>
            Cerrar
          </button>
        </div>
      )}

      {loading && (
        <p className="products-empty-state" role="status">
          Cargando productos...
        </p>
      )}

      {!loading && error && (
        <div className="products-empty-state" role="alert">
          <p>{error}</p>
          <button
            className="products-primary-button"
            type="button"
            onClick={() => void loadProducts()}
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <div className="products-empty-state">
          <h2>No hay productos disponibles</h2>
          <p>Volvé a consultar más tarde.</p>
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <section className="products-catalog">
          <div className="products-section-heading">
            <h2>Todos los productos</h2>
            <p>Seleccioná la cantidad y agregá lo que querás comprar.</p>
          </div>

          <div className="products-grid">
            {products.map((product) => {
              const photoUrl = getPhotoUrl(product.imagen_url)
              const available = product.existencias > 0
              const quantity = quantities[product.id] ?? 1

              return (
                <article className="product-card" key={product.id}>
                  {photoUrl ? (
                    <img
                      className="product-card-image"
                      src={photoUrl}
                      alt={product.nombre}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none'
                      }}
                    />
                  ) : (
                    <div className="product-card-image product-card-placeholder">
                      Sin imagen
                    </div>
                  )}

                  <div className="product-card-content">
                    <h3>{product.nombre}</h3>

                    {product.marca && <p>Marca: {product.marca}</p>}
                    {product.modelo && <p>Modelo: {product.modelo}</p>}
                    {product.categoria && (
                      <p>Categoría: {product.categoria}</p>
                    )}

                    {product.descripcion && (
                      <p className="product-card-description">
                        {product.descripcion}
                      </p>
                    )}

                    <div className="product-card-bottom">
                      <strong className="product-card-price">
                        Q{Number(product.precio).toFixed(2)}
                      </strong>

                      <span
                        className={
                          available
                            ? 'product-availability'
                            : 'product-availability product-availability--out'
                        }
                      >
                        {available
                          ? `${product.existencias} disponibles`
                          : 'Agotado'}
                      </span>
                    </div>

                    {available && (
                      <div className="product-card-actions">
                        <label className="product-quantity-label">
                          Cantidad
                          <input
                            type="number"
                            min={1}
                            max={product.existencias}
                            step={1}
                            value={quantity}
                            onChange={(event) =>
                              handleQuantityChange(product, event.target.value)
                            }
                          />
                        </label>

                        <button
                          className="products-primary-button"
                          type="button"
                          disabled={cartLoading === product.id}
                          onClick={() => void handleAddToCart(product)}
                        >
                          {cartLoading === product.id
                            ? 'Agregando...'
                            : 'Agregar al carrito'}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}
    </main>
  )
}

export default PublicProducts
