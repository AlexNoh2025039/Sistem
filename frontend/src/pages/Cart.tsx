
import { useCallback, useEffect, useState } from 'react'
import {
  getCart,
  getPhotoUrl,
  addCartItem,
  removeCartItem,
  checkout,
} from '../services/api'
import type { CartItem } from '../services/api'
import '../styles/Products.css'

type CartProps = {
  onBack: () => void
  onNavigateToOrders: () => void
  onLogout: () => void
}

function formatPrice(value: string | number): string {
  return Number(value).toFixed(2)
}

function Cart({ onBack, onNavigateToOrders, onLogout }: CartProps) {
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyProduct, setBusyProduct] = useState<number | null>(null)
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadCart = useCallback(async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      setError('Tu sesión expiró. Iniciá sesión nuevamente.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')
      const data = await getCart(token)
      setItems(data)
    } catch (err) {
      console.error('Error al cargar el carrito:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar tu carrito.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCart()
  }, [loadCart])

  const total = items.reduce(
    (sum, item) => sum + Number(item.subtotal),
    0,
  )

  const changeQuantity = async (
    item: CartItem,
    newQuantity: number,
  ) => {
    const token = localStorage.getItem('token')
    if (!token) {
      setError('Tu sesión expiró. Iniciá sesión nuevamente.')
      return
    }

    if (newQuantity < 0 || newQuantity > item.existencias) return

    try {
      setBusyProduct(item.producto_id)
      setError('')
      setNotice('')

      await removeCartItem(item.producto_id, token)

      if (newQuantity > 0) {
        await addCartItem(item.producto_id, newQuantity, token)
      }

      await loadCart()
    } catch (err) {
      console.error('Error al actualizar el carrito:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar el producto.',
      )
      await loadCart()
    } finally {
      setBusyProduct(null)
    }
  }

  const handleCheckout = async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      setError('Tu sesión expiró. Iniciá sesión nuevamente.')
      return
    }

    if (items.length === 0) {
      setError('Agregá al menos un producto antes de comprar.')
      return
    }

    try {
      setCheckingOut(true)
      setError('')
      setNotice('')

      const result = await checkout(token)

      setItems([])
      setNotice(
        result.message || '¡Compra confirmada correctamente!',
      )
    } catch (err) {
      console.error('Error al confirmar la compra:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo confirmar la compra.',
      )
      await loadCart()
    } finally {
      setCheckingOut(false)
    }
  }

  return (
    <main className="products-page">
      <header className="products-header">
        <div className="products-brand">
          <h1>Mi carrito</h1>
          <p>Revisá tus productos antes de confirmar la compra.</p>
        </div>

        <nav className="products-nav" aria-label="Navegación principal">
          <button className="products-nav-button" type="button" onClick={onBack}>
            Seguir comprando
          </button>
          <button
            className="products-nav-button"
            type="button"
            onClick={onNavigateToOrders}
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

      {notice && (
        <div className="products-alert products-alert--success" role="status">
          <p>{notice}</p>
          <button type="button" onClick={onNavigateToOrders}>
            Ver mis pedidos
          </button>
        </div>
      )}

      {error && (
        <div className="products-alert" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setError('')}>
            Cerrar
          </button>
        </div>
      )}

      {loading ? (
        <div className="products-empty-state" role="status">
          Cargando tu carrito...
        </div>
      ) : items.length === 0 ? (
        <div className="products-empty-state">
          <h2>Tu carrito está vacío</h2>
          <p>Cuando agregués productos, aparecerán aquí.</p>
          <button
            className="products-primary-button"
            type="button"
            onClick={onBack}
          >
            Explorar productos
          </button>
        </div>
      ) : (
        <section className="products-catalog">
          <div className="products-section-heading">
            <h2>Productos seleccionados</h2>
            <p>{items.length} tipo(s) de producto en tu carrito.</p>
          </div>

          <div className="products-grid">
            {items.map((item) => {
              const photoUrl = getPhotoUrl(item.imagen_url)

              return (
                <article className="product-card" key={item.producto_id}>
                  {photoUrl ? (
                    <img
                      className="product-card-image"
                      src={photoUrl}
                      alt={item.nombre}
                      loading="lazy"
                    />
                  ) : (
                    <div className="product-card-image product-card-placeholder">
                      Sin imagen
                    </div>
                  )}

                  <div className="product-card-content">
                    <h3>{item.nombre}</h3>
                    <p>Precio unitario: Q{formatPrice(item.precio)}</p>
                    <p>Disponible: {item.existencias}</p>

                    <div className="cart-quantity-controls">
                      <button
                        type="button"
                        aria-label={`Quitar una unidad de ${item.nombre}`}
                        disabled={busyProduct === item.producto_id}
                        onClick={() =>
                          void changeQuantity(item, item.cantidad - 1)
                        }
                      >
                        −
                      </button>

                      <span aria-label="Cantidad">{item.cantidad}</span>

                      <button
                        type="button"
                        aria-label={`Agregar una unidad de ${item.nombre}`}
                        disabled={
                          busyProduct === item.producto_id ||
                          item.cantidad >= item.existencias
                        }
                        onClick={() =>
                          void changeQuantity(item, item.cantidad + 1)
                        }
                      >
                        +
                      </button>
                    </div>

                    <div className="product-card-bottom">
                      <strong>
                        Subtotal: Q{formatPrice(item.subtotal)}
                      </strong>
                    </div>

                    <button
                      className="product-deactivate-button"
                      type="button"
                      disabled={busyProduct === item.producto_id}
                      onClick={() => void changeQuantity(item, 0)}
                    >
                      {busyProduct === item.producto_id
                        ? 'Actualizando...'
                        : 'Eliminar del carrito'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          <section className="cart-summary">
            <h2>Resumen de compra</h2>
            <p>
              Total: <strong>Q{formatPrice(total)}</strong>
            </p>
            <button
              className="products-primary-button"
              type="button"
              disabled={checkingOut || items.length === 0}
              onClick={() => void handleCheckout()}
            >
              {checkingOut ? 'Procesando compra...' : 'Confirmar compra'}
            </button>
            <p className="cart-summary-note">
              La compra se confirmará si tenés saldo suficiente y los productos
              siguen disponibles.
            </p>
          </section>
        </section>
      )}
    </main>
  )
}

export default Cart
