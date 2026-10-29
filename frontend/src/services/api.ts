
const API_URL = 'http://localhost:3000/api'
const SERVER_URL = 'http://localhost:3000'

export type UserRole = 'admin' | 'user' | 'provider'

export interface ManagedUser {
  id: number
  username: string
  role: UserRole
  saldo?: string | number
}

export interface LoginResponse {
  token: string
  user: {
    id: number
    username: string
    role: UserRole
    saldo?: string | number
  }
}

export interface RegisterResponse {
  message?: string
  user?: {
    id: number
    username: string
    role: UserRole
    saldo?: string | number
  }
  error?: string
}

export interface ProfileUser {
  id: number
  username: string
  correo: string
  role: UserRole
  photoUrl: string | null
}

export interface ProfileInput {
  username: string
  correo: string
}

export interface ProviderProfile {
  id: number
  usuario_id: number
  nombre_empresa: string
  descripcion: string | null
  telefono: string | null
  correo: string | null
  direccion: string | null
  creado_en: string
}

export interface ProviderProfileInput {
  nombre_empresa: string
  descripcion: string
  telefono: string
  correo: string
  direccion: string
}

export interface Product {
  id: number
  proveedor_id: number
  nombre: string
  descripcion: string | null
  categoria: string | null
  marca: string | null
  modelo: string | null
  precio: string | number
  existencias: number
  imagen_url: string | null
  activo: boolean
  creado_en: string
  actualizado_en: string
}

export interface ProductInput {
  nombre: string
  descripcion: string
  categoria: string
  marca: string
  modelo: string
  precio: number
  existencias: number
  imagen_url: string
}

export interface CartItem {
  producto_id: number
  cantidad: number
  nombre: string
  precio: string | number
  existencias: number
  imagen_url: string | null
  subtotal: string | number
}

export interface OrderItem {
  producto_id: number | null
  nombre_producto: string
  precio_unitario: string | number
  cantidad: number
  subtotal: string | number
}

export interface Order {
  id: number
  usuario_id: number
  estado: 'confirmado' | 'enviado' | 'entregado' | 'cancelado'
  total: string | number
  creado_en: string
  items: OrderItem[]
}

export interface CheckoutResponse {
  message: string
  order: Order
  saldo_restante: string | number
}

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data.error || data.message || 'Ocurrió un error en la solicitud.',
    )
  }

  return data as T
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  }
}

export function getPhotoUrl(photoPath: string | null): string | null {
  if (!photoPath) return null

  if (
    photoPath.startsWith('http://') ||
    photoPath.startsWith('https://')
  ) {
    return photoPath
  }

  return `${SERVER_URL}${photoPath.startsWith('/') ? '' : '/'}${photoPath}`
}

// AUTENTICACIÓN

export async function loginUser(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim(), password }),
  })

  return readResponse<LoginResponse>(response)
}

export async function registerUser(
  username: string,
  password: string,
): Promise<RegisterResponse> {
  const response = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username.trim(), password }),
  })

  return readResponse<RegisterResponse>(response)
}

// ADMINISTRACIÓN DE USUARIOS

export async function createAdminUser(
  username: string,
  password: string,
  token: string,
): Promise<RegisterResponse> {
  const response = await fetch(`${API_URL}/admin/users`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username: username.trim(), password }),
  })

  return readResponse<RegisterResponse>(response)
}

export async function getUsers(token: string): Promise<ManagedUser[]> {
  const response = await fetch(`${API_URL}/users`, {
    headers: authHeaders(token),
  })

  const data = await readResponse<ManagedUser[] | { users: ManagedUser[] }>(
    response,
  )

  return Array.isArray(data) ? data : data.users
}

export async function changeUserRole(
  id: number,
  role: UserRole,
  token: string,
): Promise<{ message: string; user: ManagedUser }> {
  const response = await fetch(`${API_URL}/users/${id}/role`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ role }),
  })

  return readResponse<{ message: string; user: ManagedUser }>(response)
}

export async function deleteUser(
  id: number,
  token: string,
): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/users/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })

  return readResponse<{ message: string }>(response)
}

// PERFIL DE USUARIO

export async function getProfile(token: string): Promise<ProfileUser> {
  const response = await fetch(`${API_URL}/profile`, {
    headers: authHeaders(token),
  })

  const data = await readResponse<{ user: ProfileUser }>(response)
  return data.user
}

export async function updateProfile(
  profile: ProfileInput,
  token: string,
): Promise<{ message: string } & ProfileUser> {
  const response = await fetch(`${API_URL}/profile`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: profile.username.trim(),
      correo: profile.correo.trim(),
    }),
  })

  const data = await readResponse<
    { message: string; user?: ProfileUser } & Partial<ProfileUser>
  >(response)

  // Acepta una respuesta que devuelva el usuario dentro de "user"
  // o directamente en el objeto de respuesta.
  const updatedUser = data.user ?? data

  if (
    typeof updatedUser.id !== 'number' ||
    typeof updatedUser.username !== 'string' ||
    typeof updatedUser.correo !== 'string' ||
    !updatedUser.role
  ) {
    throw new Error(
      'El servidor no devolvió los datos actualizados del perfil.',
    )
  }

  return {
    message: data.message,
    id: updatedUser.id,
    username: updatedUser.username,
    correo: updatedUser.correo,
    role: updatedUser.role,
    photoUrl: updatedUser.photoUrl ?? null,
  }
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
  token: string,
): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/profile/password`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  })

  return readResponse<{ message: string }>(response)
}

export async function uploadProfilePhoto(
  photo: File,
  token: string,
): Promise<{ message: string; photoUrl: string }> {
  const formData = new FormData()
  formData.append('photo', photo)

  const response = await fetch(`${API_URL}/profile/photo`, {
    method: 'POST',
    headers: authHeaders(token),
    body: formData,
  })

  return readResponse<{ message: string; photoUrl: string }>(response)
}

// PERFIL DE PROVEEDOR

export async function getProviderProfile(
  token: string,
): Promise<ProviderProfile> {
  const response = await fetch(`${API_URL}/provider/profile`, {
    headers: authHeaders(token),
  })

  return readResponse<ProviderProfile>(response)
}

export async function saveProviderProfile(
  profile: ProviderProfileInput,
  token: string,
): Promise<{ message: string; profile: ProviderProfile }> {
  const response = await fetch(`${API_URL}/provider/profile`, {
    method: 'PUT',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(profile),
  })

  return readResponse<{ message: string; profile: ProviderProfile }>(response)
}

// PRODUCTOS

export async function getProducts(): Promise<Product[]> {
  const response = await fetch(`${API_URL}/products`)
  return readResponse<Product[]>(response)
}

export async function getMyProducts(token: string): Promise<Product[]> {
  const response = await fetch(`${API_URL}/provider/products`, {
    headers: authHeaders(token),
  })

  return readResponse<Product[]>(response)
}

export async function getProductById(id: number): Promise<Product> {
  const response = await fetch(`${API_URL}/products/${id}`)
  return readResponse<Product>(response)
}

function buildProductFormData(product: ProductInput, image?: File | null): FormData {
  const formData = new FormData()

  formData.append('nombre', product.nombre)
  formData.append('descripcion', product.descripcion)
  formData.append('categoria', product.categoria)
  formData.append('marca', product.marca)
  formData.append('modelo', product.modelo)
  formData.append('precio', String(product.precio))
  formData.append('existencias', String(product.existencias))
  formData.append('imagen_url', product.imagen_url)

  if (image) {
    formData.append('image', image)
  }

  return formData
}

export async function createProduct(
  product: ProductInput,
  token: string,
  image?: File | null,
): Promise<{ message: string; product?: Product }> {
  const response = await fetch(`${API_URL}/provider/products`, {
    method: 'POST',
    headers: authHeaders(token),
    body: buildProductFormData(product, image),
  })

  return readResponse<{ message: string; product?: Product }>(response)
}

export async function updateProduct(
  id: number,
  product: ProductInput,
  token: string,
  image?: File | null,
): Promise<{ message: string; product?: Product }> {
  const response = await fetch(`${API_URL}/provider/products/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: buildProductFormData(product, image),
  })

  return readResponse<{ message: string; product?: Product }>(response)
}

export async function deactivateProduct(
  id: number,
  token: string,
): Promise<{ message: string }> {
  const response = await fetch(
    `${API_URL}/provider/products/${id}/deactivate`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
    },
  )

  return readResponse<{ message: string }>(response)
}

// CARRITO

export async function getCart(token: string): Promise<CartItem[]> {
  const response = await fetch(`${API_URL}/cart`, {
    headers: authHeaders(token),
  })

  return readResponse<CartItem[]>(response)
}

export async function addCartItem(
  producto_id: number,
  cantidad: number,
  token: string,
): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/cart/items`, {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ producto_id, cantidad }),
  })

  return readResponse<{ message: string }>(response)
}

export async function removeCartItem(
  producto_id: number,
  token: string,
): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/cart/items/${producto_id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })

  return readResponse<{ message: string }>(response)
}

// PEDIDOS

export async function checkout(
  token: string,
): Promise<CheckoutResponse> {
  const response = await fetch(`${API_URL}/orders/checkout`, {
    method: 'POST',
    headers: authHeaders(token),
  })

  return readResponse<CheckoutResponse>(response)
}

export async function getMyOrders(token: string): Promise<Order[]> {
  const response = await fetch(`${API_URL}/orders`, {
    headers: authHeaders(token),
  })

  return readResponse<Order[]>(response)
}
