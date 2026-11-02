
import { useState, type FormEvent } from 'react'
import { createAdminClient } from '../services/api'
import AdminSidebar, { type AdminPage } from '../components/AdminSidebar'
import '../styles/Users.css'

interface CreateUserProps {
  onBack: () => void
  onUserCreated: () => void
  onNavigateToProfile: () => void
  onNavigateToUsers: () => void
  onNavigateToUserRole: (role: 'admin' | 'provider' | 'user' | 'all') => void
  onNavigateToPage: (page: AdminPage) => void
  onNavigateToProducts: () => void
  onNavigateToRolePermissions: () => void
  canViewProducts: boolean
  onLogout: () => void
}

function CreateUser({
  onBack,
  onUserCreated,
  onNavigateToProfile,
  onNavigateToUsers,
  onNavigateToUserRole,
  onNavigateToPage,
  onNavigateToProducts,
  onNavigateToRolePermissions,
  canViewProducts,
  onLogout,
}: CreateUserProps) {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [formaPago, setFormaPago] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')

    const cleanEmail = correo.trim().toLowerCase()
    const cleanName = nombre.trim()
    const cleanPhone = telefono.trim()
    const cleanAddress = direccion.trim()
    const cleanDescription = descripcion.trim()
    const cleanPaymentMethod = formaPago.trim()

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
      cleanEmail.length > 150
    ) {
      setError('Ingresá un correo electrónico válido.')
      return
    }

    if (
      !cleanName ||
      cleanName.length > 150 ||
      !cleanPhone ||
      cleanPhone.length > 30 ||
      cleanAddress.length > 500 ||
      cleanDescription.length > 2000 ||
      cleanPaymentMethod.length > 100
    ) {
      setError('Ingresá un nombre y un teléfono válidos.')
      return
    }

    const token = localStorage.getItem('token')

    if (!token) {
      setError('Tu sesión no está disponible. Iniciá sesión nuevamente.')
      return
    }

    setLoading(true)

    try {
      const clientData = {
        nombre: cleanName,
        correo: cleanEmail,
        telefono: cleanPhone,
        direccion: cleanAddress,
        descripcion: cleanDescription,
        forma_pago: cleanPaymentMethod,
      }

      await createAdminClient(clientData, token)
      setMessage('La ficha del cliente se creó correctamente.')

      setNombre('')
      setCorreo('')
      setTelefono('')
      setDireccion('')
      setDescripcion('')
      setFormaPago('')
      window.setTimeout(onUserCreated, 900)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo crear la ficha del cliente.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="users-page">
      <AdminSidebar
        activePage="create-user"
        canViewProducts={canViewProducts}
        onNavigateToUsers={onNavigateToUsers}
        onNavigateToUserRole={onNavigateToUserRole}
        onNavigateToPage={onNavigateToPage}
        onNavigateToProducts={onNavigateToProducts}
        onNavigateToRolePermissions={onNavigateToRolePermissions}
        onNavigateToProfile={onNavigateToProfile}
        onLogout={onLogout}
      />

      <section className="users-main">
        <header className="users-topbar">
          <div className="users-breadcrumb">
            <span>Panel</span>
            <span className="users-breadcrumb-separator">/</span>
            <strong>Ficha cliente</strong>
          </div>
        </header>

        <div className="users-content">
          <section className="users-welcome">
            <div>
              <span className="users-eyebrow">
                CENTRO DE CONTROL / 02
              </span>
              <h1>
                Ficha cliente
                <span>.</span>
              </h1>
            </div>
          </section>

          <section className="users-table-card">
            <div className="users-table-header">
              <div>
                <span className="users-section-eyebrow">
                  NUEVO REGISTRO
                </span>
                <h2>Datos del cliente</h2>
              </div>
            </div>

            <form className="customer-create-form" onSubmit={handleSubmit}>
              <div className="customer-create-section">
                <div className="customer-create-heading">
                  <span className="customer-create-step">01</span>
                  <div>
                    <h3>Información de contacto</h3>
                  </div>
                </div>
                <div className="customer-create-grid">
                  <label className="users-modal-field">
                    <span>Nombre</span>
                    <input
                      type="text"
                      value={nombre}
                      onChange={(event) => setNombre(event.target.value)}
                      maxLength={150}
                      autoComplete="name"
                      required
                      disabled={loading}
                    />
                  </label>
                  <label className="users-modal-field">
                    <span>Correo electrónico</span>
                    <input
                      type="email"
                      value={correo}
                      onChange={(event) => setCorreo(event.target.value)}
                      maxLength={150}
                      autoComplete="email"
                      required
                      disabled={loading}
                    />
                  </label>
                  <label className="users-modal-field">
                    <span>Teléfono principal</span>
                    <input
                      type="tel"
                      value={telefono}
                      onChange={(event) => setTelefono(event.target.value)}
                      maxLength={30}
                      autoComplete="tel"
                      required
                      disabled={loading}
                    />
                  </label>
                  <label className="users-modal-field">
                    <span>Dirección</span>
                    <textarea
                      value={direccion}
                      onChange={(event) => setDireccion(event.target.value)}
                      maxLength={500}
                      autoComplete="street-address"
                      disabled={loading}
                      rows={2}
                    />
                  </label>
                  <label className="users-modal-field">
                    <span>Forma de pago</span>
                    <input
                      type="text"
                      value={formaPago}
                      onChange={(event) => setFormaPago(event.target.value)}
                      maxLength={100}
                      placeholder="Ej. efectivo, transferencia"
                      disabled={loading}
                    />
                  </label>
                  <label className="users-modal-field customer-create-full">
                    <span>Descripción / comentarios</span>
                    <textarea
                      value={descripcion}
                      onChange={(event) => setDescripcion(event.target.value)}
                      maxLength={2000}
                      disabled={loading}
                      rows={4}
                    />
                  </label>
                </div>
              </div>

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
                  {loading ? 'Guardando...' : 'Guardar ficha'}
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
