
import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { createProduct, getPhotoUrl, updateProduct } from '../services/api'
import type { Product, ProductInput } from '../services/api'
import '../styles/ProductForm.css'

interface ProductFormProps {
  product: Product | null
  onBack: () => void
  onSaved: () => void
}

const initialForm: ProductInput = {
  nombre: '',
  descripcion: '',
  categoria: '',
  marca: '',
  modelo: '',
  precio: 0,
  existencias: 0,
  imagen_url: '',
}

function ProductForm({ product, onBack, onSaved }: ProductFormProps) {
  const [form, setForm] = useState<ProductInput>(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [imageError, setImageError] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const isEditing = product !== null

  useEffect(() => {
    if (product) {
      setForm({
        nombre: product.nombre ?? '',
        descripcion: product.descripcion ?? '',
        categoria: product.categoria ?? '',
        marca: product.marca ?? '',
        modelo: product.modelo ?? '',
        precio: Number(product.precio) || 0,
        existencias: Number(product.existencias) || 0,
        imagen_url: product.imagen_url ?? '',
      })
    } else {
      setForm({ ...initialForm })
    }

    setError('')
    setImageError(false)
    setSelectedImage(null)
    setImagePreview(null)
  }, [product])

  useEffect(() => {
    if (!selectedImage) {
      setImagePreview(null)
      return
    }

    const objectUrl = URL.createObjectURL(selectedImage)
    setImagePreview(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [selectedImage])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]:
        name === 'precio' || name === 'existencias'
          ? value === ''
            ? 0
            : Number(value)
          : value,
    }))

  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setImageError(false)

    if (!file) {
      setSelectedImage(null)
      return
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
      setError('Seleccioná una imagen JPG, PNG o WebP.')
      event.target.value = ''
      setSelectedImage(null)
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('La imagen no puede superar los 5 MB.')
      event.target.value = ''
      setSelectedImage(null)
      return
    }

    setError('')
    setSelectedImage(file)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const token = localStorage.getItem('token')

    if (!token) {
      setError('Tu sesión no está activa. Iniciá sesión nuevamente.')
      return
    }

    if (!form.nombre.trim()) {
      setError('El nombre del producto es obligatorio.')
      return
    }

    if (!Number.isFinite(form.precio) || form.precio <= 0) {
      setError('Ingresá un precio mayor que cero.')
      return
    }

    if (
      !Number.isInteger(form.existencias) ||
      form.existencias < 0
    ) {
      setError(
        'Las existencias deben ser un número entero igual o mayor que cero.',
      )
      return
    }

    setLoading(true)

    try {
      const productData: ProductInput = {
        ...form,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        categoria: form.categoria.trim(),
        marca: form.marca.trim(),
        modelo: form.modelo.trim(),
        imagen_url: form.imagen_url.trim(),
      }

      if (isEditing && product) {
        await updateProduct(product.id, productData, token, selectedImage)
      } else {
        await createProduct(productData, token, selectedImage)
      }

      onSaved()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el producto.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="product-form-page">
      <div className="product-form-container">
        <button
          type="button"
          className="product-form-back"
          onClick={onBack}
          disabled={loading}
        >
          ← Volver al catálogo
        </button>

        <header className="product-form-header">
          <span className="product-form-eyebrow">
            ESPACIO DEL PROVEEDOR
          </span>

          <h1>{isEditing ? 'Editar producto' : 'Nuevo producto'}</h1>

          <p>
            {isEditing
              ? 'Actualizá la información de tu producto.'
              : 'Agregá un producto a tu catálogo y preparalo para tus clientes.'}
          </p>
        </header>

        {error && (
          <div className="product-form-error" role="alert">
            {error}
          </div>
        )}

        <form className="product-form" onSubmit={handleSubmit}>
          <section className="product-form-section">
            <div className="product-form-section-heading">
              <span className="product-form-section-number">01</span>
              <div>
                <h2>Información general</h2>
                <p>Los datos principales del producto.</p>
              </div>
            </div>

            <div className="product-form-grid">
              <div className="product-form-field product-form-field-full">
                <label htmlFor="nombre">Nombre del producto *</label>
                <input
                  id="nombre"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  placeholder="Ej. Audífonos inalámbricos"
                  maxLength={150}
                  required
                />
              </div>

              <div className="product-form-field product-form-field-full">
                <label htmlFor="descripcion">Descripción</label>
                <textarea
                  id="descripcion"
                  name="descripcion"
                  value={form.descripcion}
                  onChange={handleChange}
                  placeholder="Describí las características del producto..."
                  rows={4}
                  maxLength={5000}
                />
              </div>

              <div className="product-form-field">
                <label htmlFor="categoria">Categoría</label>
                <input
                  id="categoria"
                  name="categoria"
                  value={form.categoria}
                  onChange={handleChange}
                  placeholder="Ej. Electrónica"
                  maxLength={100}
                />
              </div>

              <div className="product-form-field">
                <label htmlFor="marca">Marca</label>
                <input
                  id="marca"
                  name="marca"
                  value={form.marca}
                  onChange={handleChange}
                  placeholder="Ej. Samsung"
                  maxLength={100}
                />
              </div>

              <div className="product-form-field product-form-field-full">
                <label htmlFor="modelo">Modelo</label>
                <input
                  id="modelo"
                  name="modelo"
                  value={form.modelo}
                  onChange={handleChange}
                  placeholder="Ej. Galaxy Buds"
                  maxLength={100}
                />
              </div>
            </div>
          </section>

          <section className="product-form-section">
            <div className="product-form-section-heading">
              <span className="product-form-section-number">02</span>
              <div>
                <h2>Precio e inventario</h2>
                <p>Definí el precio y las unidades disponibles.</p>
              </div>
            </div>

            <div className="product-form-grid">
              <div className="product-form-field">
                <label htmlFor="precio">Precio (Q) *</label>
                <div className="product-form-price-input">
                  <span>Q</span>
                  <input
                    id="precio"
                    name="precio"
                    type="number"
                    value={form.precio}
                    onChange={handleChange}
                    placeholder="0.00"
                    min="0.01"
                    max="999999999"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div className="product-form-field">
                <label htmlFor="existencias">Existencias *</label>
                <input
                  id="existencias"
                  name="existencias"
                  type="number"
                  value={form.existencias}
                  onChange={handleChange}
                  placeholder="0"
                  min="0"
                  max="100000000"
                  step="1"
                  required
                />
                <span className="product-form-hint">
                  Unidades disponibles para la venta.
                </span>
              </div>
            </div>
          </section>

          <section className="product-form-section">
            <div className="product-form-section-heading">
              <span className="product-form-section-number">03</span>
              <div>
                <h2>Imagen del producto</h2>
                <p>Seleccioná una imagen desde tu computadora.</p>
              </div>
            </div>

            <div className="product-form-field">
              <label htmlFor="product-image">Imagen</label>
              <input
                id="product-image"
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageChange}
                disabled={loading}
              />
              <span className="product-form-hint">
                Formatos JPG, PNG o WebP. Tamaño máximo: 5 MB.
              </span>
            </div>

            {(imagePreview || (!selectedImage && form.imagen_url.trim())) && (
              <div className="product-form-image-preview">
                <img
                  src={imagePreview ?? getPhotoUrl(form.imagen_url) ?? ''}
                  alt="Vista previa del producto"
                  onError={() => setImageError(true)}
                />
              </div>
            )}

            {imageError && (
              <p className="product-form-hint">
                No se pudo mostrar la imagen seleccionada.
              </p>
            )}
          </section>

          <footer className="product-form-actions">
            <button
              type="button"
              className="product-form-cancel"
              onClick={onBack}
              disabled={loading}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="product-form-submit"
              disabled={loading}
            >
              {loading
                ? 'Guardando...'
                : isEditing
                  ? 'Guardar cambios'
                  : 'Crear producto'}
            </button>
          </footer>
        </form>
      </div>
    </main>
  )
}

export default ProductForm
