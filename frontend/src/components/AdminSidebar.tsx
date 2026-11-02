import { useState } from 'react'
import type { UserRole } from '../services/api'
import './AdminSidebar.css'

export type AdminPage =
  | 'users'
  | 'providers'
  | 'admins'
  | 'create-user'
  | 'products'
  | 'product-form'
  | 'role-permissions'
  | 'profile'

interface AdminSidebarProps {
  activePage: AdminPage
  canViewProducts: boolean
  onNavigateToUsers?: () => void
  onNavigateToUserRole?: (role: UserRole) => void
  onNavigateToProducts?: () => void
  onNavigateToRolePermissions?: () => void
  onNavigateToProfile?: () => void
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
  onLogout,
}: AdminSidebarProps) {
  const selectedPage = activePage === 'create-user' ? 'users' : activePage
  const isUsersPage =
    selectedPage === 'users' ||
    selectedPage === 'providers' ||
    selectedPage === 'admins'
  const isProductsPage =
    selectedPage === 'products' || selectedPage === 'product-form'
  const [usersExpanded, setUsersExpanded] = useState(isUsersPage)

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
            className={`admin-sidebar-item${isUsersPage ? ' active' : ''}`}
            type="button"
            onClick={() => {
              setUsersExpanded((expanded) => !expanded)
              if (!isUsersPage) onNavigateToUsers?.()
            }}
            aria-expanded={usersExpanded}
          >
            <span className="admin-sidebar-icon">▦</span>
            <span>Usuarios</span>
            <span
              className={`admin-sidebar-chevron${usersExpanded ? ' expanded' : ''}`}
              aria-hidden="true"
            >
              ▸
            </span>
          </button>

          {usersExpanded && (
            <div className="admin-sidebar-subnavigation">
              {([
                ['user', 'Usuario', 'users'],
                ['provider', 'Proveedor', 'providers'],
                ['admin', 'Administrador', 'admins'],
              ] as const).map(([role, label, page]) => (
                <button
                  key={role}
                  className={`admin-sidebar-subitem${selectedPage === page ? ' active' : ''}`}
                  type="button"
                  onClick={() => onNavigateToUserRole?.(role)}
                  aria-current={selectedPage === page ? 'page' : undefined}
                >
                  <span>{label}</span>
                  {selectedPage === page && (
                    <span className="admin-sidebar-indicator" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {canViewProducts && (
          <button
            className={`admin-sidebar-item${isProductsPage ? ' active' : ''}`}
            type="button"
            onClick={selectedPage === 'products' ? undefined : onNavigateToProducts}
            aria-current={isProductsPage ? 'page' : undefined}
          >
            <span className="admin-sidebar-icon">▣</span>
            <span>Productos</span>
            {isProductsPage && <span className="admin-sidebar-indicator" />}
          </button>
        )}

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
