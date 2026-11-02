import './AdminSidebar.css'

export type AdminPage =
  | 'users'
  | 'create-user'
  | 'products'
  | 'product-form'
  | 'role-permissions'
  | 'profile'

interface AdminSidebarProps {
  activePage: AdminPage
  canViewProducts: boolean
  onNavigateToUsers?: () => void
  onNavigateToProducts?: () => void
  onNavigateToRolePermissions?: () => void
  onNavigateToProfile?: () => void
  onLogout: () => void
}

function AdminSidebar({
  activePage,
  canViewProducts,
  onNavigateToUsers,
  onNavigateToProducts,
  onNavigateToRolePermissions,
  onNavigateToProfile,
  onLogout,
}: AdminSidebarProps) {
  const selectedPage = activePage === 'create-user' ? 'users' : activePage
  const isProductsPage =
    selectedPage === 'products' || selectedPage === 'product-form'

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
        <button
          className={`admin-sidebar-item${selectedPage === 'users' ? ' active' : ''}`}
          type="button"
          onClick={activePage === 'users' ? undefined : onNavigateToUsers}
          aria-current={selectedPage === 'users' ? 'page' : undefined}
        >
          <span className="admin-sidebar-icon">▦</span>
          <span>Usuarios</span>
          {selectedPage === 'users' && <span className="admin-sidebar-indicator" />}
        </button>

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
