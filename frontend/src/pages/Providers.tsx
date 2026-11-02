import { useCallback, useEffect, useState } from 'react'
import {
  deleteAdminProvider,
  getAdminProviders,
  type AdminProvider,
  type UserRole,
} from '../services/api'
import AdminSidebar, { type AdminPage } from '../components/AdminSidebar'
import '../styles/Users.css'

interface ProvidersProps {
  canViewProducts: boolean
  onLogout: () => void
  onNavigateToProfile: () => void
  onNavigateToRolePermissions: () => void
  onNavigateToProducts: () => void
  onNavigateToUserRole: (role: UserRole | 'all') => void
  onNavigateToPage: (page: AdminPage) => void
  onEditProvider: (provider: AdminProvider) => void
}

function Providers({
  canViewProducts,
  onLogout,
  onNavigateToProfile,
  onNavigateToRolePermissions,
  onNavigateToProducts,
  onNavigateToUserRole,
  onNavigateToPage,
  onEditProvider,
}: ProvidersProps) {
  const [providers, setProviders] = useState<AdminProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadProviders = useCallback(async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      setError('No hay una sesión activa. Iniciá sesión nuevamente.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      setProviders(await getAdminProviders(token))
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No se pudieron cargar las fichas de proveedor.',
      )
      setProviders([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDeleteProvider = async (provider: AdminProvider) => {
    const providerName = provider.nombre_proveedor || provider.nombre_empresa || 'este proveedor'
    if (
      !window.confirm(
        `¿Querés eliminar la ficha de "${providerName}"? Los productos asociados no se eliminarán y primero tendrás que reasignarlos o eliminarlos.`,
      )
    ) {
      return
    }

    const token = localStorage.getItem('token')
    if (!token) {
      setError('No hay una sesión activa. Iniciá sesión nuevamente.')
      return
    }

    setDeletingId(provider.id)
    setError('')
    setMessage('')

    try {
      const result = await deleteAdminProvider(provider.id, token)
      setProviders((current) =>
        current.filter((item) => item.id !== provider.id),
      )
      setMessage(result.message)
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'No se pudo eliminar la ficha del proveedor.',
      )
    } finally {
      setDeletingId(null)
    }
  }

  useEffect(() => {
    void loadProviders()
  }, [loadProviders])

  const searchText = search.trim().toLowerCase()
  const filteredProviders = providers.filter((provider) =>
    [
      provider.nombre_proveedor,
      provider.nombre_empresa,
      provider.nit,
      provider.correo,
      provider.contacto,
      provider.telefono,
      provider.telefono_2,
      provider.direccion,
      String(provider.id),
    ].some((value) => value?.toLowerCase().includes(searchText)),
  )

  return (
    <main className="users-page">
      <AdminSidebar
        activePage="providers"
        canViewProducts={canViewProducts}
        onNavigateToUsers={() => onNavigateToUserRole('all')}
        onNavigateToUserRole={onNavigateToUserRole}
        onNavigateToProducts={onNavigateToProducts}
        onNavigateToRolePermissions={onNavigateToRolePermissions}
        onNavigateToProfile={onNavigateToProfile}
        onNavigateToPage={onNavigateToPage}
        onLogout={onLogout}
      />

      <section className="users-main">
        <header className="users-topbar">
          <div className="users-breadcrumb">
            <span>Panel</span>
            <span className="users-breadcrumb-separator">/</span>
            <strong>Proveedores</strong>
          </div>
        </header>

        <div className="users-content">
          <section className="users-table-card">
            <div className="users-table-header">
              <div>
                <span className="users-section-eyebrow">DIRECTORIO COMERCIAL</span>
                <h2>Proveedores registrados</h2>
                <p>
                  Consultá las fichas comerciales creadas para asociarlas a los
                  productos.
                </p>
              </div>
              <div className="users-header-actions">
                <button
                  className="users-primary-button"
                  type="button"
                  onClick={() => onNavigateToPage('create-provider')}
                >
                  <span aria-hidden="true">＋</span>
                  Crear ficha proveedor
                </button>
                <button
                  className="users-refresh"
                  type="button"
                  onClick={() => void loadProviders()}
                  disabled={loading}
                >
                  <span
                    className={
                      loading
                        ? 'users-refresh-icon spinning'
                        : 'users-refresh-icon'
                    }
                  >
                    ↻
                  </span>
                  {loading ? 'Actualizando...' : 'Actualizar'}
                </button>
              </div>
            </div>

            {message && (
              <p className="users-alert users-alert-success" role="status">
                <span>✓</span>
                {message}
              </p>
            )}

            <div className="users-table-toolbar">
              <label className="users-search">
                <span className="users-search-icon">⌕</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por proveedor, empresa, NIT o correo..."
                  aria-label="Buscar proveedores"
                />
                {search && (
                  <button
                    type="button"
                    className="users-search-clear"
                    onClick={() => setSearch('')}
                    aria-label="Limpiar búsqueda"
                  >
                    ×
                  </button>
                )}
              </label>
              <span className="users-results-count">
                <strong>{filteredProviders.length}</strong> de {providers.length}{' '}
                registros
              </span>
            </div>

            {error ? (
              <p className="users-alert users-alert-error" role="alert">
                <span>!</span>
                {error}
              </p>
            ) : loading ? (
              <div className="users-empty">
                <span className="users-loading-spinner" />
                <strong>Cargando proveedores</strong>
              </div>
            ) : filteredProviders.length === 0 ? (
              <div className="users-empty">
                <strong>
                  {search
                    ? 'No encontramos proveedores con esa búsqueda.'
                    : 'Aún no hay fichas de proveedor.'}
                </strong>
                <span>
                  {search
                    ? 'Probá con otro nombre, empresa, NIT o correo.'
                    : 'Creá una ficha para poder asociar productos al proveedor.'}
                </span>
              </div>
            ) : (
              <div className="users-table-wrapper">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Proveedor</th>
                      <th>Empresa</th>
                      <th>NIT</th>
                      <th>Correo</th>
                      <th>Contacto</th>
                      <th>Teléfonos</th>
                      <th>Dirección</th>
                      <th>Fecha de registro</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProviders.map((provider) => (
                      <tr key={provider.id}>
                        <td>
                          <span className="users-id">#{provider.id}</span>
                        </td>
                        <td>
                          <div className="users-table-user">
                            <div className="users-table-avatar">
                              {(provider.nombre_proveedor ||
                                provider.nombre_empresa ||
                                'P')
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <div className="users-table-user-info">
                              <strong>
                                {provider.nombre_proveedor ||
                                  'Proveedor sin nombre'}
                              </strong>
                              <span>Ficha comercial</span>
                            </div>
                          </div>
                        </td>
                        <td>{provider.nombre_empresa || '—'}</td>
                        <td>{provider.nit || '—'}</td>
                        <td>{provider.correo || '—'}</td>
                        <td>{provider.contacto || '—'}</td>
                        <td>
                          {[provider.telefono, provider.telefono_2]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </td>
                        <td>{provider.direccion || '—'}</td>
                        <td>
                          {Number.isNaN(Date.parse(provider.creado_en))
                            ? '—'
                            : new Date(provider.creado_en).toLocaleDateString()}
                        </td>
                        <td>
                          <div className="users-provider-actions">
                            <button
                              className="users-edit-button"
                              type="button"
                              onClick={() => onEditProvider(provider)}
                              aria-label={`Editar ${provider.nombre_proveedor || provider.nombre_empresa || 'proveedor'}`}
                              title="Editar ficha"
                              disabled={deletingId === provider.id}
                            >
                              <svg
                                aria-hidden="true"
                                viewBox="0 0 24 24"
                                className="users-edit-icon"
                              >
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
                              </svg>
                              <span className="users-visually-hidden">
                                Editar proveedor
                              </span>
                            </button>
                            <button
                              className="users-delete"
                              type="button"
                              onClick={() => void handleDeleteProvider(provider)}
                              disabled={deletingId !== null}
                            >
                              <span>×</span>
                              {deletingId === provider.id
                                ? 'Eliminando...'
                                : 'Eliminar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <footer className="users-table-footer">
              <span>
                Mostrando <strong>{filteredProviders.length}</strong> proveedores
              </span>
              <span className="users-table-footer-status">
                <span className="users-status-dot" />
                Fichas comerciales
              </span>
            </footer>
          </section>

          <footer className="users-footer">
            <span>SYSDESK</span>
            <span>·</span>
            <span>Directorio de proveedores</span>
          </footer>
        </div>
      </section>
    </main>
  )
}

export default Providers
