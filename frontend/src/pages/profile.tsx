
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'

import {
  changePassword,
  getPhotoUrl,
  getProfile,
  updateProfile,
  uploadProfilePhoto,
  type ProfileUser,
} from '../services/api'

import '../styles/Users.css'

interface ProfileProps {
  onNavigateToUsers: () => void
  onNavigateToCreateUser: () => void
  onLogout: () => void
}

interface StoredUser {
  id: number
  username: string
  role: 'admin' | 'user' | 'provider'
}

function Profile({
  onNavigateToUsers,
  onNavigateToCreateUser,
  onLogout,
}: ProfileProps) {
  const [storedUser] = useState<StoredUser | null>(() => {
    try {
      return JSON.parse(
        localStorage.getItem('user') || 'null',
      ) as StoredUser | null
    } catch {
      return null
    }
  })

  const [user, setUser] = useState<ProfileUser | null>(
    storedUser
      ? { ...storedUser, correo: '', photoUrl: null }
      : null,
  )

  const [username, setUsername] = useState(storedUser?.username ?? '')
  const [correo, setCorreo] = useState('')
  const [isEditingProfile, setIsEditingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)

  const [photoMessage, setPhotoMessage] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [photoLoading, setPhotoLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const photoInputRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')

    if (!token) {
      setError('Tu sesión no está disponible. Iniciá sesión nuevamente.')
      return
    }

    let active = true

    const loadProfile = async () => {
      try {
        const profile = await getProfile(token)

        if (active) {
          setUser(profile)
          setUsername(profile.username)
          setCorreo(profile.correo ?? '')
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar tu perfil.',
          )
        }
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

  const handleEditProfile = () => {
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
    setProfileMessage('')
    setProfileError('')

    const cleanUsername = username.trim()
    const cleanCorreo = correo.trim()

    if (!cleanUsername || !cleanCorreo) {
      setProfileError('Completá el nombre de usuario y el correo.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanCorreo)) {
      setProfileError('Ingresá un correo electrónico válido.')
      return
    }

    const token = localStorage.getItem('token')

    if (!token) {
      setProfileError(
        'Tu sesión no está disponible. Iniciá sesión nuevamente.',
      )
      return
    }

    setProfileLoading(true)

    try {
      const updatedProfile = await updateProfile(
        {
          username: cleanUsername,
          correo: cleanCorreo,
        },
        token,
      )

      setUser((currentUser) =>
        currentUser
          ? {
            ...currentUser,
            ...updatedProfile,
            photoUrl:
              updatedProfile.photoUrl ?? currentUser.photoUrl,
          }
          : updatedProfile,
      )

      setUsername(updatedProfile.username)
      setCorreo(updatedProfile.correo)

      const savedUser = localStorage.getItem('user')

      if (savedUser) {
        try {
          const parsedUser = JSON.parse(savedUser) as StoredUser

          localStorage.setItem(
            'user',
            JSON.stringify({
              ...parsedUser,
              username: updatedProfile.username,
            }),
          )
        } catch {
          // Los datos del perfil ya se actualizaron en el servidor.
        }
      }

      setProfileMessage(
        'Los datos de tu cuenta se actualizaron correctamente.',
      )
      setIsEditingProfile(false)
    } catch (err) {
      setProfileError(
        err instanceof Error
          ? err.message
          : 'No se pudieron actualizar los datos de tu cuenta.',
      )
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePhotoSelection = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]

    setPhotoMessage('')
    setPhotoError('')

    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
      setPhotoError('Seleccioná una imagen JPG, PNG o WebP.')
      event.target.value = ''
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('La imagen no puede superar los 2 MB.')
      event.target.value = ''
      return
    }

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }

    const newPreviewUrl = URL.createObjectURL(file)

    previewUrlRef.current = newPreviewUrl
    setPreviewUrl(newPreviewUrl)
  }

  const handlePhotoSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()
    setPhotoMessage('')
    setPhotoError('')

    const file = photoInputRef.current?.files?.[0]
    const token = localStorage.getItem('token')

    if (!token) {
      setPhotoError(
        'Tu sesión no está disponible. Iniciá sesión nuevamente.',
      )
      return
    }

    if (!file) {
      setPhotoError('Seleccioná una imagen antes de continuar.')
      return
    }

    setPhotoLoading(true)

    try {
      const result = await uploadProfilePhoto(file, token)

      setUser((currentUser) =>
        currentUser
          ? { ...currentUser, photoUrl: result.photoUrl }
          : currentUser,
      )

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }

      setPreviewUrl(null)

      if (photoInputRef.current) {
        photoInputRef.current.value = ''
      }

      setPhotoMessage(result.message)
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
    setMessage('')
    setError('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Completá todos los campos.')
      return
    }

    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (new TextEncoder().encode(newPassword).length > 72) {
      setError('La nueva contraseña supera el límite de 72 bytes.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Las nuevas contraseñas no coinciden.')
      return
    }

    if (newPassword === currentPassword) {
      setError('La nueva contraseña debe ser diferente de la actual.')
      return
    }

    const token = localStorage.getItem('token')

    if (!token) {
      setError('Tu sesión no está disponible. Iniciá sesión nuevamente.')
      return
    }

    setLoading(true)

    try {
      const result = await changePassword(
        currentPassword,
        newPassword,
        token,
      )

      setMessage(result.message)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cambiar la contraseña.',
      )
    } finally {
      setLoading(false)
    }
  }

  const usernameInitial = user?.username?.charAt(0).toUpperCase() || 'U'
  const isAdmin = user?.role === 'admin'
  const isProvider = user?.role === 'provider'
  const displayedPhoto = previewUrl || getPhotoUrl(user?.photoUrl ?? null)

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

          {isAdmin && (
            <button
              className="users-nav-item"
              type="button"
              onClick={onNavigateToCreateUser}
            >
              <span className="users-nav-icon">＋</span>
              <span>Crear usuario</span>
            </button>
          )}

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
            <span>Mi cuenta</span>
            <span className="users-nav-indicator" />
          </button>
        </nav>

        <div className="users-sidebar-bottom">
          <button
            className="users-logout"
            type="button"
            onClick={onLogout}
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
            <strong>Mi cuenta</strong>
          </div>
        </header>

        <div className="users-content">
          <section className="users-welcome">
            <div>
              <span className="users-eyebrow">CUENTA PERSONAL</span>
              <h1>
                Mi cuenta<span>.</span>
              </h1>
              <p>
                Actualizá tus datos personales y la seguridad de tu cuenta.
              </p>
            </div>
          </section>

          <section className="users-table-card profile-card">
            <div className="profile-heading">
              {displayedPhoto ? (
                <img
                  className="profile-avatar"
                  src={displayedPhoto}
                  alt={`Foto de perfil de ${user?.username ?? 'usuario'}`}
                />
              ) : (
                <div
                  className="profile-avatar"
                  aria-label="Sin foto de perfil"
                >
                  {usernameInitial}
                </div>
              )}

              <div className="profile-heading-info">
                <h2>{user?.username ?? 'Usuario'}</h2>
                <p>
                  {isAdmin
                    ? 'Administrador'
                    : isProvider
                      ? 'Proveedor'
                      : 'Usuario estándar'}
                </p>
                <span className="users-account-status">
                  <span className="users-status-dot" />
                  Cuenta activa en esta sesión
                </span>
              </div>
            </div>

            <div className="profile-details">
              <div>
                <span>ID de usuario</span>
                <strong>{user?.id ?? 'No disponible'}</strong>
              </div>
              <div>
                <span>Rol</span>
                <strong>
                  {isAdmin
                    ? 'Administrador'
                    : isProvider
                      ? 'Proveedor'
                      : 'Usuario estándar'}
                </strong>
              </div>
            </div>

            <div className="users-table-header">
              <div>
                <span className="users-section-eyebrow">
                  DATOS PERSONALES
                </span>
                <h2>Información de la cuenta</h2>
                <p>
                  {isEditingProfile
                    ? 'Editá tus datos y guardá los cambios.'
                    : 'Consultá tus datos personales o seleccioná Editar para modificarlos.'}
                </p>
              </div>

              {!isEditingProfile && (
                <button
                  className="users-refresh"
                  type="button"
                  onClick={handleEditProfile}
                  aria-label="Editar información de la cuenta"
                  title="Editar perfil"
                >
                  ✎ Editar
                </button>
              )}
            </div>

            <form
              className="create-user-form"
              onSubmit={handleProfileSubmit}
            >
              <label>
                Nombre de usuario
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  maxLength={50}
                  readOnly={!isEditingProfile}
                  required
                />
              </label>

              <label>
                Correo electrónico
                <input
                  type="email"
                  value={correo}
                  onChange={(event) => setCorreo(event.target.value)}
                  autoComplete="email"
                  maxLength={255}
                  readOnly={!isEditingProfile}
                  required
                />
              </label>

              {profileError && (
                <div className="users-alert users-alert-error" role="alert">
                  {profileError}
                </div>
              )}

              {profileMessage && (
                <div className="users-alert" role="status">
                  {profileMessage}
                </div>
              )}

              {isEditingProfile && (
                <div className="create-user-actions">
                  <button
                    className="users-refresh"
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={profileLoading}
                  >
                    Cancelar
                  </button>

                  <button
                    className="users-create-button"
                    type="submit"
                    disabled={profileLoading}
                  >
                    {profileLoading ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              )}
            </form>
          </section>

          <section className="users-table-card profile-card">
            <div className="users-table-header">
              <div>
                <span className="users-section-eyebrow">FOTO DE PERFIL</span>
                <h2>Imagen de tu cuenta</h2>
                <p>
                  Seleccioná una imagen JPG, PNG o WebP de hasta 2 MB.
                </p>
              </div>
            </div>

            <form
              className="create-user-form"
              onSubmit={handlePhotoSubmit}
            >
              <label>
                Seleccionar imagen
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoSelection}
                />
              </label>

              {previewUrl && (
                <div className="profile-photo-preview">
                  <img
                    className="profile-avatar"
                    src={previewUrl}
                    alt="Vista previa de la nueva foto"
                  />
                </div>
              )}

              {photoError && (
                <div className="users-alert users-alert-error" role="alert">
                  {photoError}
                </div>
              )}

              {photoMessage && (
                <div className="users-alert" role="status">
                  {photoMessage}
                </div>
              )}

              <div className="create-user-actions">
                <button
                  className="users-create-button"
                  type="submit"
                  disabled={photoLoading}
                >
                  {photoLoading ? 'Subiendo...' : 'Actualizar foto'}
                </button>
              </div>
            </form>
          </section>

          <section className="users-table-card profile-card">
            <div className="users-table-header">
              <div>
                <span className="users-section-eyebrow">SEGURIDAD</span>
                <h2>Cambiar contraseña</h2>
                <p>
                  Usá una contraseña de al menos 8 caracteres.
                </p>
              </div>
            </div>

            <form
              className="create-user-form"
              onSubmit={handlePasswordSubmit}
            >
              <label>
                Contraseña actual
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) =>
                    setCurrentPassword(event.target.value)
                  }
                  autoComplete="current-password"
                  required
                />
              </label>

              <label>
                Nueva contraseña
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>

              <label>
                Confirmar nueva contraseña
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>

              {error && (
                <div className="users-alert users-alert-error" role="alert">
                  {error}
                </div>
              )}

              {message && (
                <div className="users-alert" role="status">
                  {message}
                </div>
              )}

              <div className="create-user-actions">
                <button
                  className="users-create-button"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Actualizando...' : 'Cambiar contraseña'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </section>
    </main>
  )
}

export default Profile
