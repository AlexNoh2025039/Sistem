
import { useCallback, useEffect, useState } from 'react'
import {
  getMyProducts,
  getPhotoUrl,
  deactivateProduct,
  type Product,
} from '../services/api'
import '../styles/Products.css'

interface ProductsProps {
  onCreateProduct: () => void
  onEditProduct: (product: Product) => void
  onLogout: () => void
  onNavigateToProfile: () => void
}

function Products({
  onCreateProduct,
  onEditProduct,
  onLogout,
  onNavigateToProfile,
}: ProductsProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [deactivatingId, setDeactivatingId] = useState<number | null>(null)

  const loadProducts = useCallback(async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      setError('Tu sesión ha expirado. Iniciá sesión nuevamente.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      const data = await getMyProducts(token)
      setProducts(data)
    } catch (err) {
      console.error('Error al cargar tus productos:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar tus productos.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  const handleDeactivate = async (product: Product) => {
    const confirmed = window.confirm(
      `¿Querés desactivar "${product.nombre}"? Ya no aparecerá en el catálogo público.`,
    )

    if (!confirmed) return

    const token = localStorage.getItem('token')

    if (!token) {
      setError('Tu sesión ha expirado. Iniciá sesión nuevamente.')
      return
    }

    try {
      setDeactivatingId(product.id)
      setError('')
      setMessage('')

      await deactivateProduct(product.id, token)

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id ? { ...item, activo: false } : item,
        ),
      )

      setMessage('Producto desactivado correctamente.')
    } catch (err) {
      console.error('Error al desactivar producto:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo desactivar el producto.',
      )
    } finally {
      setDeactivatingId(null)
    }
  }

  const activeProducts = products.filter((product) => product.activo)

  const availableProducts = activeProducts.filter(
    (product) => Number(product.existencias) > 0,
  ).length

  const unavailableProducts = activeProducts.length - availableProducts

  const totalCategories = new Set(
    activeProducts
      .map((product) => product.categoria?.trim())
      .filter((category): category is string => Boolean(category)),
  ).size

  return (
    <main className="products-page">
      <header className="products-header">
        <div className="products-brand">
          <div className="products-brand-icon">P</div>
          <div>
            <h1>Mi inventario</h1>
            <p>Administrá los productos de tu negocio.</p>
          </div>
        </div>

        <nav className="products-nav">
          <button
            type="button"
            className="products-nav-button"
            onClick={onNavigateToProfile}
          >
            Mi cuenta
          </button>

          <button
            type="button"
            className="products-nav-button products-logout-button"
            onClick={onLogout}
          >
            Cerrar sesión
          </button>
        </nav>
      </header>

      <section className="products-welcome">
        <div>
          <span className="products-eyebrow">PANEL DEL PROVEEDOR</span>
          <h2>Administrá tus productos</h2>
          <p>
            Creá productos, actualizá sus datos y controlá las existencias
            de tu negocio.
          </p>
        </div>

        <div className="products-welcome-actions">
          <button
            type="button"
            className="products-nav-button"
            onClick={() => void loadProducts()}
            disabled={loading}
          >
            ↻ Actualizar
          </button>

          <button
            type="button"
            className="products-primary-button"
            onClick={onCreateProduct}
          >
            + Nuevo producto
          </button>
        </div>
      </section>

      <section className="products-stats">
        <article className="products-stat-card">
          <span className="products-stat-icon">▦</span>
          <div>
            <p>Productos activos</p>
            <strong>{activeProducts.length}</strong>
          </div>
        </article>

        <article className="products-stat-card">
          <span className="products-stat-icon">✓</span>
          <div>
            <p>Con existencias</p>
            <strong>{availableProducts}</strong>
          </div>
        </article>

        <article className="products-stat-card">
          <span className="products-stat-icon">□</span>
          <div>
            <p>Agotados</p>
            <strong>{unavailableProducts}</strong>
          </div>
        </article>

        <article className="products-stat-card">
          <span className="products-stat-icon">◇</span>
          <div>
            <p>Categorías</p>
            <strong>{totalCategories}</strong>
          </div>
        </article>
      </section>

      {error && (
        <div className="products-alert products-alert-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="products-nav-button"
            onClick={() => void loadProducts()}
          >
            Intentar de nuevo
          </button>
        </div>
      )}

      {message && (
        <div className="products-alert" role="status">
          {message}
        </div>
      )}

      <section className="products-catalog">
        <div className="products-catalog-header">
          <div>
            <h2>Mis productos</h2>
            <p>
              {products.length}{' '}
              {products.length === 1
                ? 'producto registrado'
                : 'productos registrados'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="products-empty-state">
            <div className="products-loader" />
            <p>Cargando tu inventario...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="products-empty-state">
            <span className="products-empty-icon">▦</span>
            <h3>Aún no tenés productos</h3>
            <p>Creá tu primer producto para comenzar a publicarlo.</p>
            <button
              type="button"
              className="products-primary-button"
              onClick={onCreateProduct}
            >
              + Crear producto
            </button>
          </div>
        ) : (
          <div className="products-grid">
            {products.map((product) => {
              const photoUrl = getPhotoUrl(product.imagen_url)
              const inStock = Number(product.existencias) > 0

              return (
                <article className="product-card" key={product.id}>
                  <div className="product-card-image">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={product.nombre}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="product-image-placeholder">
                        <span>▧</span>
                        <small>Sin imagen</small>
                      </div>
                    )}

                    <span
                      className={`product-status ${product.activo && inStock
                        ? 'product-status-active'
                        : 'product-status-inactive'
                        }`}
                    >
                      {!product.activo
                        ? 'Inactivo'
                        : inStock
                          ? 'Disponible'
                          : 'Agotado'}
                    </span>
                  </div>

                  <div className="product-card-content">
                    <div className="product-card-category">
                      {product.categoria || 'Sin categoría'}
                    </div>

                    <h3>{product.nombre}</h3>

                    <p className="product-card-description">
                      {product.descripcion || 'Sin descripción disponible.'}
                    </p>

                    <div className="product-card-details">
                      {product.marca && <span>Marca: {product.marca}</span>}
                      {product.modelo && <span>Modelo: {product.modelo}</span>}
                    </div>

                    <div className="product-card-bottom">
                      <div>
                        <span className="product-price-label">Precio</span>
                        <strong className="product-price">
                          Q
                          {Number(product.precio).toLocaleString('es-GT', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </strong>
                      </div>

                      <div className="product-stock">
                        <span>Existencias</span>
                        <strong>{product.existencias}</strong>
                      </div>
                    </div>

                    <div className="product-card-actions">
                      {product.activo && (
                        <>
                          <button
                            type="button"
                            className="products-nav-button"
                            onClick={() => onEditProduct(product)}
                          >
                            Editar
                          </button>

                          <button
                            type="button"
                            className="products-nav-button"
                            disabled={deactivatingId === product.id}
                            onClick={() => void handleDeactivate(product)}
                          >
                            {deactivatingId === product.id
                              ? 'Desactivando...'
                              : 'Desactivar'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

export default Products
