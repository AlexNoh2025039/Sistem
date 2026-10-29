
import { useCallback, useEffect, useState } from 'react'
import {
  deleteUserPermissionOverride,
  getRolePermissions,
  getUserPermissionOverrides,
  getUsers,
  updateRolePermission,
  updateUserPermissionOverride,
} from '../services/api'
import type {
  ManagedUser,
  PermissionKey,
  RolePermission,
  UserPermissionOverride,
  UserRole,
} from '../services/api'
import '../styles/PermissionMatrix.css'

interface PermissionMatrixProps {
  onBack: () => void
}

const roles: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'user', label: 'Usuario' },
  { value: 'provider', label: 'Proveedor' },
]

const permissions: {
  key: PermissionKey
  label: string
  group: string
}[] = [
  { key: 'users.view', label: 'Ver usuarios', group: 'Usuarios' },
  { key: 'users.create', label: 'Crear usuarios', group: 'Usuarios' },
  { key: 'users.edit', label: 'Editar usuarios', group: 'Usuarios' },
  { key: 'users.delete', label: 'Eliminar usuarios', group: 'Usuarios' },
  { key: 'users.change_role', label: 'Cambiar roles', group: 'Usuarios' },
  {
    key: 'permissions.manage',
    label: 'Administrar permisos',
    group: 'Usuarios',
  },
  { key: 'products.view', label: 'Ver productos', group: 'Productos' },
  { key: 'products.publish', label: 'Publicar productos', group: 'Productos' },
  { key: 'products.edit', label: 'Editar productos', group: 'Productos' },
  {
    key: 'products.deactivate',
    label: 'Desactivar productos',
    group: 'Productos',
  },
  {
    key: 'provider.profile.manage',
    label: 'Administrar perfil de proveedor',
    group: 'Proveedor',
  },
  { key: 'cart.manage', label: 'Administrar carrito', group: 'Compras' },
  { key: 'orders.create', label: 'Crear pedidos', group: 'Compras' },
  { key: 'orders.view', label: 'Ver pedidos', group: 'Compras' },
]

type OverrideValue = 'inherit' | 'allow' | 'deny'

function PermissionMatrix({ onBack }: PermissionMatrixProps) {
  const [mode, setMode] = useState<'roles' | 'users'>('roles')
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [overrides, setOverrides] = useState<UserPermissionOverride[]>([])
  const [searchUsername, setSearchUsername] = useState('')
  const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const token = localStorage.getItem('token')

  const loadData = useCallback(async () => {
    if (!token) {
      setError('No hay una sesión activa.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [permissionData, userData] = await Promise.all([
        getRolePermissions(token),
        getUsers(token),
      ])

      setRolePermissions(permissionData)
      setUsers(userData)

      setSelectedUserId((current) => {
        if (current && userData.some((user) => user.id === current)) {
          return current
        }

        return userData.find((user) => user.role !== 'admin')?.id
          ?? userData[0]?.id
          ?? null
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar la matriz de permisos.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  const loadOverrides = useCallback(async () => {
    if (!token || selectedUserId === null) {
      setOverrides([])
      return
    }

    try {
      const data = await getUserPermissionOverrides(selectedUserId, token)
      setOverrides(data)
      setError('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar las excepciones.',
      )
    }
  }, [selectedUserId, token])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    void loadOverrides()
  }, [loadOverrides])

  const getRoleAllowed = (role: UserRole, key: PermissionKey) =>
    rolePermissions.find(
      (item) => item.role === role && item.permission_key === key,
    )?.allowed ?? false

  const getOverrideValue = (key: PermissionKey): OverrideValue => {
    const item = overrides.find((override) => override.permission_key === key)

    if (!item) return 'inherit'
    return item.allowed ? 'allow' : 'deny'
  }

  const saveRolePermission = async (
    role: UserRole,
    permissionKey: PermissionKey,
    allowed: boolean,
  ) => {
    if (!token) return

    if (role === 'admin') {
      setError('Los permisos generales del administrador están protegidos.')
      return
    }

    const key = `${role}:${permissionKey}`
    const previous = rolePermissions.find(
      (item) => item.role === role && item.permission_key === permissionKey,
    )

    setSavingKey(key)
    setError('')
    setMessage('')

    setRolePermissions((items) => {
      const exists = items.some(
        (item) => item.role === role && item.permission_key === permissionKey,
      )

      if (!exists) {
        return [...items, { role, permission_key: permissionKey, allowed }]
      }

      return items.map((item) =>
        item.role === role && item.permission_key === permissionKey
          ? { ...item, allowed }
          : item,
      )
    })

    try {
      await updateRolePermission(role, permissionKey, allowed, token)
      setMessage('Permiso del rol actualizado correctamente.')
    } catch (err) {
      setRolePermissions((items) => {
        if (!previous) {
          return items.filter(
            (item) =>
              !(item.role === role && item.permission_key === permissionKey),
          )
        }

        return items.map((item) =>
          item.role === role && item.permission_key === permissionKey
            ? previous
            : item,
        )
      })

      setError(
        err instanceof Error ? err.message : 'No se pudo guardar el permiso.',
      )
    } finally {
      setSavingKey(null)
    }
  }

  const saveUserOverride = async (
    permissionKey: PermissionKey,
    value: OverrideValue,
  ) => {
    if (!token || selectedUserId === null) return

    const selectedUser = users.find((user) => user.id === selectedUserId)

    if (!selectedUser) {
      setError('Seleccioná una cuenta válida.')
      return
    }

    if (
      selectedUser.role === 'admin' &&
      permissionKey === 'permissions.manage' &&
      value !== 'allow'
    ) {
      setError(
        'No se puede quitar el permiso de administrar permisos a una cuenta administradora.',
      )
      return
    }

    const key = `user:${permissionKey}`
    const previous = overrides

    setSavingKey(key)
    setError('')
    setMessage('')

    try {
      if (value === 'inherit') {
        await deleteUserPermissionOverride(
          selectedUserId,
          permissionKey,
          token,
        )

        setOverrides((items) =>
          items.filter((item) => item.permission_key !== permissionKey),
        )
      } else {
        await updateUserPermissionOverride(
          selectedUserId,
          permissionKey,
          value === 'allow',
          token,
        )

        const updated = await getUserPermissionOverrides(
          selectedUserId,
          token,
        )

        setOverrides(updated)
      }

      setMessage('Permiso individual actualizado correctamente.')
    } catch (err) {
      setOverrides(previous)
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar la excepción.',
      )
    } finally {
      setSavingKey(null)
    }
  }

  const selectedUser = users.find((user) => user.id === selectedUserId)

  const filteredUsers = users.filter((user) => {
    const matchesUsername = user.username
      .toLocaleLowerCase()
      .includes(searchUsername.trim().toLocaleLowerCase())

    const matchesRole = filterRole === 'all' || user.role === filterRole

    return matchesUsername && matchesRole
  })

  return (
    <section className="permission-page">
      <header className="permission-header">
        <div>
          <span className="permission-eyebrow">CONTROL DE ACCESO</span>
          <h1>Matriz de permisos</h1>
          <p>Administrá los permisos generales y las excepciones por cuenta.</p>
        </div>

        <button className="permission-back" onClick={onBack} type="button">
          Volver a usuarios
        </button>
      </header>

      <div className="permission-tabs">
        <button
          type="button"
          className={mode === 'roles' ? 'selected' : ''}
          onClick={() => {
            setMode('roles')
            setError('')
            setMessage('')
          }}
        >
          Permisos por rol
        </button>

        <button
          type="button"
          className={mode === 'users' ? 'selected' : ''}
          onClick={() => {
            setMode('users')
            setError('')
            setMessage('')
          }}
        >
          Excepciones individuales
        </button>
      </div>

      {error && <p className="permission-alert error">{error}</p>}
      {message && <p className="permission-alert success">{message}</p>}

      {loading ? (
        <p className="permission-empty">Cargando permisos...</p>
      ) : mode === 'roles' ? (
        <div className="permission-card">
          <div className="permission-card-heading">
            <h2>Permisos por rol</h2>
            <p>Los cambios afectan a todas las cuentas del rol seleccionado.</p>
          </div>

          <div className="permission-table-scroll">
            <table className="permission-table">
              <thead>
                <tr>
                  <th>Permiso</th>
                  {roles.map((role) => (
                    <th key={role.value}>{role.label}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {permissions.map((permission, index) => (
                  <tr key={permission.key}>
                    <td>
                      {index === 0 ||
                      permissions[index - 1].group !== permission.group ? (
                        <span className="permission-group">
                          {permission.group}
                        </span>
                      ) : null}

                      <strong>{permission.label}</strong>
                      <small>{permission.key}</small>
                    </td>

                    {roles.map((role) => {
                      const allowed = getRoleAllowed(
                        role.value,
                        permission.key,
                      )
                      const key = `${role.value}:${permission.key}`
                      const locked = role.value === 'admin'

                      return (
                        <td key={role.value}>
                          <label className="permission-toggle">
                            <input
                              type="checkbox"
                              checked={allowed}
                              disabled={locked || savingKey === key}
                              onChange={(event) =>
                                void saveRolePermission(
                                  role.value,
                                  permission.key,
                                  event.target.checked,
                                )
                              }
                              aria-label={`${permission.label}: ${role.label}`}
                            />
                            <span>
                              {allowed ? 'Permitido' : 'Denegado'}
                            </span>
                          </label>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="permission-note">
            Los permisos generales del administrador están protegidos. Las
            excepciones individuales se configuran en la otra pestaña.
          </p>
        </div>
      ) : (
        <div className="permission-card">
          <div className="permission-card-heading">
            <h2>Excepciones individuales</h2>
            <p>
              Una excepción prevalece sobre el permiso heredado del rol.
              Seleccioná «Heredado» para quitarla.
            </p>
          </div>

          <div className="permission-user-filters">
            <label className="permission-user-select">
              <span>Buscar por nombre de usuario</span>
              <input
                type="search"
                value={searchUsername}
                onChange={(event) => setSearchUsername(event.target.value)}
                placeholder="Escribí un nombre de usuario..."
              />
            </label>

            <label className="permission-user-select">
              <span>Filtrar por rol</span>
              <select
                value={filterRole}
                onChange={(event) =>
                  setFilterRole(event.target.value as UserRole | 'all')
                }
              >
                <option value="all">Todos los roles</option>
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="permission-user-select">
            <span>Seleccionar cuenta ({filteredUsers.length})</span>
            <select
              value={
                selectedUserId !== null &&
                filteredUsers.some((user) => user.id === selectedUserId)
                  ? selectedUserId
                  : ''
              }
              onChange={(event) => {
                setSelectedUserId(
                  event.target.value ? Number(event.target.value) : null,
                )
                setError('')
                setMessage('')
              }}
            >
              <option value="">Seleccioná una cuenta</option>
              {filteredUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username} · {roles.find((role) => role.value === user.role)?.label ?? user.role} · #{user.id}
                </option>
              ))}
            </select>
          </label>

          {selectedUser &&
          filteredUsers.some((user) => user.id === selectedUserId) ? (
            <>
              <div className="permission-selected-user">
                <strong>{selectedUser.username}</strong>
                <span>
                  Rol:{' '}
                  {roles.find((role) => role.value === selectedUser.role)?.label
                    ?? selectedUser.role}
                </span>
                <span>Referencia: #{selectedUser.id}</span>
              </div>

              {selectedUser.role === 'admin' && (
                <p className="permission-note">
                  Podés configurar excepciones para esta cuenta. El permiso
                  «Administrar permisos» permanece protegido.
                </p>
              )}

              <div className="permission-user-list">
                {permissions.map((permission) => {
                  const value = getOverrideValue(permission.key)
                  const inherited = getRoleAllowed(
                    selectedUser.role,
                    permission.key,
                  )
                  const isProtectedPermission =
                    selectedUser.role === 'admin' &&
                    permission.key === 'permissions.manage'

                  return (
                    <div className="permission-user-row" key={permission.key}>
                      <div>
                        <strong>{permission.label}</strong>
                        <small>
                          Heredado del rol:{' '}
                          {inherited ? 'Permitido' : 'Denegado'}
                        </small>
                        <small>
                          Estado efectivo:{' '}
                          {value === 'inherit'
                            ? inherited
                              ? 'Permitido (heredado)'
                              : 'Denegado (heredado)'
                            : value === 'allow'
                              ? 'Permitido (excepción)'
                              : 'Denegado (excepción)'}
                        </small>
                      </div>

                      <select
                        value={value}
                        disabled={
                          savingKey === `user:${permission.key}` ||
                          isProtectedPermission
                        }
                        onChange={(event) =>
                          void saveUserOverride(
                            permission.key,
                            event.target.value as OverrideValue,
                          )
                        }
                        aria-label={`Excepción de ${permission.label}`}
                      >
                        <option value="inherit">Heredado</option>
                        <option value="allow">Permitir</option>
                        <option value="deny">Denegar</option>
                      </select>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="permission-empty">
              {filteredUsers.length === 0
                ? 'No hay cuentas que coincidan con la búsqueda y el filtro.'
                : 'Seleccioná una cuenta para configurar sus excepciones.'}
            </p>
          )}
        </div>
      )}
    </section>
  )
}

export default PermissionMatrix
