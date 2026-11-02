
import { Fragment, useEffect, useState } from 'react'
import {
  getRolePermissions,
  getUserPermissions,
  updateUserPermissions,
} from '../services/api'
import type {
  RolePermission,
  UserRole,
  UserPermission,
} from '../services/api'
import '../styles/RolePermissions.css'

interface RolePermissionsProps {
  onNavigateToUsers: () => void
  onNavigateToProfile: () => void
  onLogout: () => void
}

interface IndividualUser {
  id: number
  username: string
  role: UserRole
}

const roles: UserRole[] = ['admin', 'user', 'provider']

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  user: 'Usuario',
  provider: 'Proveedor',
}

const permissionLabels: Record<string, string> = {
  'users.view': 'Ver usuarios',
  'users.create': 'Crear usuarios',
  'users.edit': 'Editar usuarios',
  'users.delete': 'Eliminar usuarios',
  'users.role.change': 'Cambiar roles',
  'permissions.manage': 'Administrar permisos',
  'products.view': 'Ver productos',
  'products.publish': 'Crear y publicar productos',
  'products.edit': 'Editar productos',
  'products.deactivate': 'Desactivar productos',
  'provider.profile.manage': 'Administrar perfil comercial',
  'cart.manage': 'Administrar carrito',
  'orders.create': 'Crear pedidos',
  'orders.view': 'Ver pedidos',
}

const rolePermissionKeys: Record<UserRole, string[]> = {
  admin: [
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
    'users.role.change',
    'permissions.manage',
    'products.view',
    'products.publish',
    'products.edit',
    'products.deactivate',
    'orders.view',
  ],
  user: [
    'products.view',
    'cart.manage',
    'orders.create',
    'orders.view',
  ],
  provider: [
    'products.view',
    'products.publish',
    'products.edit',
    'products.deactivate',
    'provider.profile.manage',
    'orders.view',
  ],
}

const permissionGroups = [
  {
    title: 'Usuarios y administración',
    keys: [
      'users.view',
      'users.create',
      'users.edit',
      'users.delete',
      'users.role.change',
      'permissions.manage',
    ],
  },
  {
    title: 'Productos',
    keys: [
      'products.view',
      'products.publish',
      'products.edit',
      'products.deactivate',
    ],
  },
  {
    title: 'Perfil comercial',
    keys: ['provider.profile.manage'],
  },
  {
    title: 'Compras y pedidos',
    keys: ['cart.manage', 'orders.create', 'orders.view'],
  },
]

function RolePermissions({
  onNavigateToUsers,
  onNavigateToProfile,
  onLogout,
}: RolePermissionsProps) {
  const [permissions, setPermissions] = useState<RolePermission[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [userId, setUserId] = useState('')
  const [individualMode, setIndividualMode] = useState(false)
  const [individualUser, setIndividualUser] =
    useState<IndividualUser | null>(null)

  const [individualPermissions, setIndividualPermissions] =
    useState<UserPermission[]>([])
  const [originalIndividualPermissions, setOriginalIndividualPermissions] =
    useState<UserPermission[]>([])
  const [individualLoading, setIndividualLoading] = useState(false)

  let currentUser: { username?: string } | null = null

  try {
    currentUser = JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    currentUser = null
  }

  const usernameInitial =
    currentUser?.username?.charAt(0).toUpperCase() || 'A'

  const isPermissionAllowedForRole = (
    role: UserRole,
    permissionKey: string,
  ) => rolePermissionKeys[role].includes(permissionKey)

  const loadPermissions = async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      setError('No hay una sesión activa.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const data = await getRolePermissions(token)
      setPermissions(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los permisos.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPermissions()
  }, [])

  const getPermission = (role: UserRole, permissionKey: string) =>
    permissions.find(
      (item) =>
        item.role === role &&
        item.permission_key === permissionKey,
    )

  const getIndividualPermission = (permissionKey: string) =>
    individualPermissions.find(
      (item) => item.permission_key === permissionKey,
    )

  const handleIndividualChange = (
    permissionKey: string,
    allowed: boolean,
  ) => {
    if (!individualUser || saving || !editing) return

    if (
      !isPermissionAllowedForRole(
        individualUser.role,
        permissionKey,
      )
    ) {
      return
    }

    setIndividualPermissions((previous) =>
      previous.map((permission) =>
        permission.permission_key === permissionKey
          ? {
              ...permission,
              override_allowed: allowed,
              effective_allowed: allowed,
              source: 'individual',
            }
          : permission,
      ),
    )

    setMessage('')
    setError('')
  }

  const handleSearchUser = async () => {
    const token = localStorage.getItem('token')
    const id = Number(userId.trim())

    setError('')
    setMessage('')
    setEditing(false)
    setIndividualMode(false)
    setIndividualUser(null)
    setIndividualPermissions([])
    setOriginalIndividualPermissions([])

    if (!token) {
      setError('No hay una sesión activa.')
      return
    }

    if (!userId.trim() || !Number.isInteger(id) || id <= 0) {
      setError('Ingresa un ID de usuario válido.')
      return
    }

    setIndividualLoading(true)

    try {
      const data = await getUserPermissions(id, token)

      if (!data.user || !roles.includes(data.user.role)) {
        throw new Error('El usuario tiene un rol no válido.')
      }

      const allowedKeys = rolePermissionKeys[data.user.role]

      const filteredPermissions = data.permissions.filter((permission) =>
        allowedKeys.includes(permission.permission_key),
      )

      setIndividualUser(data.user)
      setIndividualPermissions(filteredPermissions)
      setOriginalIndividualPermissions(
        filteredPermissions.map((item) => ({ ...item })),
      )
      setIndividualMode(true)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron consultar los permisos del usuario.',
      )
    } finally {
      setIndividualLoading(false)
    }
  }

  const handleCancel = () => {
    setIndividualPermissions(
      originalIndividualPermissions.map((item) => ({ ...item })),
    )

    setEditing(false)
    setError('')
    setMessage('')
  }

  const handleSave = async () => {
    const token = localStorage.getItem('token')

    if (!token || !individualUser) {
      setError('No hay un usuario seleccionado.')
      return
    }

    if (individualPermissions.length === 0) {
      setError('No hay permisos para guardar.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const allowedKeys = rolePermissionKeys[individualUser.role]

      const permissionsToSave = individualPermissions
        .filter((permission) =>
          allowedKeys.includes(permission.permission_key),
        )
        .map((permission) => ({
          permission_key: permission.permission_key,
          allowed: permission.effective_allowed,
        }))

      await updateUserPermissions(
        individualUser.id,
        permissionsToSave,
        token,
      )

      const data = await getUserPermissions(individualUser.id, token)

      const filteredPermissions = data.permissions.filter((permission) =>
        allowedKeys.includes(permission.permission_key),
      )

      setIndividualPermissions(filteredPermissions)
      setOriginalIndividualPermissions(
        filteredPermissions.map((item) => ({ ...item })),
      )

      setEditing(false)
      setMessage(
        'Los permisos individuales se guardaron correctamente.',
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron guardar los permisos individuales.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleUserIdChange = (value: string) => {
    setUserId(value)
    setIndividualMode(false)
    setIndividualUser(null)
    setIndividualPermissions([])
    setOriginalIndividualPermissions([])
    setEditing(false)
    setError('')
    setMessage('')
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    onLogout()
  }

  const renderSidebar = () => (
    <aside className="rp-sidebar">
      <div className="rp-brand">
        <div className="rp-brand-mark">S</div>

        <div className="rp-brand-text">
          <strong>SYSDESK</strong>
          <span>CONTROL CENTER</span>
        </div>
      </div>

      <div className="rp-nav-label">MENÚ PRINCIPAL</div>

      <nav className="rp-navigation">
        <button
          className="rp-nav-item"
          type="button"
          onClick={onNavigateToUsers}
        >
          <span>▦</span>
          Usuarios
        </button>

        <button
          className="rp-nav-item active"
          type="button"
          aria-current="page"
        >
          <span>▤</span>
          Estado de roles
        </button>

        <button
          className="rp-nav-item"
          type="button"
          onClick={onNavigateToProfile}
        >
          <span>◎</span>
          Mi perfil
        </button>
      </nav>

      <div className="rp-sidebar-bottom">
        <button
          className="rp-logout"
          type="button"
          onClick={handleLogout}
        >
          <span>↪</span>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )

  const renderTopbar = () => (
    <header className="rp-topbar">
      <div className="rp-breadcrumb">
        <span>Panel</span>
        <span>/</span>
        <strong>Estado de roles</strong>
      </div>

      <div className="rp-account">
        <span className="rp-online">
          <span />
          Conectado
        </span>

        <div className="rp-avatar">{usernameInitial}</div>

        <strong>{currentUser?.username || 'Administrador'}</strong>
      </div>
    </header>
  )

  const renderSearch = () => (
    <section className="rp-individual-section">
      <div className="rp-individual-search-card">
        <div className="rp-search-icon">⌕</div>

        <div className="rp-search-content">
          <span className="rp-eyebrow">
            ADMINISTRACIÓN DE ACCESOS
          </span>

          <h2>Buscar permisos de un usuario</h2>

          <p>
            Ingresá el ID para consultar y modificar los permisos
            individuales de una cuenta.
          </p>

          <div className="rp-search-controls">
            <div className="rp-search-input-wrapper">
              <span>ID</span>

              <input
                type="number"
                min="1"
                placeholder="Ej. 15"
                value={userId}
                onChange={(event) =>
                  handleUserIdChange(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleSearchUser()
                  }
                }}
              />
            </div>

            <button
              className="rp-primary-button"
              type="button"
              onClick={() => void handleSearchUser()}
              disabled={!userId.trim() || individualLoading || saving}
            >
              {individualLoading ? 'Buscando...' : 'Buscar usuario'}
            </button>

            {userId.trim() !== '' && (
              <button
                className="rp-secondary-button"
                type="button"
                onClick={() => handleUserIdChange('')}
                disabled={individualLoading || saving}
              >
                Limpiar
              </button>
            )}
          </div>

          <span className="rp-search-hint">
            Sin un ID seleccionado, la matriz es únicamente informativa.
          </span>
        </div>
      </div>
    </section>
  )

  const renderPermissionsMatrix = () => (
    <>
      {individualUser && (
        <div className="rp-info">
          <strong>{individualUser.username}</strong>

          <span>
            ID: {individualUser.id} · Rol: {roleLabels[individualUser.role]}
          </span>
        </div>
      )}

      {loading || individualLoading ? (
        <div className="rp-loading">
          {individualLoading
            ? 'Consultando permisos del usuario...'
            : 'Cargando permisos...'}
        </div>
      ) : permissions.length === 0 ? (
        <div className="rp-empty">
          No se encontraron permisos configurados en la base de datos.
        </div>
      ) : (
        <section className="rp-table-card">
          <div className="rp-table-wrapper">
            <table className="rp-table rp-table-general">
              <colgroup>
                <col className="rp-column-permission" />
                <col className="rp-column-role" />
                <col className="rp-column-role" />
                <col className="rp-column-role" />
              </colgroup>

              <thead>
                <tr>
                  <th>Permisos</th>

                  {roles.map((role) => (
                    <th key={role}>{roleLabels[role]}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {permissionGroups.map((group) => {
                  const availableKeys = group.keys.filter((key) =>
                    permissions.some(
                      (item) => item.permission_key === key,
                    ),
                  )

                  if (availableKeys.length === 0) return null

                  return (
                    <Fragment key={group.title}>
                      <tr className="rp-group-row">
                        <td colSpan={4}>{group.title}</td>
                      </tr>

                      {availableKeys.map((permissionKey) => (
                        <tr key={permissionKey}>
                          <td className="rp-permission-name">
                            {permissionLabels[permissionKey] || permissionKey}
                          </td>

                          {roles.map((role) => {
                            const isSelectedUserRole =
                              individualMode &&
                              individualUser?.role === role

                            const roleAllowsPermission =
                              isPermissionAllowedForRole(
                                role,
                                permissionKey,
                              )

                            const individualPermission =
                              isSelectedUserRole
                                ? getIndividualPermission(permissionKey)
                                : undefined

                            const generalPermission = getPermission(
                              role,
                              permissionKey,
                            )

                            const checked = isSelectedUserRole
                              ? individualPermission?.effective_allowed ?? false
                              : generalPermission?.allowed ?? false

                            const canEdit =
                              isSelectedUserRole &&
                              roleAllowsPermission &&
                              Boolean(individualPermission) &&
                              editing &&
                              !saving

                            return (
                              <td key={role}>
                                {roleAllowsPermission &&
                                (isSelectedUserRole
                                  ? individualPermission
                                  : generalPermission) ? (
                                  <label className="rp-checkbox-label">
                                    <input
                                      className="rp-checkbox"
                                      type="checkbox"
                                      checked={checked}
                                      disabled={!canEdit}
                                      aria-label={`${permissionLabels[permissionKey] || permissionKey}: ${roleLabels[role]}`}
                                      onChange={(event) =>
                                        handleIndividualChange(
                                          permissionKey,
                                          event.target.checked,
                                        )
                                      }
                                    />

                                    <span className="rp-checkbox-mark" />
                                  </label>
                                ) : (
                                  <span className="rp-missing">—</span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          <footer className="rp-table-footer">
            <span>
              <span className="rp-legend-enabled" />
              Permitido
            </span>

            <span>
              <span className="rp-legend-disabled" />
              Denegado
            </span>

            <span>
              <span className="rp-legend-missing" />
              No corresponde al rol
            </span>
          </footer>
        </section>
      )}
    </>
  )

  return (
    <main className="role-permissions-page">
      {renderSidebar()}

      <section className="rp-main">
        {renderTopbar()}

        <div className="rp-content">
          <div className="rp-heading">
            <div>
              <span className="rp-eyebrow">
                CONFIGURACIÓN DEL SISTEMA
              </span>

              <h1>Estado de roles</h1>

              <p>
                Administrá los permisos y accesos de cada tipo de usuario.
              </p>
            </div>

            {individualMode && !editing && (
              <button
                className="rp-primary-button"
                type="button"
                onClick={() => {
                  setEditing(true)
                  setMessage('')
                  setError('')
                }}
                disabled={saving}
              >
                ✎ Editar permisos
              </button>
            )}

            {individualMode && editing && (
              <div className="rp-actions">
                <button
                  className="rp-secondary-button"
                  type="button"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  className="rp-primary-button"
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            )}
          </div>

          {renderSearch()}

          {error && (
            <div className="rp-alert rp-error" role="alert">
              {error}
            </div>
          )}

          {message && (
            <div className="rp-alert rp-success" role="status">
              {message}
            </div>
          )}

          {individualMode && !editing && (
            <div className="rp-info">
              <strong>Modo de visualización individual</strong>
              <span>
                La matriz muestra los permisos efectivos del usuario
                seleccionado. Presioná Editar permisos para modificarlos.
              </span>
            </div>
          )}

          {!individualMode && (
            <div className="rp-info">
              <strong>Modo de visualización</strong>
              <span>
                Los permisos generales se muestran únicamente como
                referencia. Para modificar una cuenta, ingresá su ID.
              </span>
            </div>
          )}

          {individualMode && editing && (
            <div className="rp-info">
              <strong>Modo de edición individual</strong>
              <span>
                Solo se modificarán los permisos de {individualUser?.username}.
                Los permisos generales de los roles no serán alterados.
              </span>
            </div>
          )}

          {renderPermissionsMatrix()}

          <footer className="rp-footer">
            SYSDESK · Administración de permisos
          </footer>
        </div>
      </section>
    </main>
  )
}

export default RolePermissions
