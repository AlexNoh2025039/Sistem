
import { useCallback, useEffect, useState } from 'react'
import { getMyOrders } from '../services/api'
import type { Order } from '../services/api'
import '../styles/Products.css'

type OrdersProps = {
  onBack: () => void
  onLogout: () => void
}

function formatPrice(value: string | number): string {
  return Number(value).toFixed(2)
}

function formatDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('es-GT', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function getStatusLabel(status: Order['estado']): string {
  const labels: Record<Order['estado'], string> = {
    confirmado: 'Confirmado',
    enviado: 'Enviado',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
  }

  return labels[status] ?? status
}

function Orders({ onBack, onLogout }: OrdersProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadOrders = useCallback(async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      setError('Tu sesión expiró. Iniciá sesión nuevamente.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')

      const data = await getMyOrders(token)
      setOrders(data)
    } catch (err) {
      console.error('Error al cargar los pedidos:', err)
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el historial de pedidos.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  return (
    <main className="products-page">
      <header className="products-header">
        <div className="products-brand">
          <h1>Mis pedidos</h1>
          <p>Consultá tus compras y revisá sus detalles.</p>
        </div>

        <nav className="products-nav" aria-label="Navegación principal">
          <button
            className="products-nav-button"
            type="button"
            onClick={onBack}
          >
            Volver al catálogo
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

      <section className="products-stats" aria-label="Resumen de pedidos">
        <article className="products-stat-card">
          <span>Total de pedidos</span>
          <strong>{orders.length}</strong>
        </article>

        <article className="products-stat-card">
          <span>Pedidos confirmados</span>
          <strong>
            {orders.filter((order) => order.estado === 'confirmado').length}
          </strong>
        </article>

        <article className="products-stat-card">
          <span>Pedidos entregados</span>
          <strong>
            {orders.filter((order) => order.estado === 'entregado').length}
          </strong>
        </article>
      </section>

      {error && (
        <div className="products-alert" role="alert">
          <p>{error}</p>
          <button
            className="products-primary-button"
            type="button"
            onClick={() => void loadOrders()}
          >
            Reintentar
          </button>
        </div>
      )}

      {loading ? (
        <div className="products-empty-state" role="status">
          Cargando tus pedidos...
        </div>
      ) : !error && orders.length === 0 ? (
        <div className="products-empty-state">
          <h2>Todavía no tenés pedidos</h2>
          <p>Cuando confirmés tu primera compra, aparecerá aquí.</p>
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
            <h2>Historial de compras</h2>
            <p>Tus pedidos más recientes aparecerán primero.</p>
          </div>

          <div className="orders-list">
            {orders.map((order) => (
              <article className="order-card" key={order.id}>
                <div className="order-card-header">
                  <div>
                    <h3>Pedido #{order.id}</h3>
                    <p>{formatDate(order.creado_en)}</p>
                  </div>

                  <span
                    className={`order-status order-status--${order.estado}`}
                  >
                    {getStatusLabel(order.estado)}
                  </span>
                </div>

                <div className="order-items">
                  {order.items?.length ? (
                    order.items.map((item, index) => (
                      <div
                        className="order-item"
                        key={`${order.id}-${item.producto_id ?? 'eliminado'}-${index}`}
                      >
                        <div>
                          <strong>{item.nombre_producto}</strong>
                          <p>
                            {item.cantidad} × Q
                            {formatPrice(item.precio_unitario)}
                          </p>
                        </div>

                        <strong>Q{formatPrice(item.subtotal)}</strong>
                      </div>
                    ))
                  ) : (
                    <p>No hay detalles disponibles para este pedido.</p>
                  )}
                </div>

                <div className="order-card-total">
                  <span>Total del pedido</span>
                  <strong>Q{formatPrice(order.total)}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}

export default Orders
