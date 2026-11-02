import { useState, type ChangeEvent, type FormEvent } from 'react'
import {
  createAdminProvider,
  updateAdminProvider,
  type AdminProvider,
  type AdminProviderInput,
} from '../services/api'
import AdminSidebar, { type AdminPage } from '../components/AdminSidebar'
import '../styles/Users.css'

interface ProviderFormProps {
  provider: AdminProvider | null
  onBack: () => void
  onSaved: () => void
  canViewProducts: boolean
  onNavigateToPage: (page: AdminPage) => void
  onLogout: () => void
}

const initialForm: AdminProviderInput = {
  nombre_proveedor: '',
  correo: '',
  nit: '',
  nombre_empresa: '',
  contacto: '',
  telefono: '',
  telefono_2: '',
  direccion: '',
}

function ProviderForm({
  provider,
  onBack,
  onSaved,
  canViewProducts,
  onNavigateToPage,
  onLogout,
}: ProviderFormProps) {
  const isEditing = provider !== null
  const [form, setForm] = useState<AdminProviderInput>(() =>
    provider
      ? {
          nombre_proveedor: provider.nombre_proveedor ?? '',
          correo: provider.correo ?? '',
          nit: provider.nit ?? '',
          nombre_empresa: provider.nombre_empresa ?? '',
          contacto: provider.contacto ?? '',
          telefono: provider.telefono ?? '',
          telefono_2: provider.telefono_2 ?? '',
          direccion: provider.direccion ?? '',
        }
      : initialForm,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')

    const token = localStorage.getItem('token')
    if (!token) {
      setError('No hay una sesión activa. Iniciá sesión nuevamente.')
      return
    }

    const providerData: AdminProviderInput = {
      ...form,
      nombre_proveedor: form.nombre_proveedor.trim(),
      correo: form.correo.trim().toLowerCase(),
      nit: form.nit.trim(),
      nombre_empresa: form.nombre_empresa.trim(),
      contacto: form.contacto.trim(),
      telefono: form.telefono.trim(),
      telefono_2: form.telefono_2.trim(),
      direccion: form.direccion.trim(),
    }

    setSaving(true)
    try {
      const result = isEditing
        ? await updateAdminProvider(provider.id, providerData, token)
        : await createAdminProvider(providerData, token)
      setMessage(result.message)
      if (!isEditing) setForm(initialForm)
      window.setTimeout(onSaved, 900)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : `No se pudo ${isEditing ? 'actualizar' : 'crear'} la ficha del proveedor.`,
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="users-page"> 
      <AdminSidebar
        activePage={isEditing ? 'edit-provider' : 'create-provider'}
        canViewProducts={canViewProducts}
        onNavigateToUsers={() => onNavigateToPage('users')}
        onNavigateToUserRole={(role) => onNavigateToPage(role === 'all' ? 'users' : role === 'provider' ? 'providers' : 'admins')}
        onNavigateToProducts={() => onNavigateToPage('products')}
        onNavigateToRolePermissions={() => onNavigateToPage('role-permissions')}
        onNavigateToProfile={() => onNavigateToPage('profile')}
        onNavigateToPage={onNavigateToPage}
        onLogout={onLogout}
      />

      <section className="users-main">
        <header className="users-topbar">
          <div className="users-breadcrumb">
            <span>Panel</span>
            <span className="users-breadcrumb-separator">/</span>
            <strong>{isEditing ? 'Editar proveedor' : 'Ficha proveedor'}</strong>
          </div>
        </header>

        <div className="users-content">
          <section className="users-table-card">
            <div className="users-table-header">
              <div>
                <span className="users-section-eyebrow">
                  {isEditing ? 'ACTUALIZAR REGISTRO' : 'NUEVO REGISTRO'}
                </span>
                <h2>{isEditing ? 'Editar ficha del proveedor' : 'Ficha del proveedor'}</h2>
                <p>
                  {isEditing
                    ? 'Actualizá los datos de contacto y facturación del proveedor.'
                    : 'Guardá los datos de contacto y facturación del proveedor.'}
                </p>
              </div>
            </div>

            {error && <p className="users-alert users-alert-error" role="alert">{error}</p>}
            {message && <p className="users-alert users-alert-success" role="status">{message}</p>}

            <form className="provider-create-form" onSubmit={handleSubmit}>
              <section className="provider-create-section">
                <div className="provider-create-heading">
                  <span className="provider-create-step">01</span>
                  <div>
                    <h3>Datos de la empresa</h3>
                    <p>Información que usará administración al asignar productos.</p>
                  </div>
                </div>
                <div className="provider-create-grid">
                    <label className="users-modal-field">
                      <span>Nombre del proveedor</span>
                      <input
                        name="nombre_proveedor"
                        value={form.nombre_proveedor}
                        onChange={handleChange}
                        minLength={2}
                        maxLength={120}
                        required
                        disabled={saving}
                      />
                    </label>
                    <label className="users-modal-field">
                      <span>NIT</span>
                      <input
                        name="nit"
                        value={form.nit}
                        onChange={handleChange}
                        maxLength={30}
                        required
                        disabled={saving}
                      />
                    </label>
                    <label className="users-modal-field">
                      <span>Nombre de la empresa</span>
                      <input
                        name="nombre_empresa"
                        value={form.nombre_empresa}
                        onChange={handleChange}
                        minLength={2}
                        maxLength={120}
                        required
                        disabled={saving}
                      />
                    </label>
                    <label className="users-modal-field">
                      <span>Correo electrónico</span>
                      <input
                        name="correo"
                        type="email"
                        value={form.correo}
                        onChange={handleChange}
                        maxLength={150}
                        autoComplete="email"
                        required
                        disabled={saving}
                      />
                    </label>
                    <label className="users-modal-field">
                      <span>Contacto principal</span>
                      <input
                        name="contacto"
                        value={form.contacto}
                        onChange={handleChange}
                        maxLength={120}
                        required
                        disabled={saving}
                      />
                    </label>
                    <label className="users-modal-field">
                      <span>Teléfono 1</span>
                      <input
                        name="telefono"
                        type="tel"
                        value={form.telefono}
                        onChange={handleChange}
                        maxLength={30}
                        required
                        disabled={saving}
                      />
                    </label>
                    <label className="users-modal-field">
                      <span>Teléfono 2</span>
                      <input
                        name="telefono_2"
                        type="tel"
                        value={form.telefono_2}
                        onChange={handleChange}
                        maxLength={30}
                        disabled={saving}
                      />
                    </label>
                    <label className="users-modal-field provider-create-full">
                      <span>Dirección</span>
                      <textarea
                        name="direccion"
                        value={form.direccion}
                        onChange={handleChange}
                        maxLength={500}
                        required
                        disabled={saving}
                        rows={3}
                      />
                    </label>
                  </div>
                </section>

                <div className="users-modal-actions">
                  <button
                    className="users-refresh"
                    type="button"
                    onClick={onBack}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button
                    className="users-create-button"
                    type="submit"
                    disabled={saving}
                  >
                    {saving
                      ? 'Guardando...'
                      : isEditing
                        ? 'Guardar cambios'
                        : 'Crear ficha proveedor'}
                  </button>
                </div>
            </form>
          </section>
        </div>
      </section>
    </main>
  )
}

export default ProviderForm
