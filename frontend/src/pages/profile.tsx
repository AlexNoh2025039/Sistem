import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import {
  changePassword,
  getPhotoUrl,
  getProfile,
  updateProfile,
  uploadProfilePhoto,
  type ProfileUser,
} from '../services/api'
import '../styles/Users.css'

type UserRole = 'admin' | 'user' | 'provider'
type ProfileTab = 'info' | 'photo' | 'password'

interface ProfileProps {
  onNavigateToUsers: () => void
  onNavigateToCreateUser: () => void
  onLogout: () => void
}

interface StoredUser {
  id: number
  username: string
  role: UserRole
}

function Profile({
  onNavigateToUsers,
  onNavigateToCreateUser,
  onLogout,
}: ProfileProps) {
  const [user, setUser] = useState<
    (StoredUser & {
      correo: string
      photoUrl: string | null
    }) | null
  >(null)

  const [username, setUsername] = useState('')
  const [correo, setCorreo] = useState('')
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [activeTab, setActiveTab] = useState<ProfileTab>('info')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)

  const [photoMessage, setPhotoMessage] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [photoLoading, setPhotoLoading] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const photoInputRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let active = true

    const loadProfile = async () => {
      const token = localStorage.getItem('token')

      if (!token) {
        setProfileError(
          'No hay una sesión activa. Iniciá sesión nuevamente.',
        )
        return
      }

      try {
        const profile = await getProfile(token)

        if (!active) return

        const storedUser = JSON.parse(
          localStorage.getItem('user') || 'null',
        ) as StoredUser | null

        const profileData = profile as ProfileUser & {
          id?: number
          username?: string
          role?: UserRole
          correo?: string
          email?: string
          photoUrl?: string | null
        }

        const nextUser = {
          id: profileData.id ?? storedUser?.id ?? 0,
          username: profileData.username ?? storedUser?.username ?? '',
          role: profileData.role ?? storedUser?.role ?? 'user',
          correo: profileData.correo ?? profileData.email ?? '',
          photoUrl: profileData.photoUrl ?? null,
        }

        setUser(nextUser)
        setUsername(nextUser.username)
        setCorreo(nextUser.correo)
      } catch (err) {
        if (!active) return

        setProfileError(
          err instanceof Error
            ? err.message
            : 'No se pudo cargar tu perfil.',
        )
      }
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  const isAdmin = user?.role === 'admin'
  const isProvider = user?.role === 'provider'

  const usernameInitial =
    user?.username?.charAt(0).toUpperCase() || 'U'

  const displayedPhoto =
    previewUrl || getPhotoUrl(user?.photoUrl ?? null)

  const roleLabels: Record<UserRole, string> = {
    admin: 'Administrador',
    user: 'Usuario',
    provider: 'Proveedor',
  }

  const clearPreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }

    setPreviewUrl(null)
    setSelectedPhoto(null)

    if (photoInputRef.current) {
      photoInputRef.current.value = ''
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    onLogout()
  }

  const handleEditProfile = () => {
    setUsername(user?.username ?? '')
    setCorreo(user?.correo ?? '')
    setProfileMessage('')
    setProfileError('')
    setIsEditingProfile(true)
  }

  const handleCancelEdit = () => {
    setUsername(user?.username ?? '')
    setCorreo(user?.correo ?? '')
    setProfileMessage('')
    setProfileError('')
    setIsEditingProfile(false)
  }

  const handleProfileSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    const cleanUsername = username.trim()
    const cleanCorreo = correo.trim()

    if (!cleanUsername) {
      setProfileError('El nombre de usuario es obligatorio.')
      setProfileMessage('')
      return
    }

    if (!cleanCorreo) {
      setProfileError('El correo electrónico es obligatorio.')
      setProfileMessage('')
      return
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailPattern.test(cleanCorreo)) {
      setProfileError('Ingresá un correo electrónico válido.')
      setProfileMessage('')
      return
    }

    const token = localStorage.getItem('token')

    if (!token) {
      setProfileError('No hay una sesión activa.')
      setProfileMessage('')
      return
    }

    setProfileLoading(true)
    setProfileError('')
    setProfileMessage('')

    try {
      await updateProfile(
        {
          username: cleanUsername,
          correo: cleanCorreo,
        },
        token,
      )

      const updatedUser = {
        ...user!,
        username: cleanUsername,
        correo: cleanCorreo,
      }

      setUser(updatedUser)
      setUsername(cleanUsername)
      setCorreo(cleanCorreo)

      const storedUser = JSON.parse(
        localStorage.getItem('user') || '{}',
      ) as Record<string, unknown>

      localStorage.setItem(
        'user',
        JSON.stringify({
          ...storedUser,
          username: cleanUsername,
        }),
      )

      setIsEditingProfile(false)
      setProfileMessage('Tu información se actualizó correctamente.')
    } catch (err) {
      setProfileError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar tu información.',
      )
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePhotoChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]

    setPhotoError('')
    setPhotoMessage('')

    if (!file) return

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ]

    if (!allowedTypes.includes(file.type)) {
      setPhotoError(
        'Seleccioná una imagen JPG, PNG o WebP.',
      )
      event.target.value = ''
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('La imagen no debe superar los 2 MB.')
      event.target.value = ''
      return
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }

    const nextPreviewUrl = URL.createObjectURL(file)

    previewUrlRef.current = nextPreviewUrl
    setPreviewUrl(nextPreviewUrl)
    setSelectedPhoto(file)
  }

  const handlePhotoSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (!selectedPhoto) {
      setPhotoError('Primero seleccioná una imagen.')
      setPhotoMessage('')
      return
    }

    const token = localStorage.getItem('token')

    if (!token) {
      setPhotoError('No hay una sesión activa.')
      setPhotoMessage('')
      return
    }

    setPhotoLoading(true)
    setPhotoError('')
    setPhotoMessage('')

    try {
      const result = await uploadProfilePhoto(
        selectedPhoto,
        token,
      )

      const resultData = result as {
        photoUrl?: string | null
        user?: {
          photoUrl?: string | null
        }
      }

      const nextPhotoUrl =
        resultData.user?.photoUrl ??
        resultData.photoUrl ??
        user?.photoUrl ??
        null

      setUser((previous) =>
        previous
          ? {
              ...previous,
              photoUrl: nextPhotoUrl,
            }
          : previous,
      )

      clearPreview()
      setPhotoMessage('Tu foto de perfil se actualizó correctamente.')
    } catch (err) {
      setPhotoError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar la foto de perfil.',
      )
    } finally {
      setPhotoLoading(false)
    }
  }

  const handlePasswordSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setPasswordError('')
    setPasswordMessage('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Completá todos los campos de contraseña.')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError(
        'La nueva contraseña debe tener al menos 8 caracteres.',
      )
      return
    }

    if (new TextEncoder().encode(newPassword).length > 72) {
      setPasswordError(
        'La nueva contraseña supera el límite permitido de 72 bytes.',
      )
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas nuevas no coinciden.')
      return
    }

    if (newPassword === currentPassword) {
      setPasswordError(
        'La nueva contraseña debe ser diferente de la actual.',
      )
      return
    }

    const token = localStorage.getItem('token')

    if (!token) {
      setPasswordError('No hay una sesión activa.')
      return
    }

    setPasswordLoading(true)

    try {
      await changePassword(
        currentPassword,
        newPassword,
        token,
      )

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Tu contraseña se cambió correctamente.')
    } catch (err) {
      setPasswordError(
        err instanceof Error
          ? err.message
          : 'No se pudo cambiar la contraseña.',
      )
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleTabChange = (tab: ProfileTab) => {
    setActiveTab(tab)
    setProfileError('')
    setProfileMessage('')
    setPhotoError('')
    setPhotoMessage('')
    setPasswordError('')
    setPasswordMessage('')
  }

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
            className="users-nav-item"
            type="button"
            onClick={onNavigateToUsers}
          >
            <span className="users-nav-icon">▦</span>
            <span>
              {isProvider
                ? 'Mi inventario'
                : isAdmin
                  ? 'Usuarios'
                  : 'Catálogo'}
            </span>
          </button>

          {isProvider && (
            <button
              className="users-nav-item"
              type="button"
              onClick={onNavigateToCreateUser}
            >
              <span className="users-nav-icon">▤</span>
              <span>Mi empresa</span>
            </button>
          )}

          <button
            className="users-nav-item active"
            type="button"
            aria-current="page"
          >
            <span className="users-nav-icon">◎</span>
            <span>Mi perfil</span>
            <span className="users-nav-indicator" />
          </button>
        </nav>

        <div className="users-sidebar-bottom">
          <div className="users-sidebar-account">
            <div className="users-avatar">
              {usernameInitial}
            </div>

            <div className="users-sidebar-account-info">
              <strong>{user?.username ?? 'Cargando...'}</strong>
              <span>{user ? roleLabels[user.role] : 'Cuenta'}</span>
            </div>
          </div>

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
            <strong>Mi perfil</strong>
          </div>

          <div className="users-topbar-right">
            <span className="users-live-indicator">
              <span className="users-status-dot" />
              Conectado
            </span>

            <div className="users-topbar-divider" />

            <div className="users-topbar-account">
              {displayedPhoto ? (
                <img
                  className="users-avatar"
                  src={displayedPhoto}
                  alt="Foto de perfil"
                />
              ) : (
                <div className="users-avatar">
                  {usernameInitial}
                </div>
              )}

              <span>{user?.username ?? 'Usuario'}</span>
            </div>
          </div>
        </header>

        <div className="users-content">
          <section className="users-welcome">
            <div>
              <span className="users-section-eyebrow">
                CONFIGURACIÓN DE CUENTA
              </span>

              <h1>Mi perfil.</h1>

              <p>
                Administrá tu información personal y las opciones
                de seguridad de tu cuenta.
              </p>
            </div>
          </section>

          {profileError && activeTab === 'info' && (
            <p
              className="users-alert users-alert-error"
              role="alert"
            >
              <span>!</span>
              {profileError}
            </p>
          )}

          <section className="profile-overview-card">
            <div className="profile-overview-avatar">
              {displayedPhoto ? (
                <img
                  src={displayedPhoto}
                  alt="Foto de perfil"
                />
              ) : (
                <span>{usernameInitial}</span>
              )}
            </div>

            <div className="profile-overview-info">
              <span className="users-section-eyebrow">
                PERFIL DE USUARIO
              </span>

              <h2>{user?.username ?? 'Cargando perfil...'}</h2>

              <p>
                {user?.correo || 'No se ha registrado un correo'}
              </p>

              <div className="profile-overview-badges">
                <span className="profile-role-badge">
                  {user ? roleLabels[user.role] : 'Cuenta'}
                </span>

                <span className="users-account-status">
                  <span className="users-status-dot" />
                  Activa
                </span>
              </div>
            </div>

            <div className="profile-overview-id">
              <span>ID DE CUENTA</span>
              <strong>{user?.id ? `#${user.id}` : '—'}</strong>
            </div>
          </section>

          <section className="profile-settings-card">
            <div className="profile-settings-heading">
              <div>
                <span className="users-section-eyebrow">
                  AJUSTES
                </span>

                <h2>Configuración del perfil</h2>

                <p>
                  Seleccioná qué parte de tu cuenta querés
                  administrar.
                </p>
              </div>
            </div>

            <div
              className="profile-tabs"
              role="tablist"
              aria-label="Configuración de la cuenta"
            >
              <button
                className={`profile-tab ${
                  activeTab === 'info' ? 'active' : ''
                }`}
                id="profile-tab-info"
                type="button"
                role="tab"
                aria-selected={activeTab === 'info'}
                aria-controls="profile-panel-info"
                onClick={() => handleTabChange('info')}
              >
                <span className="profile-tab-icon">◎</span>
                <span>Información personal</span>
              </button>

              <button
                className={`profile-tab ${
                  activeTab === 'photo' ? 'active' : ''
                }`}
                id="profile-tab-photo"
                type="button"
                role="tab"
                aria-selected={activeTab === 'photo'}
                aria-controls="profile-panel-photo"
                onClick={() => handleTabChange('photo')}
              >
                <span className="profile-tab-icon">▧</span>
                <span>Foto de perfil</span>
              </button>

              <button
                className={`profile-tab ${
                  activeTab === 'password' ? 'active' : ''
                }`}
                id="profile-tab-password"
                type="button"
                role="tab"
                aria-selected={activeTab === 'password'}
                aria-controls="profile-panel-password"
                onClick={() => handleTabChange('password')}
              >
                <span className="profile-tab-icon">⌑</span>
                <span>Cambiar contraseña</span>
              </button>
            </div>

            {activeTab === 'info' && (
              <div
                className="profile-tab-panel"
                id="profile-panel-info"
                role="tabpanel"
                aria-labelledby="profile-tab-info"
              >
                <div className="profile-panel-heading">
                  <div>
                    <h3>Información personal</h3>
                    <p>
                      Actualizá tu nombre de usuario y correo
                      electrónico.
                    </p>
                  </div>

                  {!isEditingProfile && (
                    <button
                      className="users-refresh"
                      type="button"
                      onClick={handleEditProfile}
                      disabled={!user}
                    >
                      <span>✎</span>
                      Editar información
                    </button>
                  )}
                </div>

                {profileMessage && (
                  <p
                    className="users-alert users-alert-success"
                    role="status"
                  >
                    <span>✓</span>
                    {profileMessage}
                  </p>
                )}

                {profileError && (
                  <p
                    className="users-alert users-alert-error"
                    role="alert"
                  >
                    <span>!</span>
                    {profileError}
                  </p>
                )}

                <form
                  className="profile-form"
                  onSubmit={handleProfileSubmit}
                >
                  <div className="profile-form-grid">
                    <label className="profile-field">
                      <span>Nombre de usuario</span>

                      <input
                        type="text"
                        value={username}
                        onChange={(event) =>
                          setUsername(event.target.value)
                        }
                        readOnly={!isEditingProfile}
                        autoComplete="username"
                        maxLength={50}
                        required
                      />

                      <small>
                        Es el nombre con el que identificás tu cuenta.
                      </small>
                    </label>

                    <label className="profile-field">
                      <span>Correo electrónico</span>

                      <input
                        type="email"
                        value={correo}
                        onChange={(event) =>
                          setCorreo(event.target.value)
                        }
                        readOnly={!isEditingProfile}
                        autoComplete="email"
                        required
                      />

                      <small>
                        Usá una dirección de correo válida.
                      </small>
                    </label>

                    <label className="profile-field">
                      <span>Rol de la cuenta</span>

                      <input
                        type="text"
                        value={user ? roleLabels[user.role] : ''}
                        readOnly
                      />

                      <small>
                        El rol determina los permisos disponibles.
                      </small>
                    </label>

                    <label className="profile-field">
                      <span>ID de usuario</span>

                      <input
                        type="text"
                        value={user?.id ? `#${user.id}` : ''}
                        readOnly
                      />

                      <small>
                        Identificador asignado por el sistema.
                      </small>
                    </label>
                  </div>

                  {isEditingProfile && (
                    <div className="profile-form-actions">
                      <button
                        className="users-secondary-button"
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={profileLoading}
                      >
                        Cancelar
                      </button>

                      <button
                        className="users-primary-button"
                        type="submit"
                        disabled={profileLoading}
                      >
                        {profileLoading
                          ? 'Guardando...'
                          : 'Guardar cambios'}
                      </button>
                    </div>
                  )}
                </form>
              </div>
            )}

            {activeTab === 'photo' && (
              <div
                className="profile-tab-panel"
                id="profile-panel-photo"
                role="tabpanel"
                aria-labelledby="profile-tab-photo"
              >
                <div className="profile-panel-heading">
                  <div>
                    <h3>Foto de perfil</h3>
                    <p>
                      Elegí una imagen para personalizar tu cuenta.
                    </p>
                  </div>
                </div>

                {photoMessage && (
                  <p
                    className="users-alert users-alert-success"
                    role="status"
                  >
                    <span>✓</span>
                    {photoMessage}
                  </p>
                )}

                {photoError && (
                  <p
                    className="users-alert users-alert-error"
                    role="alert"
                  >
                    <span>!</span>
                    {photoError}
                  </p>
                )}

                <form
                  className="profile-photo-form"
                  onSubmit={handlePhotoSubmit}
                >
                  <div className="profile-photo-preview">
                    {displayedPhoto ? (
                      <img
                        src={displayedPhoto}
                        alt="Vista previa de la foto de perfil"
                      />
                    ) : (
                      <span>{usernameInitial}</span>
                    )}
                  </div>

                  <div className="profile-photo-details">
                    <strong>Tu imagen de perfil</strong>

                    <p>
                      Seleccioná una imagen JPG, PNG o WebP.
                      El tamaño máximo permitido es de 2 MB.
                    </p>

                    <input
                      ref={photoInputRef}
                      className="profile-file-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoChange}
                      aria-label="Seleccionar foto de perfil"
                    />

                    {selectedPhoto && (
                      <span className="profile-selected-file">
                        Archivo seleccionado: {selectedPhoto.name}
                      </span>
                    )}

                    <div className="profile-form-actions">
                      <button
                        className="users-secondary-button"
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={photoLoading}
                      >
                        Seleccionar imagen
                      </button>

                      <button
                        className="users-primary-button"
                        type="submit"
                        disabled={photoLoading || !selectedPhoto}
                      >
                        {photoLoading
                          ? 'Subiendo...'
                          : 'Guardar foto'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'password' && (
              <div
                className="profile-tab-panel"
                id="profile-panel-password"
                role="tabpanel"
                aria-labelledby="profile-tab-password"
              >
                <div className="profile-panel-heading">
                  <div>
                    <h3>Cambiar contraseña</h3>
                    <p>
                      Elegí una contraseña segura para proteger tu
                      cuenta.
                    </p>
                  </div>
                </div>

                {passwordMessage && (
                  <p
                    className="users-alert users-alert-success"
                    role="status"
                  >
                    <span>✓</span>
                    {passwordMessage}
                  </p>
                )}

                {passwordError && (
                  <p
                    className="users-alert users-alert-error"
                    role="alert"
                  >
                    <span>!</span>
                    {passwordError}
                  </p>
                )}

                <form
                  className="profile-form profile-password-form"
                  onSubmit={handlePasswordSubmit}
                >
                  <label className="profile-field">
                    <span>Contraseña actual</span>

                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(event) =>
                        setCurrentPassword(event.target.value)
                      }
                      autoComplete="current-password"
                      placeholder="Ingresá tu contraseña actual"
                      required
                    />
                  </label>

                  <div className="profile-form-grid">
                    <label className="profile-field">
                      <span>Nueva contraseña</span>

                      <input
                        type="password"
                        value={newPassword}
                        onChange={(event) =>
                          setNewPassword(event.target.value)
                        }
                        autoComplete="new-password"
                        placeholder="Mínimo 8 caracteres"
                        required
                      />
                    </label>

                    <label className="profile-field">
                      <span>Confirmar nueva contraseña</span>

                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        autoComplete="new-password"
                        placeholder="Repetí la nueva contraseña"
                        required
                      />
                    </label>
                  </div>

                  <div className="profile-password-hint">
                    <span>i</span>
                    <p>
                      Usá al menos 8 caracteres y evitá reutilizar
                      tu contraseña actual.
                    </p>
                  </div>

                  <div className="profile-form-actions">
                    <button
                      className="users-primary-button"
                      type="submit"
                      disabled={passwordLoading}
                    >
                      {passwordLoading
                        ? 'Actualizando...'
                        : 'Cambiar contraseña'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>

          <footer className="users-footer">
            <span>SYSDESK</span>
            <span>·</span>
            <span>Sistema de usuarios</span>
          </footer>
        </div>
      </section>
    </main>
  )
}

export default Profile