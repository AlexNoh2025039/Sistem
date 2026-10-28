
import { useState, type FormEvent } from 'react'
import { registerUser } from '../services/api'
import '../styles/Register.css'

interface RegisterProps {
  onBackToLogin: () => void
}

function Register({ onBackToLogin }: RegisterProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')

    const cleanUsername = username.trim()

    if (!cleanUsername || !password || !confirmPassword) {
      setError('Completá todos los campos.')
      return
    }

    if (cleanUsername.length < 3 || cleanUsername.length > 50) {
      setError('El nombre de usuario debe tener entre 3 y 50 caracteres.')
      return
    }

    if (
      password.length < 8 ||
      new TextEncoder().encode(password).length > 72
    ) {
      setError(
        'La contraseña debe tener al menos 8 caracteres y no superar los 72 bytes.',
      )
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)

    try {
      await registerUser(cleanUsername, password)

      setMessage('¡Cuenta creada correctamente! Ya podés iniciar sesión.')
      setUsername('')
      setPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al registrar la cuenta.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="register-page">
      <section className="register-card">
        <div className="register-header">
          <span className="register-eyebrow">SISTEMA DE USUARIOS</span>
          <h1>Crear cuenta</h1>
          <p>Completá tus datos para registrarte en el sistema.</p>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          <div className="register-field">
            <label htmlFor="register-username">Nombre de usuario</label>
            <input
              id="register-username"
              type="text"
              placeholder="Ingresá tu usuario"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              minLength={3}
              maxLength={50}
              autoComplete="username"
              required
            />
          </div>

          <div className="register-field">
            <label htmlFor="register-password">Contraseña</label>
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="register-field">
            <label htmlFor="register-confirm-password">
              Confirmar contraseña
            </label>
            <input
              id="register-confirm-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Repetí tu contraseña"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>

          <label className="register-show-password">
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(event) => setShowPassword(event.target.checked)}
            />
            Mostrar contraseñas
          </label>

          {error && (
            <p className="register-alert register-alert-error" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="register-alert register-alert-success" role="status">
              {message}
            </p>
          )}

          <button
            className="register-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creando cuenta...' : 'Registrarme'}
          </button>
        </form>

        <div className="register-footer">
          <span>¿Ya tenés una cuenta?</span>
          <button type="button" onClick={onBackToLogin}>
            Iniciar sesión
          </button>
        </div>
      </section>
    </main>
  )
}

export default Register
