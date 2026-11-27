/**
 * Point unique de configuration de la connexion à l'API.
 * Passer du fictif au réel : VITE_USE_MOCK=false dans .env, puis relancer `npm run dev`.
 */
// Les données fictives ne sont utilisées que sur demande explicite de développement.
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// Le navigateur appelle toujours /api ; Vite (dev) redirige vers le backend (proxy).
export const API_BASE = '/api'

/**
 * Routes attendues du backend (chemins relatifs à /api).
 * Django/DRF exige souvent le "/" final : si le backend n'en veut pas, retirer ici, à un seul endroit.
 */
export const ENDPOINTS = {
  equipements: '/equipements/',
  domaines: '/domaines/',
  villes: '/villes/',
  equipement: (id: string) => `/equipements/${encodeURIComponent(id)}/`,
} as const
