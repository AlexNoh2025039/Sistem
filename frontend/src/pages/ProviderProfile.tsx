
  import { useEffect, useState } from 'react'
  import type { FormEvent, ChangeEvent } from 'react'
  import { getProviderProfile, saveProviderProfile,} from '../services/api'
  import type { ProviderProfileInput } from '../services/api'
  import '../styles/ProviderProfile.css'

  function ProviderProfile() {
    const [form, setForm] = useState<ProviderProfileInput>({
      nombre_empresa: '',
      descripcion: '',
      telefono: '',
      correo: '',
      direccion: '',
    })

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    useEffect(() => {
      let active = true

      const loadProfile = async () => {
        const token = localStorage.getItem('token')

        if (!token) {
          if (active) {
            setError('Debés iniciar sesión para continuar.')
            setLoading(false)
          }
          return
        }

        try {
          const profile = await getProviderProfile(token)

          if (!active) return

          setForm({
            nombre_empresa: profile.nombre_empresa ?? '',
            descripcion: profile.descripcion ?? '',
            telefono: profile.telefono ?? '',
            correo: profile.correo ?? '',
            direccion: profile.direccion ?? '',
          })
        } catch (err) {
          if (!active) return

          const errorMessage =
            err instanceof Error
              ? err.message
              : 'No se pudo cargar el perfil comercial.'

          if (errorMessage.includes('Todavía no has creado tu perfil')) {
            setMessage(
              'Todavía no tenés un perfil comercial. Completá el formulario para crearlo.',
            )
          } else {
            setError(errorMessage)
          }
        } finally {
          if (active) {
            setLoading(false)
          }
        }
      }

      void loadProfile()

      return () => {
        active = false
      }
    }, [])

    const handleChange = (
      event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      const { name, value } = event.target

      setForm((current) => ({
        ...current,
        [name]: value,
      }))
    }

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setError('')
      setMessage('')

      const token = localStorage.getItem('token')

      if (!token) {
        setError('Tu sesión no está activa. Iniciá sesión nuevamente.')
        return
      }

      setSaving(true)

      try {
        const result = await saveProviderProfile(form, token)

        setForm({
          nombre_empresa: result.profile.nombre_empresa ?? '',
          descripcion: result.profile.descripcion ?? '',
          telefono: result.profile.telefono ?? '',
          correo: result.profile.correo ?? '',
          direccion: result.profile.direccion ?? '',
        })

        setMessage(result.message)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo guardar el perfil comercial.',
        )
      } finally {
        setSaving(false)
      }
    }

    if (loading) {
      return (
        <main className="provider-profile-page">
          <section className="provider-profile-card">
            <p>Cargando perfil comercial...</p>
          </section>
        </main>
      )
    }

    return (
      <main className="provider-profile-page">
        <section className="provider-profile-card">
          <header className="provider-profile-header">
            <span className="provider-profile-eyebrow">
              ESPACIO DEL PROVEEDOR
            </span>

            <h1>Perfil comercial</h1>

            <p>
              Registrá los datos de tu negocio para que tus clientes
              puedan conocerlo y contactarte.
            </p>
          </header>

          {message && (
            <p className="provider-profile-message" role="status">
              {message}
            </p>
          )}

          {error && (
            <p className="provider-profile-error" role="alert">
              {error}
            </p>
          )}

          <form
            onSubmit={handleSubmit}
            className="provider-profile-form"
          >
            <div className="provider-profile-field">
              <label htmlFor="nombre_empresa">
                Nombre de la empresa *
              </label>

              <input
                id="nombre_empresa"
                name="nombre_empresa"
                type="text"
                value={form.nombre_empresa}
                onChange={handleChange}
                placeholder="Ej. Mi tienda"
                minLength={2}
                maxLength={120}
                required
              />
            </div>

            <div className="provider-profile-field">
              <label htmlFor="descripcion">
                Descripción del negocio
              </label>

              <textarea
                id="descripcion"
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                placeholder="Contá qué productos o servicios ofrecés..."
                maxLength={5000}
                rows={5}
              />
            </div>

            <div className="provider-profile-field">
              <label htmlFor="telefono">Teléfono</label>

              <input
                id="telefono"
                name="telefono"
                type="tel"
                value={form.telefono}
                onChange={handleChange}
                placeholder="Ej. 5555-1234"
                maxLength={30}
              />
            </div>

            <div className="provider-profile-field">
              <label htmlFor="correo">Correo comercial</label>

              <input
                id="correo"
                name="correo"
                type="email"
                value={form.correo}
                onChange={handleChange}
                placeholder="negocio@ejemplo.com"
                maxLength={150}
              />
            </div>

            <div className="provider-profile-field">
              <label htmlFor="direccion">Dirección</label>

              <textarea
                id="direccion"
                name="direccion"
                value={form.direccion}
                onChange={handleChange}
                placeholder="Dirección de tu negocio"
                maxLength={500}
                rows={3}
              />
            </div>

            <button
              type="submit"
              className="provider-profile-submit"
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar perfil comercial'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  export default ProviderProfile
