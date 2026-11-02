
import { useState } from 'react'
import type { FormEvent } from 'react'
import { loginUser } from '../services/api'
import '../styles/Login.css'

interface LoginProps {
  onLoginSuccess: () => void
  onNavigateToRegister: () => void
}

function Login({
  onLoginSuccess,
  onNavigateToRegister,
}: LoginProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const data = await loginUser(username.trim(), password)

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))

      onLoginSuccess()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al iniciar sesión',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-decoration login-decoration-one" />
      <div className="login-decoration login-decoration-two" />

      <section className="login-card">
        <header className="login-header">
          <div className="login-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M16 21V19C16 16.8 14.2 15 12 15H7C4.8 15 3 16.8 3 19V21"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <circle
                cx="9.5"
                cy="7"
                r="4"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <path
                d="M17 11L19 13L23 8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <span className="login-eyebrow">
            PLATAFORMA DE ADMINISTRACIÓN
          </span>
          <h1>Sistema de usuarios</h1>
          <p>Administración de cuentas y permisos</p>
        </header>

        <div className="login-heading">
          <h2>Qué bueno tenerte de vuelta</h2>
          <p>Ingresá tus credenciales para continuar.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="username">Nombre de usuario</label>
            <input
              id="username"
              type="text"
              placeholder="Ingresá tu usuario"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Contraseña</label>

            <div className="login-password">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Ingresá tu contraseña"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={
                  showPassword
                    ? 'Ocultar contraseña'
                    : 'Mostrar contraseña'
                }
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          {error && (
            <p className="login-message" role="alert">
              {error}
            </p>
          )}

          <button
            className="login-submit"
            type="submit"
            disabled={loading}
          >
            <span>
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </span>
            {!loading && (
              <span className="login-submit-arrow">→</span>
            )}
          </button>
        </form>

        <div className="login-register">
          <span>¿Todavía no tenés una cuenta?</span>
          <button
            type="button"
            onClick={onNavigateToRegister}
          >
            Crear cuenta
          </button>
        </div>

        <footer className="login-card-footer">
          <span className="login-status" />
          Acceso seguro a tu espacio de trabajo
        </footer>
      </section>

      <footer className="login-page-footer">
        Sistema de usuarios <span>·</span> Gestión y control de acceso
      </footer>
    </main>
  )
}

export default Login
