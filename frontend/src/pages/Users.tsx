import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  changeUserRole,
  getPhotoUrl,
  getProfile,
} from '../services/api'
import '../styles/Users.css'

type UserRole = 'admin' | 'user' | 'provider'

interface User {
  id: number
  username: string
  role: UserRole
}

interface UsersProps {
  onLogout: () => void
  onNavigateToProfile: () => void
}

const API_URL = 'http://localhost:3000/api'

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  user: 'Usuario',
  provider: 'Proveedor',
}

function Users({
  onLogout,
  onNavigateToProfile,
}: UsersProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null)
  const [selectedRoles, setSelectedRoles] = useState<
    Record<number, UserRole>
  >({})
  const [savingRole, setSavingRole] = useState<number | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createUsername, setCreateUsername] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<UserRole>('user')
  const [creatingUser, setCreatingUser] = useState(false)
  const [createError, setCreateError] = useState('')

  let currentUser: User | null = null

  try {
    currentUser = JSON.parse(
      localStorage.getItem('user') || 'null',
    ) as User | null
  } catch {
    currentUser = null
  }

  const isAdmin = currentUser?.role === 'admin'

  const loadUsers = useCallback(async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      setError('No hay una sesión activa. Iniciá sesión nuevamente.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error || 'No se pudieron cargar los usuarios.',
        )
      }

      const userList: User[] = Array.isArray(data)
        ? data
        : data.users ?? []

      setUsers(userList)

      setSelectedRoles((previous) => {
        const updated = { ...previous }

        userList.forEach((user) => {
          if (!(user.id in updated)) {
            updated[user.id] = user.role
          }
        })

        return updated
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al cargar los usuarios.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  useEffect(() => {
    const token = localStorage.getItem('token')

    if (!token) return

    let active = true

    const loadProfilePhoto = async () => {
      try {
        const profile = await getProfile(token)

        if (active) {
          setProfilePhoto(getPhotoUrl(profile.photoUrl))
        }
      } catch {
        if (active) {
          setProfilePhoto(null)
        }
      }
    }

    void loadProfilePhoto()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !creatingUser) {
        setShowCreateModal(false)
        setCreateError('')
      }
    }

    if (showCreateModal) {
      window.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showCreateModal, creatingUser])

  const filteredUsers = users.filter((user) => {
    const searchText = search.trim().toLowerCase()

    return (
      user.username.toLowerCase().includes(searchText) ||
      String(user.id).includes(searchText) ||
      roleLabels[user.role].toLowerCase().includes(searchText)
    )
  })

  const handleChangeRole = async (user: User) => {
    if (!isAdmin) {
      setError('No tenés permisos para cambiar roles.')
      return
    }

    if (user.id === currentUser?.id) {
      setError('No podés cambiar tu propio rol.')
      return
    }

    const newRole = selectedRoles[user.id] ?? user.role

    if (newRole === user.role) {
      setMessage('El usuario ya tiene ese rol.')
      setError('')
      return
    }

    const token = localStorage.getItem('token')

    if (!token) {
      setError('No hay una sesión activa.')
      return
    }

    setError('')
    setMessage('')
    setSavingRole(user.id)

    try {
      const result = await changeUserRole(user.id, newRole, token)

      setUsers((previousUsers) =>
        previousUsers.map((item) =>
          item.id === user.id
            ? { ...item, ...result.user }
            : item,
        ),
      )

      setSelectedRoles((previous) => ({
        ...previous,
        [user.id]: newRole,
      }))

      setMessage(
        `El rol de "${user.username}" se cambió correctamente a ${roleLabels[newRole]}.`,
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cambiar el rol.',
      )
    } finally {
      setSavingRole(null)
    }
  }

  const handleDelete = async (user: User) => {
    if (!isAdmin) {
      setError('No tenés permisos para eliminar usuarios.')
      return
    }

    if (user.id === currentUser?.id) {
      setError('No podés eliminar tu propia cuenta.')
      return
    }

    const confirmed = window.confirm(
      `¿Seguro que querés eliminar al usuario "${user.username}"?`,
    )

    if (!confirmed) return

    const token = localStorage.getItem('token')

    if (!token) {
      setError('No hay una sesión activa.')
      return
    }

    setError('')
    setMessage('')

    try {
      const response = await fetch(`${API_URL}/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error || 'No se pudo eliminar el usuario.',
        )
      }

      setUsers((previousUsers) =>
        previousUsers.filter((item) => item.id !== user.id),
      )

      setSelectedRoles((previous) => {
        const updated = { ...previous }
        delete updated[user.id]
        return updated
      })

      setMessage(`El usuario "${user.username}" fue eliminado.`)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al eliminar el usuario.',
      )
    }
  }

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isAdmin) {
      setCreateError('No tenés permisos para crear usuarios.')
      return
    }

    const username = createUsername.trim()

    if (username.length < 3) {
      setCreateError('El nombre de usuario debe tener al menos 3 caracteres.')
      return
    }

    if (createPassword.length < 8) {
      setCreateError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    const token = localStorage.getItem('token')

    if (!token) {
      setCreateError('No hay una sesión activa. Iniciá sesión nuevamente.')
      return
    }

    setCreatingUser(true)
    setCreateError('')
    setError('')
    setMessage('')

    try {
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username,
          password: createPassword,
          role: createRole,
        }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo crear el usuario.')
      }

      setShowCreateModal(false)
      setCreateUsername('')
      setCreatePassword('')
      setCreateRole('user')
      setMessage(`El usuario "${username}" fue creado correctamente.`)

      await loadUsers()
    } catch (err) {
      setCreateError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al crear el usuario.',
      )
    } finally {
      setCreatingUser(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    onLogout()
  }

  const usernameInitial =
    currentUser?.username?.charAt(0).toUpperCase() || 'U'

  return (
    <main className="users-page">
      <aside className="users-sidebar">
        <div className="users-brand">
          <div className="users-brand-mark">S</div>

          <div className="users-brand-text">
            <strong>SYSDESK</strong>
            <span>CONTROL CENTER</span>
          </div>
        </div>

        <div className="users-nav-label">MENÚ PRINCIPAL</div>

        <nav
          className="users-navigation"
          aria-label="Navegación principal"
        >
          <button
            className="users-nav-item active"
            type="button"
            aria-current="page"
          >
            <span className="users-nav-icon">▦</span>
            <span>Usuarios</span>
            <span className="users-nav-indicator" />
          </button>

          <button
            className="users-nav-item"
            type="button"
            onClick={onNavigateToProfile}
          >
            <span className="users-nav-icon">◎</span>
            <span>Mi perfil</span>
          </button>
        </nav>

        <div className="users-sidebar-bottom">
          <button
            className="users-logout"
            type="button"
            onClick={handleLogout}
          >
            <span>↪</span>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <section className="users-main">
        <header className="users-topbar">
          <div className="users-breadcrumb">
            <span>Panel</span>
            <span className="users-breadcrumb-separator">/</span>
            <strong>Usuarios</strong>
          </div>

          <div className="users-topbar-right">
            <span className="users-live-indicator">
              <span className="users-status-dot" />
              Conectado
            </span>

            <div className="users-topbar-divider" />

            <div className="users-topbar-account">
              {profilePhoto ? (
                <img
                  className="users-avatar"
                  src={profilePhoto}
                  alt="Foto de perfil"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div className="users-avatar">{usernameInitial}</div>
              )}

              <span>{currentUser?.username ?? 'Usuario'}</span>
            </div>
          </div>
        </header>

        <div className="users-content">
          {error && (
            <p
              className="users-alert users-alert-error"
              role="alert"
            >
              <span>!</span>
              {error}
            </p>
          )}

          {message && (
            <p
              className="users-alert users-alert-success"
              role="status"
            >
              <span>✓</span>
              {message}
            </p>
          )}

          <section className="users-table-card">
            <div className="users-table-header">
              <div>
                <span className="users-section-eyebrow">
                  DIRECTORIO
                </span>

                <h2>Usuarios registrados</h2>

                <p>Listado de cuentas y niveles de acceso.</p>
              </div>

              <div className="users-header-actions">
                {isAdmin && (
                  <button
                    className="users-create-button"
                    type="button"
                    onClick={() => {
                      setCreateError('')
                      setShowCreateModal(true)
                    }}
                  >
                    <span aria-hidden="true">＋</span>
                    Crear usuario
                  </button>
                )}

                <button
                  className="users-refresh"
                  type="button"
                  onClick={() => void loadUsers()}
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

            <div className="users-table-toolbar">
              <label className="users-search">
                <span className="users-search-icon">⌕</span>

                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por usuario, ID o rol..."
                  aria-label="Buscar usuarios"
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
                <strong>{filteredUsers.length}</strong> de {users.length}{' '}
                registros
              </span>
            </div>

            {loading ? (
              <div className="users-empty">
                <span className="users-loading-spinner" />
                <strong>Cargando usuarios</strong>
                <span>
                  Estamos consultando los registros del sistema.
                </span>
              </div>
            ) : (
              <div className="users-table-wrapper">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Usuario</th>
                      <th>Rol y permisos</th>
                      <th>Estado</th>
                      {isAdmin && <th>Acciones</th>}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={isAdmin ? 5 : 4}
                          className="users-empty"
                        >
                          <strong>
                            {search
                              ? 'No encontramos coincidencias'
                              : 'No hay usuarios registrados'}
                          </strong>

                          <span>
                            {search
                              ? 'Probá con otro nombre, ID o rol.'
                              : 'Los registros aparecerán aquí.'}
                          </span>
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => {
                        const selectedRole =
                          selectedRoles[user.id] ?? user.role
                        const isCurrentUser =
                          user.id === currentUser?.id

                        return (
                          <tr key={user.id}>
                            <td>
                              <span className="users-id">
                                #{user.id}
                              </span>
                            </td>

                            <td>
                              <div className="users-table-user">
                                <div className="users-table-avatar">
                                  {user.username
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>

                                <div className="users-table-user-info">
                                  <strong>{user.username}</strong>
                                  <span>Cuenta del sistema</span>
                                </div>
                              </div>
                            </td>

                            <td>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 8,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <select
                                  value={selectedRole}
                                  disabled={
                                    !isAdmin ||
                                    isCurrentUser ||
                                    savingRole === user.id
                                  }
                                  onChange={(event) =>
                                    setSelectedRoles((previous) => ({
                                      ...previous,
                                      [user.id]: event.target.value as UserRole,
                                    }))
                                  }
                                  aria-label={`Rol de ${user.username}`}
                                  style={{
                                    padding: '9px',
                                    borderRadius: 6,
                                    border: '1px solid #526174',
                                    background: '#1e2937',
                                    color: '#ffffff',
                                    maxWidth: '100%',
                                  }}
                                >
                                  <option value="user">Usuario</option>
                                  <option value="provider">Proveedor</option>
                                  <option value="admin">Administrador</option>
                                </select>

                                {isAdmin && (
                                  <button
                                    type="button"
                                    className="users-refresh"
                                    disabled={
                                      isCurrentUser ||
                                      savingRole === user.id ||
                                      selectedRole === user.role
                                    }
                                    onClick={() =>
                                      void handleChangeRole(user)
                                    }
                                  >
                                    {savingRole === user.id
                                      ? 'Guardando...'
                                      : 'Guardar rol'}
                                  </button>
                                )}
                              </div>
                            </td>

                            <td>
                              <span className="users-account-status">
                                <span className="users-status-dot" />
                                Registrado
                              </span>
                            </td>

                            {isAdmin && (
                              <td>
                                <button
                                  className="users-delete"
                                  type="button"
                                  onClick={() => void handleDelete(user)}
                                  disabled={isCurrentUser}
                                  title={
                                    isCurrentUser
                                      ? 'No podés eliminar tu propia cuenta'
                                      : 'Eliminar usuario'
                                  }
                                >
                                  <span>×</span>
                                  Eliminar
                                </button>
                              </td>
                            )}
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <footer className="users-table-footer">
              <span>
                Mostrando <strong>{filteredUsers.length}</strong> usuarios
              </span>

              <span className="users-table-footer-status">
                <span className="users-status-dot" />
                Directorio del sistema
              </span>
            </footer>
          </section>

          <footer className="users-footer">
            <span>SYSDESK</span>
            <span>·</span>
            <span>Sistema de usuarios</span>
          </footer>
        </div>
      </section>

      {showCreateModal && isAdmin && (
        <div
          className="users-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creatingUser) {
              setShowCreateModal(false)
              setCreateError('')
            }
          }}
        >
          <section
            className="users-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-modal-title"
          >
            <header className="users-modal-header">
              <div className="users-modal-heading">
                <div className="users-modal-icon" aria-hidden="true">
                  ＋
                </div>

                <div>
                  <span className="users-section-eyebrow">
                    NUEVA CUENTA
                  </span>
                  <h2 id="users-modal-title">Crear usuario</h2>
                  <p>Agregá una cuenta al directorio de SYSDESK.</p>
                </div>
              </div>

              <button
                className="users-modal-close"
                type="button"
                onClick={() => {
                  setShowCreateModal(false)
                  setCreateError('')
                }}
                disabled={creatingUser}
                aria-label="Cerrar ventana"
              >
                ×
              </button>
            </header>

            <form
              className="users-modal-form"
              onSubmit={handleCreateUser}
            >
              {createError && (
                <p className="users-alert users-alert-error" role="alert">
                  {createError}
                </p>
              )}

              <label className="users-modal-field">
                <span>Nombre de usuario</span>
                <input
                  type="text"
                  value={createUsername}
                  onChange={(event) => setCreateUsername(event.target.value)}
                  placeholder="Ej. usuario01"
                  minLength={3}
                  maxLength={50}
                  autoComplete="off"
                  required
                  disabled={creatingUser}
                  autoFocus
                />
              </label>

              <label className="users-modal-field">
                <span>Contraseña</span>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(event) => setCreatePassword(event.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  minLength={8}
                  autoComplete="new-password"
                  required
                  disabled={creatingUser}
                />
                <small>
                  Usá al menos 8 caracteres para la contraseña.
                </small>
              </label>

              <label className="users-modal-field">
                <span>Rol y permisos</span>
                <select
                  value={createRole}
                  onChange={(event) =>
                    setCreateRole(event.target.value as UserRole)
                  }
                  disabled={creatingUser}
                >
                  <option value="user">Usuario</option>
                  <option value="provider">Proveedor</option>
                  <option value="admin">Administrador</option>
                </select>
              </label>

              <div className="users-modal-actions">
                <button
                  className="users-refresh"
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreateError('')
                  }}
                  disabled={creatingUser}
                >
                  Cancelar
                </button>

                <button
                  className="users-create-button"
                  type="submit"
                  disabled={creatingUser}
                >
                  {creatingUser ? 'Creando...' : 'Crear cuenta'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

export default Users