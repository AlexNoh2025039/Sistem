
import { useState, type FormEvent } from 'react'
import { registerUser } from '../services/api'
import '../styles/Users.css'

interface CreateUserProps {
  onBack: () => void
  onUserCreated: () => void
  onNavigateToProfile: () => void
  onNavigateToUsers: () => void
  onLogout: () => void
}

function CreateUser({
  onBack,
  onUserCreated,
  onNavigateToProfile,
  onNavigateToUsers,
  onLogout,
}: CreateUserProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')

    const cleanUsername = username.trim()

    if (cleanUsername.length < 3 || cleanUsername.length > 50) {
      setError('El usuario debe tener entre 3 y 50 caracteres.')
      return
    }

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    const token = localStorage.getItem('token')

    if (!token) {
      setError('Tu sesión no está disponible. Iniciá sesión nuevamente.')
      return
    }

    setLoading(true)

    try {
      await registerUser(cleanUsername, password, token)

      setMessage('El usuario se creó correctamente.')
      setUsername('')
      setPassword('')
      setConfirmPassword('')

      window.setTimeout(() => onUserCreated(), 1000)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo crear el usuario.',
      )
    } finally {
      setLoading(false)
    }
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

        <nav className="users-navigation" aria-label="Navegación principal">
          <button
            className="users-nav-item"
            type="button"
            onClick={onNavigateToUsers}
          >
            <span className="users-nav-icon">▦</span>
            <span>Usuarios</span>
          </button>

          <button
            className="users-nav-item active"
            type="button"
            aria-current="page"
          >
            <span className="users-nav-icon">＋</span>
            <span>Crear usuario</span>
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
            <strong>Crear usuario</strong>
          </div>
        </header>

        <div className="users-content">
          <section className="users-welcome">
            <div>
              <span className="users-eyebrow">
                CENTRO DE CONTROL / 02
              </span>
              <h1>
                Crear usuario<span>.</span>
              </h1>
              <p>Registrá una nueva cuenta para el sistema.</p>
            </div>
          </section>

          <section className="users-table-card">
            <div className="users-table-header">
              <div>
                <span className="users-section-eyebrow">
                  NUEVO REGISTRO
                </span>
                <h2>Datos de la cuenta</h2>
                <p>Completá los campos para registrar al usuario.</p>
              </div>
            </div>

            <form className="create-user-form" onSubmit={handleSubmit}>
              <label>
                Nombre de usuario
                <input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  minLength={3}
                  maxLength={50}
                  autoComplete="username"
                  required
                />
              </label>

              <label>
                Contraseña
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>

              <label>
                Confirmar contraseña
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>

              <p className="create-user-note">
                La cuenta se creará con el rol de usuario estándar.
              </p>

              {error && (
                <p role="alert" className="users-alert users-alert-error">
                  {error}
                </p>
              )}

              {message && (
                <p role="status" className="users-alert users-alert-success">
                  {message}
                </p>
              )}

              <div className="create-user-actions">
                <button
                  className="users-refresh"
                  type="button"
                  onClick={onBack}
                  disabled={loading}
                >
                  Volver
                </button>

                <button
                  className="users-create-button"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Creando...' : 'Crear cuenta'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </section>
    </main>
  )
}

export default CreateUser
