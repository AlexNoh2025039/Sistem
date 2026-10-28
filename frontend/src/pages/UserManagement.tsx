
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  changeUserRole,
  createAdminUser,
  deleteUser,
  getUsers,
} from '../services/api'
import type { ManagedUser, UserRole } from '../services/api'
import '../styles/Users.css'

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  user: 'Usuario',
  provider: 'Proveedor',
}

function UserManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [selectedRoles, setSelectedRoles] = useState<Record<number, UserRole>>({})
  const [savingRoles, setSavingRoles] = useState<number[]>([])
  const [deletingUsers, setDeletingUsers] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [creating, setCreating] = useState(false)

  const currentUser = JSON.parse(
    localStorage.getItem('user') || 'null',
  ) as ManagedUser | null

  const loadUsers = useCallback(async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      setError('No hay una sesión activa. Iniciá sesión nuevamente.')
      setLoading(false)
      return
    }

    try {
      setError('')
      const data = await getUsers(token)
      setUsers(data)
      setSelectedRoles(
        Object.fromEntries(data.map((user) => [user.id, user.role])),
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar usuarios.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const token = localStorage.getItem('token')

    if (!token) {
      setError('No hay una sesión activa. Iniciá sesión nuevamente.')
      return
    }

    setError('')
    setMessage('')
    setCreating(true)

    try {
      const username = newUsername.trim()
      await createAdminUser(username, newPassword, token)

      setMessage(`El usuario "${username}" fue creado correctamente.`)
      setNewUsername('')
      setNewPassword('')
      setShowForm(false)
      setLoading(true)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear usuario.')
    } finally {
      setCreating(false)
    }
  }

  const handleSaveRole = async (user: ManagedUser) => {
    const token = localStorage.getItem('token')
    const newRole = selectedRoles[user.id]

    if (!token) {
      setError('No hay una sesión activa. Iniciá sesión nuevamente.')
      return
    }

    if (!newRole || newRole === user.role) {
      setMessage('No hay cambios de rol para guardar.')
      return
    }

    setError('')
    setMessage('')
    setSavingRoles((previous) => [...previous, user.id])

    try {
      const result = await changeUserRole(user.id, newRole, token)

      setUsers((previous) =>
        previous.map((item) => item.id === user.id ? result.user : item),
      )
      setSelectedRoles((previous) => ({
        ...previous,
        [user.id]: result.user.role,
      }))
      setMessage(
        `El rol de "${user.username}" se actualizó a ${roleLabels[result.user.role]}.`,
      )

      if (user.id === currentUser?.id) {
        const storedUser = localStorage.getItem('user')
        if (storedUser) {
          const updatedUser = JSON.parse(storedUser)
          updatedUser.role = result.user.role
          localStorage.setItem('user', JSON.stringify(updatedUser))
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el rol.')
    } finally {
      setSavingRoles((previous) => previous.filter((id) => id !== user.id))
    }
  }

  const handleDelete = async (user: ManagedUser) => {
    if (!window.confirm(`¿Seguro que querés eliminar al usuario "${user.username}"?`)) {
      return
    }

    const token = localStorage.getItem('token')

    if (!token) {
      setError('No hay una sesión activa.')
      return
    }

    setError('')
    setMessage('')
    setDeletingUsers((previous) => [...previous, user.id])

    try {
      await deleteUser(user.id, token)
      setUsers((previous) => previous.filter((item) => item.id !== user.id))

      setSelectedRoles((previous) => {
        const updated = { ...previous }
        delete updated[user.id]
        return updated
      })

      setMessage(`El usuario "${user.username}" fue eliminado.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar usuario.')
    } finally {
      setDeletingUsers((previous) => previous.filter((id) => id !== user.id))
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.reload()
  }

  return (
    <main className="users-page">
      <header className="users-topbar">
        <div>
          <span className="users-eyebrow">PANEL DE CONTROL</span>
          <h1>Sistema de usuarios</h1>
        </div>

        <div className="users-account">
          <div className="users-avatar">
            {currentUser?.username?.charAt(0).toUpperCase() ?? 'U'}
          </div>
          <div className="users-account-info">
            <strong>{currentUser?.username ?? 'Usuario'}</strong>
            <span>
              {currentUser?.role ? roleLabels[currentUser.role] : 'Usuario'}
            </span>
          </div>
          <button className="users-logout" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <section className="users-content">
        <div className="users-heading">
          <div>
            <h2>Usuarios registrados</h2>
            <p>Consultá y administrá las cuentas del sistema.</p>
          </div>

          <div className="users-heading-actions">
            <button
              className="users-refresh"
              onClick={() => {
                setLoading(true)
                void loadUsers()
              }}
              disabled={loading}
            >
              Actualizar tabla
            </button>
            <button
              className="users-create-button"
              onClick={() => {
                setShowForm(!showForm)
                setError('')
                setMessage('')
              }}
            >
              {showForm ? 'Cancelar' : '+ Nuevo usuario'}
            </button>
          </div>
        </div>

        {showForm && (
          <section className="users-form-card">
            <div className="users-form-heading">
              <h3>Crear usuario</h3>
              <p>La cuenta se registrará con el rol de usuario estándar.</p>
            </div>

            <form className="users-create-form" onSubmit={handleCreate}>
              <div className="users-form-field">
                <label htmlFor="new-username">Nombre de usuario</label>
                <input
                  id="new-username"
                  type="text"
                  value={newUsername}
                  onChange={(event) => setNewUsername(event.target.value)}
                  placeholder="Ingresá un nombre de usuario"
                  autoComplete="off"
                  minLength={1}
                  maxLength={50}
                  required
                />
              </div>

              <div className="users-form-field">
                <label htmlFor="new-password">Contraseña</label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Ingresá una contraseña"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  required
                />
              </div>

              <button
                className="users-create-button"
                type="submit"
                disabled={creating}
              >
                {creating ? 'Creando usuario...' : 'Crear usuario'}
              </button>
            </form>
          </section>
        )}

        {error && <p className="users-alert users-alert-error">{error}</p>}
        {message && <p className="users-alert users-alert-success">{message}</p>}

        <div className="users-table-card">
          <div className="users-table-header">
            <h3>Listado de cuentas</h3>
            <span>{users.length} registros</span>
          </div>

          {loading ? (
            <p className="users-empty">Cargando usuarios...</p>
          ) : (
            <div className="users-table-wrapper">
              <table className="users-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre de usuario</th>
                    <th>Rol actual</th>
                    <th>Cambiar rol</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="users-empty">
                        No hay usuarios para mostrar.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => {
                      const selectedRole = selectedRoles[user.id] ?? user.role
                      const isSaving = savingRoles.includes(user.id)
                      const isDeleting = deletingUsers.includes(user.id)
                      const isCurrentUser = user.id === currentUser?.id

                      return (
                        <tr key={user.id}>
                          <td>#{user.id}</td>
                          <td className="users-username">{user.username}</td>
                          <td>
                            <span className={`users-role users-role-${user.role}`}>
                              {roleLabels[user.role]}
                            </span>
                          </td>
                          <td>
                            <select
                              value={selectedRole}
                              onChange={(event) =>
                                setSelectedRoles((previous) => ({
                                  ...previous,
                                  [user.id]: event.target.value as UserRole,
                                }))
                              }
                              disabled={isSaving || isCurrentUser}
                              aria-label={`Cambiar rol de ${user.username}`}
                            >
                              <option value="user">Usuario</option>
                              <option value="provider">Proveedor</option>
                              <option value="admin">Administrador</option>
                            </select>

                            <button
                              className="users-refresh"
                              onClick={() => void handleSaveRole(user)}
                              disabled={
                                isSaving || isCurrentUser || selectedRole === user.role
                              }
                              title={
                                isCurrentUser
                                  ? 'No podés cambiar tu propio rol'
                                  : 'Guardar el nuevo rol'
                              }
                            >
                              {isSaving ? 'Guardando...' : 'Guardar rol'}
                            </button>
                          </td>
                          <td>
                            <button
                              className="users-delete"
                              onClick={() => void handleDelete(user)}
                              disabled={isDeleting || isCurrentUser}
                              title={
                                isCurrentUser
                                  ? 'No podés eliminar tu propia cuenta'
                                  : 'Eliminar usuario'
                              }
                            >
                              {isDeleting ? 'Eliminando...' : 'Eliminar'}
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <footer className="users-footer">
        Sistema de usuarios · Panel de administración
      </footer>
    </main>
  )
}

export default UserManagement
