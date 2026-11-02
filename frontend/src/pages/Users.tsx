import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  changeUserRole,
  createAdminUser,
  deleteUser,
  getPhotoUrl,
  getProfile,
  getUsers,
  updateManagedUser,
} from '../services/api';
import type { ManagedUserUpdate, UserRole } from '../services/api';
import AdminSidebar from '../components/AdminSidebar';
import '../styles/Users.css';

interface User {
  id: number;
  username: string;
  correo: string | null;
  role: UserRole;
}

interface UsersProps {
  onLogout: () => void;
  onNavigateToProfile: () => void;
  onNavigateToRolePermissions: () => void;
  onNavigateToProducts: () => void;
  onNavigateToUserRole: (role: UserRole) => void;
  userRole: UserRole;
  canViewProducts: boolean;
  permissions: Record<string, boolean>;
}

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrador',
  user: 'Usuario',
  provider: 'Proveedor',
};

const rolePluralLabels: Record<UserRole, string> = {
  admin: 'administradores',
  user: 'usuarios',
  provider: 'proveedores',
};

function Users({
  onLogout,
  onNavigateToProfile,
  onNavigateToRolePermissions,
  onNavigateToProducts,
  onNavigateToUserRole,
  userRole,
  canViewProducts,
  permissions,
}: UsersProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  const [selectedRoles, setSelectedRoles] = useState<
    Record<number, UserRole>
  >({});

  const [savingRole, setSavingRole] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>('user');
  const [creatingUser, setCreatingUser] = useState(false);
  const [createError, setCreateError] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('user');
  const [savingUser, setSavingUser] = useState(false);
  const [editError, setEditError] = useState('');

  let currentUser: User | null = null;

  try {
    currentUser = JSON.parse(
      localStorage.getItem('user') || 'null',
    ) as User | null;
  } catch {
    currentUser = null;
  }

  const isAdmin = currentUser?.role === 'admin';

  const canViewUsers = isAdmin && permissions['users.view'] === true;
  const canCreateUsers = isAdmin && permissions['users.create'] === true;
  const canEditUsers = isAdmin && permissions['users.edit'] === true;
  const canDeleteUsers = isAdmin && permissions['users.delete'] === true;
  const canChangeRole = isAdmin && permissions['users.role.change'] === true;

  const loadUsers = useCallback(async () => {
    if (!canViewUsers) {
      setUsers([]);
      setLoading(false);
      setError('');
      return;
    }

    const token = localStorage.getItem('token');

    if (!token) {
      setError('No hay una sesión activa. Iniciá sesión nuevamente.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const userList = await getUsers(token);

      setUsers(userList);

      setSelectedRoles((previous) => {
        const updated = { ...previous };

        userList.forEach((user) => {
          if (!(user.id in updated)) {
            updated[user.id] = user.role;
          }
        });

        return updated;
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al cargar los usuarios.',
      );
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [canViewUsers]);

  useEffect(() => {
    if (canViewUsers) {
      void loadUsers();
    } else {
      setUsers([]);
      setLoading(false);
      setError('');
    }
  }, [canViewUsers, loadUsers]);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) return;

    let active = true;

    const loadProfilePhoto = async () => {
      try {
        const profile = await getProfile(token);

        if (active) {
          setProfilePhoto(getPhotoUrl(profile.photoUrl));
        }
      } catch {
        if (active) {
          setProfilePhoto(null);
        }
      }
    };

    void loadProfilePhoto();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !creatingUser && !savingUser) {
        if (showCreateModal) {
          setShowCreateModal(false);
          setCreateError('');
        }
        if (editingUser) {
          setEditingUser(null);
          setEditError('');
        }
      }
    };

    if (showCreateModal || editingUser) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showCreateModal, creatingUser, editingUser, savingUser]);

  useEffect(() => {
    if (!canCreateUsers) {
      setShowCreateModal(false);
    }
  }, [canCreateUsers]);

  const usersForRole = users.filter((user) => user.role === userRole);
  const filteredUsers = usersForRole.filter((user) => {
    const searchText = search.trim().toLowerCase();

    return (
      user.username.toLowerCase().includes(searchText) ||
      (user.correo ?? '').toLowerCase().includes(searchText) ||
      String(user.id).includes(searchText) ||
      roleLabels[user.role].toLowerCase().includes(searchText)
    );
  });

  const handleChangeRole = async (user: User) => {
    if (!canChangeRole) {
      setError('No tenés permiso para cambiar roles.');
      return;
    }

    if (user.id === currentUser?.id) {
      setError('No podés cambiar tu propio rol.');
      return;
    }

    const newRole = selectedRoles[user.id] ?? user.role;

    if (newRole === user.role) {
      setMessage('El usuario ya tiene ese rol.');
      setError('');
      return;
    }

    const token = localStorage.getItem('token');

    if (!token) {
      setError('No hay una sesión activa.');
      return;
    }

    setError('');
    setMessage('');
    setSavingRole(user.id);

    try {
      const result = await changeUserRole(user.id, newRole, token);

      setUsers((previousUsers) =>
        previousUsers.map((item) =>
          item.id === user.id ? { ...item, ...result.user } : item,
        ),
      );

      setSelectedRoles((previous) => ({
        ...previous,
        [user.id]: newRole,
      }));

      setMessage(
        `El rol de "${user.username}" se cambió correctamente a ${roleLabels[newRole]}.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cambiar el rol.',
      );
    } finally {
      setSavingRole(null);
    }
  };

  const handleDelete = async (user: User) => {
    if (!canDeleteUsers) {
      setError('No tenés permiso para eliminar usuarios.');
      return;
    }

    if (user.id === currentUser?.id) {
      setError('No podés eliminar tu propia cuenta.');
      return;
    }

    const confirmed = window.confirm(
      `¿Seguro que querés eliminar al usuario "${user.username}"?`,
    );

    if (!confirmed) return;

    const token = localStorage.getItem('token');

    if (!token) {
      setError('No hay una sesión activa.');
      return;
    }

    setError('');
    setMessage('');

    try {
      await deleteUser(user.id, token);

      setUsers((previousUsers) =>
        previousUsers.filter((item) => item.id !== user.id),
      );

      setSelectedRoles((previous) => {
        const updated = { ...previous };
        delete updated[user.id];
        return updated;
      });

      setMessage(`El usuario "${user.username}" fue eliminado.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al eliminar el usuario.',
      );
    }
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    setEditUsername(user.username);
    setEditEmail(user.correo ?? '');
    setEditPassword('');
    setEditRole(selectedRoles[user.id] ?? user.role);
    setEditError('');
  };

  const handleEditUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingUser || (!canEditUsers && !canChangeRole)) return;

    const username = editUsername.trim();
    if (canEditUsers && (username.length < 1 || username.length > 50)) {
      setEditError('El nombre de usuario debe tener entre 1 y 50 caracteres.');
      return;
    }

    const correo = editEmail.trim().toLowerCase();
    if (
      canEditUsers &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 150)
    ) {
      setEditError('Ingresá un correo electrónico válido.');
      return;
    }

    if (canEditUsers && editPassword && editPassword.length < 8) {
      setEditError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      setEditError('No hay una sesión activa. Iniciá sesión nuevamente.');
      return;
    }

    setSavingUser(true);
    setEditError('');
    setError('');
    setMessage('');

    try {
      const update: ManagedUserUpdate = {
        ...(canEditUsers ? { username } : {}),
        ...(canEditUsers ? { correo } : {}),
        ...(canEditUsers && editPassword ? { password: editPassword } : {}),
        ...(canEditUsers || canChangeRole ? { role: editRole } : {}),
      };
      const result = await updateManagedUser(editingUser.id, update, token);
      const updatedUser = result.user;

      setUsers((previousUsers) =>
        previousUsers.map((user) =>
          user.id === editingUser.id ? { ...user, ...updatedUser } : user,
        ),
      );
      setSelectedRoles((previous) => ({
        ...previous,
        [editingUser.id]: updatedUser.role,
      }));
      setEditingUser(null);
      setEditPassword('');
      setMessage(
        `El usuario "${updatedUser.username}" se actualizó correctamente.`,
      );
    } catch (err) {
      setEditError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar el usuario.',
      );
    } finally {
      setSavingUser(false);
    }
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canCreateUsers) {
      setCreateError('No tenés permiso para crear usuarios.');
      return;
    }

    const username = createUsername.trim();
    const correo = createEmail.trim().toLowerCase();

    if (username.length < 3) {
      setCreateError('El nombre de usuario debe tener al menos 3 caracteres.');
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ||
      correo.length > 150
    ) {
      setCreateError('Ingresá un correo electrónico válido.');
      return;
    }

    if (createPassword.length < 8) {
      setCreateError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    const token = localStorage.getItem('token');

    if (!token) {
      setCreateError('No hay una sesión activa. Iniciá sesión nuevamente.');
      return;
    }

    setCreatingUser(true);
    setCreateError('');
    setError('');
    setMessage('');

    try {
      await createAdminUser(username, correo, createPassword, token, createRole);

      setShowCreateModal(false);
      setCreateUsername('');
      setCreateEmail('');
      setCreatePassword('');
      setCreateRole(userRole);
      setMessage(`El usuario "${username}" fue creado correctamente.`);

      if (canViewUsers) {
        await loadUsers();
      }
    } catch (err) {
      setCreateError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al crear el usuario.',
      );
    } finally {
      setCreatingUser(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    onLogout();
  };

  const usernameInitial =
    currentUser?.username?.charAt(0).toUpperCase() || 'U';
  const hasActions = canEditUsers || canChangeRole || canDeleteUsers;

  return (
    <main className="users-page">
      <AdminSidebar
        activePage={
          userRole === 'provider'
            ? 'providers'
            : userRole === 'admin'
              ? 'admins'
              : 'users'
        }
        canViewProducts={canViewProducts}
        onNavigateToUsers={() => onNavigateToUserRole('user')}
        onNavigateToUserRole={onNavigateToUserRole}
        onNavigateToProducts={onNavigateToProducts}
        onNavigateToRolePermissions={onNavigateToRolePermissions}
        onNavigateToProfile={onNavigateToProfile}
        onLogout={handleLogout}
      />

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
            <p className="users-alert users-alert-error" role="alert">
              <span>!</span>
              {error}
            </p>
          )}

          {message && (
            <p className="users-alert users-alert-success" role="status">
              <span>✓</span>
              {message}
            </p>
          )}

          <section className="users-table-card">
            <div className="users-table-header">
              <div>
                <span className="users-section-eyebrow">DIRECTORIO</span>
                <h2>
                  {userRole === 'provider'
                    ? 'Proveedores registrados'
                    : userRole === 'admin'
                      ? 'Administradores registrados'
                      : 'Usuarios registrados'}
                </h2>
                <p>
                  Listado de cuentas filtrado por rol y nivel de acceso.
                </p>
              </div>

              <div className="users-header-actions">
                {canCreateUsers && (
                  <button
                    className="users-create-button"
                    type="button"
                    onClick={() => {
                      setCreateError('');
                      setCreateRole(userRole);
                      setShowCreateModal(true);
                    }}
                  >
                    <span aria-hidden="true">＋</span>
                    Crear usuario
                  </button>
                )}

                {canViewUsers && (
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
                )}
              </div>
            </div>

            {!canViewUsers ? (
              <div className="users-empty">
                <strong>Listado no disponible</strong>
                <span>
                  No tenés permiso para consultar los usuarios.
                </span>
              </div>
            ) : (
              <>
                <div className="users-table-toolbar">
                  <label className="users-search">
                    <span className="users-search-icon">⌕</span>

                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar por usuario, correo o ID..."
                      aria-label={`Buscar ${rolePluralLabels[userRole]}`}
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
                    <strong>{filteredUsers.length}</strong> de {usersForRole.length}{' '}
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
                          <th>Correo electrónico</th>
                          <th>Rol y permisos</th>
                          <th>Estado</th>
                          {hasActions && <th>Acciones</th>}
                        </tr>
                      </thead>

                      <tbody>
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td
                              colSpan={hasActions ? 6 : 5}
                              className="users-empty"
                            >
                              <strong>
                                {search
                                  ? 'No encontramos coincidencias'
                                  : `No hay ${rolePluralLabels[userRole]} registrados.`}
                              </strong>
                              <span>
                                {search
                                  ? 'Probá con otro nombre, correo o ID.'
                                  : 'Los registros aparecerán aquí.'}
                              </span>
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((user) => {
                            const selectedRole =
                              selectedRoles[user.id] ?? user.role;
                            const isCurrentUser =
                              user.id === currentUser?.id;

                            return (
                              <tr key={user.id}>
                                <td>
                                  <span className="users-id">#{user.id}</span>
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

                                <td>{user.correo || 'Sin correo'}</td>

                                <td>
                                  {canChangeRole ? (
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
                                          isCurrentUser ||
                                          savingRole === user.id
                                        }
                                        onChange={(event) =>
                                          setSelectedRoles((previous) => ({
                                            ...previous,
                                            [user.id]: event.target
                                              .value as UserRole,
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
                                        <option value="provider">
                                          Proveedor
                                        </option>
                                        <option value="admin">
                                          Administrador
                                        </option>
                                      </select>

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
                                    </div>
                                  ) : (
                                    <span>{roleLabels[user.role]}</span>
                                  )}
                                </td>

                                <td>
                                  <span className="users-account-status">
                                    <span className="users-status-dot" />
                                    Registrado
                                  </span>
                                </td>

                                {hasActions ? (
                                  <td>
                                    {(canEditUsers ||
                                      (canChangeRole && !isCurrentUser)) && (
                                      <button
                                        className="users-edit-button"
                                        type="button"
                                        onClick={() => openEditUser(user)}
                                        aria-label={`Editar ${user.username}`}
                                        title={`Editar ${user.username}`}
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
                                          Editar {user.username}
                                        </span>
                                      </button>
                                    )}
                                    {canDeleteUsers && (
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
                                    )}
                                  </td>
                                ) : null}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            <footer className="users-table-footer">
              <span>
                Mostrando{' '}
                <strong>{canViewUsers ? filteredUsers.length : 0}</strong>{' '}
                {rolePluralLabels[userRole]}
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

      {showCreateModal && canCreateUsers && (
        <div
          className="users-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creatingUser) {
              setShowCreateModal(false);
              setCreateError('');
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
                  <span className="users-section-eyebrow">NUEVA CUENTA</span>
                  <h2 id="users-modal-title">Crear usuario</h2>
                  <p>Agregá una cuenta al directorio de SYSDESK.</p>
                </div>
              </div>

              <button
                className="users-modal-close"
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError('');
                }}
                disabled={creatingUser}
                aria-label="Cerrar ventana"
              >
                ×
              </button>
            </header>

            <form className="users-modal-form" onSubmit={handleCreateUser}>
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
                <span>Correo electrónico</span>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(event) => setCreateEmail(event.target.value)}
                  placeholder="nombre@ejemplo.com"
                  maxLength={150}
                  autoComplete="email"
                  required
                  disabled={creatingUser}
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
                <small>Usá al menos 8 caracteres para la contraseña.</small>
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
                    setShowCreateModal(false);
                    setCreateError('');
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

      {editingUser && (canEditUsers || canChangeRole) && (
        <div
          className="users-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingUser) {
              setEditingUser(null);
              setEditError('');
            }
          }}
        >
          <section
            className="users-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-edit-modal-title"
          >
            <header className="users-modal-header">
              <div className="users-modal-heading">
                <div className="users-modal-icon" aria-hidden="true">
                  ✎
                </div>

                <div>
                  <span className="users-section-eyebrow">EDITAR CUENTA</span>
                  <h2 id="users-edit-modal-title">Editar usuario</h2>
                  <p>Actualizá el nombre, contraseña o rol de la cuenta.</p>
                </div>
              </div>

              <button
                className="users-modal-close"
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setEditError('');
                }}
                disabled={savingUser}
                aria-label="Cerrar ventana"
              >
                ×
              </button>
            </header>

            <form className="users-modal-form" onSubmit={handleEditUser}>
              {editError && (
                <p className="users-alert users-alert-error" role="alert">
                  {editError}
                </p>
              )}

              {canEditUsers && (
                <>
                  <label className="users-modal-field">
                    <span>Nombre de usuario</span>
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(event) => setEditUsername(event.target.value)}
                      minLength={1}
                      maxLength={50}
                      autoComplete="off"
                      required
                      disabled={savingUser}
                      autoFocus
                    />
                  </label>

                  <label className="users-modal-field">
                    <span>Correo electrónico</span>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(event) => setEditEmail(event.target.value)}
                      maxLength={150}
                      autoComplete="email"
                      required
                      disabled={savingUser}
                    />
                  </label>

                  <label className="users-modal-field">
                    <span>Nueva contraseña</span>
                    <input
                      type="password"
                      value={editPassword}
                      onChange={(event) => setEditPassword(event.target.value)}
                      placeholder="Dejá vacío para conservarla"
                      minLength={8}
                      maxLength={72}
                      autoComplete="new-password"
                      disabled={savingUser}
                    />
                    <small>
                      Si la cambiás, debe tener al menos 8 caracteres.
                    </small>
                  </label>
                </>
              )}

              {(canEditUsers || canChangeRole) && (
                <label className="users-modal-field">
                  <span>Rol y permisos</span>
                  <select
                    value={editRole}
                    onChange={(event) =>
                      setEditRole(event.target.value as UserRole)
                    }
                    disabled={savingUser || editingUser.id === currentUser?.id}
                  >
                    <option value="user">Usuario</option>
                    <option value="provider">Proveedor</option>
                    <option value="admin">Administrador</option>
                  </select>
                  {editingUser.id === currentUser?.id && (
                    <small>No podés cambiar tu propio rol.</small>
                  )}
                </label>
              )}

              <div className="users-modal-actions">
                <button
                  className="users-refresh"
                  type="button"
                  onClick={() => {
                    setEditingUser(null);
                    setEditError('');
                  }}
                  disabled={savingUser}
                >
                  Cancelar
                </button>

                <button
                  className="users-create-button"
                  type="submit"
                  disabled={savingUser}
                >
                  {savingUser ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default Users;