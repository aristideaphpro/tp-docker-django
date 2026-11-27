import { API_BASE } from './config'
import { buildQuery, type Query } from './query'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Jeton JWT : sera renseigné à la connexion (étape 5), puis envoyé sur chaque requête.
let authToken: string | null = null
export function setAuthToken(token: string | null) {
  authToken = token
}

type Options = { query?: Query; body?: unknown; signal?: AbortSignal }

export async function apiRequest<T>(method: string, path: string, { query, body, signal }: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (authToken) headers.Authorization = `Bearer ${authToken}`

  const response = await fetch(`${API_BASE}${path}${buildQuery(query)}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    let detail = ''
    try {
      const data = await response.json()
      detail = data?.detail ?? data?.message ?? ''
    } catch {
      /* corps non JSON : on garde le message générique */
    }
    throw new ApiError(response.status, detail || `Erreur ${response.status} sur ${path}`)
  }
  if (response.status === 204) return undefined as T
  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError(response.status, `Réponse non JSON sur ${path} (le proxy /api atteint-il le bon service ?)`)
  }
}

export const apiGet = <T>(path: string, options?: Options) => apiRequest<T>('GET', path, options)
