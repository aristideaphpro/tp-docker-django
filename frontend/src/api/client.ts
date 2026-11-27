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

// Jetons JWT persistés : l'accès (courte durée) est renouvelé via le refresh au besoin.
const ACCESS_KEY = 'geoprospector_access'
const REFRESH_KEY = 'geoprospector_refresh'
let authToken: string | null = localStorage.getItem(ACCESS_KEY)
let refreshToken: string | null = localStorage.getItem(REFRESH_KEY)
const listeners = new Set<(token: string | null) => void>()

export function getAuthToken() {
  return authToken
}

export function onAuthChange(listener: (token: string | null) => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function setAuthTokens(access: string | null, refresh: string | null = refreshToken) {
  authToken = access
  refreshToken = access ? refresh : null
  if (authToken) localStorage.setItem(ACCESS_KEY, authToken); else localStorage.removeItem(ACCESS_KEY)
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken); else localStorage.removeItem(REFRESH_KEY)
  listeners.forEach((listener) => listener(authToken))
}

/** Compatibilité : remplace uniquement le jeton d'accès. */
export function setAuthToken(token: string | null) {
  if (token !== authToken) setAuthTokens(token)
}

let refreshing: Promise<boolean> | null = null
function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return Promise.resolve(false)
  refreshing ??= fetch(`${API_BASE}/auth/token/refresh/`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken }),
  })
    .then(async (response) => {
      if (!response.ok) return false
      const data = await response.json()
      if (typeof data?.access !== 'string') return false
      setAuthTokens(data.access, typeof data.refresh === 'string' ? data.refresh : refreshToken)
      return true
    })
    .catch(() => false)
    .finally(() => { refreshing = null })
  return refreshing
}

type Options = { query?: Query; body?: unknown; signal?: AbortSignal }

export async function apiRequest<T>(method: string, path: string, options: Options = {}, retried = false): Promise<T> {
  const { query, body, signal } = options
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const sentToken = authToken
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`

  const response = await fetch(`${API_BASE}${path}${buildQuery(query)}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  // Jeton expiré : on tente un renouvellement, sinon on se déconnecte proprement, puis on rejoue une fois.
  if (response.status === 401 && sentToken && !retried && !path.startsWith('/auth/token')) {
    if (authToken === sentToken && !(await refreshAccessToken())) setAuthTokens(null)
    return apiRequest<T>(method, path, options, true)
  }

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
