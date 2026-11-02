import { useState } from 'react'
import type { UserRole } from '../services/api'
import './AdminSidebar.css'

export type AdminPage =
  | 'users'
  | 'providers'
  | 'admins'
  | 'create-user'
  | 'create-provider'
  | 'edit-provider'
  | 'products'
  | 'product-form'
  | 'role-permissions'
  | 'profile'
  | 'create-product'

interface AdminSidebarProps {
  activePage: AdminPage
  canViewProducts: boolean
  onNavigateToUsers?: () => void
  onNavigateToUserRole?: (role: UserRole | 'all') => void
  onNavigateToProducts?: () => void
  onNavigateToRolePermissions?: () => void
  onNavigateToProfile?: () => void
  onNavigateToPage?: (page: AdminPage) => void
  onLogout: () => void
}

function AdminSidebar({
  activePage,
  canViewProducts,
  onNavigateToUsers,
  onNavigateToUserRole,
  onNavigateToProducts,
  onNavigateToRolePermissions,
  onNavigateToProfile,
  onNavigateToPage,
  onLogout,
}: AdminSidebarProps) {
  const selectedPage = activePage
  const isCatalogPage =
    selectedPage === 'users' ||
    selectedPage === 'providers' ||
    selectedPage === 'admins' ||
    selectedPage === 'create-user' ||
    selectedPage === 'create-provider' ||
    selectedPage === 'edit-provider' ||
    selectedPage === 'create-product' ||
    selectedPage === 'products' ||
    selectedPage === 'product-form'
  const [catalogExpanded, setCatalogExpanded] = useState(isCatalogPage)

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <div className="admin-sidebar-brand-mark">S</div>
        <div className="admin-sidebar-brand-text">
          <strong>SYSDESK</strong>
          <span>CONTROL CENTER</span>
        </div>
      </div>

      <div className="admin-sidebar-label">MENÚ PRINCIPAL</div>

      <nav className="admin-sidebar-navigation" aria-label="Navegación principal">
        <div className="admin-sidebar-users-group">
          <button
            className={`admin-sidebar-item${isCatalogPage ? ' active' : ''}`}
            type="button"
            onClick={() => {
              setCatalogExpanded((expanded) => !expanded)
              if (!isCatalogPage) onNavigateToUsers?.()
            }}
            aria-expanded={catalogExpanded}
          >
            <span className="admin-sidebar-icon">▦</span>
            <span>Catálogo</span>
            <span
              className={`admin-sidebar-chevron${catalogExpanded ? ' expanded' : ''}`}
              aria-hidden="true"
            >
              ▸
            </span>
          </button>

          {catalogExpanded && (
            <div className="admin-sidebar-subnavigation">
              <button
                className={`admin-sidebar-subitem${selectedPage === 'users' || selectedPage === 'admins' ? ' active' : ''}`}
                type="button"
                onClick={() => onNavigateToUserRole?.('all')}
                aria-current={
                  selectedPage === 'users' ||
                  selectedPage === 'admins'
                    ? 'page'
                    : undefined
                }
              >
                <span>Usuario</span>
                {(selectedPage === 'users' || selectedPage === 'admins') && (
                  <span className="admin-sidebar-indicator" />
                )}
              </button>

              <button
                className={`admin-sidebar-subitem${selectedPage === 'providers' ? ' active' : ''}`}
                type="button"
                onClick={() => onNavigateToPage?.('providers')}
                aria-current={selectedPage === 'providers' ? 'page' : undefined}
              >
                <span>Proveedores</span>
                {selectedPage === 'providers' && (
                  <span className="admin-sidebar-indicator" />
                )}
              </button>

              <button
                className={`admin-sidebar-subitem${selectedPage === 'create-user' ? ' active' : ''}`}
                type="button"
                onClick={() => onNavigateToPage?.('create-user')}
                aria-current={
                  selectedPage === 'create-user' ? 'page' : undefined
                }
              >
                <span>Ficha cliente</span>
                {selectedPage === 'create-user' && (
                  <span className="admin-sidebar-indicator" />
                )}
              </button>

              <button
                className={`admin-sidebar-subitem${selectedPage === 'create-provider' ? ' active' : ''}`}
                type="button"
                onClick={() => onNavigateToPage?.('create-provider')}
                aria-current={
                  selectedPage === 'create-provider' ? 'page' : undefined
                }
              >
                <span>Ficha proveedor</span>
                {selectedPage === 'create-provider' && (
                  <span className="admin-sidebar-indicator" />
                )}
              </button>

              <button
                className={`admin-sidebar-subitem${selectedPage === 'create-product' ? ' active' : ''}`}
                type="button"
                onClick={() => onNavigateToPage?.('create-product')}
                aria-current={
                  selectedPage === 'create-product' ? 'page' : undefined
                }
              >
                <span>Ficha producto</span>
                {selectedPage === 'create-product' && (
                  <span className="admin-sidebar-indicator" />
                )}
              </button>

              {canViewProducts && (
                <button
                  className={`admin-sidebar-subitem${selectedPage === 'products' ? ' active' : ''}`}
                  type="button"
                  onClick={onNavigateToProducts}
                  aria-current={selectedPage === 'products' ? 'page' : undefined}
                >
                  <span>Productos</span>
                  {selectedPage === 'products' && (
                    <span className="admin-sidebar-indicator" />
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        <button
          className={`admin-sidebar-item${selectedPage === 'role-permissions' ? ' active' : ''}`}
          type="button"
          onClick={
            selectedPage === 'role-permissions'
              ? undefined
              : onNavigateToRolePermissions
          }
          aria-current={selectedPage === 'role-permissions' ? 'page' : undefined}
        >
          <span className="admin-sidebar-icon">▤</span>
          <span>Estado de roles</span>
          {selectedPage === 'role-permissions' && (
            <span className="admin-sidebar-indicator" />
          )}
        </button>

        <button
          className={`admin-sidebar-item${selectedPage === 'profile' ? ' active' : ''}`}
          type="button"
          onClick={selectedPage === 'profile' ? undefined : onNavigateToProfile}
          aria-current={selectedPage === 'profile' ? 'page' : undefined}
        >
          <span className="admin-sidebar-icon">◎</span>
          <span>Mi perfil</span>
          {selectedPage === 'profile' && <span className="admin-sidebar-indicator" />}
        </button>
      </nav>

      <div className="admin-sidebar-bottom">
        <button
          className="admin-sidebar-logout"
          type="button"
          onClick={onLogout}
        >
          <span>↪</span>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}

export default AdminSidebar
