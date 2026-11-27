import { apiGet } from './client'
import { ENDPOINTS, USE_MOCK } from './config'
import { toEquipementCollection, toEquipementFeature } from './adapters'
import { loadMockEquipements } from './mock/equipements'
import { matchesEquipementQuery } from '../lib/filters'
import type { EquipementBbox } from '../lib/viewport'
import type { EquipementCollection, EquipementFeature, EquipementQuery } from './types'

const latency = () => new Promise((resolve) => setTimeout(resolve, 120)) // simule le réseau (mock)
const EMPTY: EquipementCollection = { type: 'FeatureCollection', features: [] }

/**
 * Liste des équipements (FeatureCollection GeoJSON), filtrée.
 * Dans l'arbre des domaines : OU entre branches sélectionnées (niveaux 1, 2, 3).
 * Entre domaines et villes : ET.
 * @param bbox [ouest, sud, est, nord] en degrés lon/lat. Obligatoire pour le backend.
 */
export async function fetchEquipements(
  { bbox, query = {}, signal }: { bbox: EquipementBbox; query?: EquipementQuery; signal?: AbortSignal },
): Promise<EquipementCollection> {
  // Aucun domaine sélectionné = aucun résultat, inutile d'appeler l'API.
  if (
    query.domaine1?.length === 0 &&
    (!query.domaine2 || query.domaine2.length === 0) &&
    (!query.domaine3 || query.domaine3.length === 0)
  ) {
    return EMPTY
  }

  if (USE_MOCK) {
    const [all] = await Promise.all([loadMockEquipements(), latency()])
    if (signal?.aborted) throw new DOMException('Requête annulée', 'AbortError')
    const [west, south, east, north] = bbox
    return {
      type: 'FeatureCollection',
      features: all.features.filter((feature) => {
        const [lng, lat] = feature.geometry.coordinates
        return west <= lng && lng <= east && south <= lat && lat <= north && matchesEquipementQuery(feature.properties, query)
      }),
    }
  }

  // Paramètres répétés : ?in_bbox=...&ville=Rennes&ville=Brest
  const raw = await apiGet<unknown>(ENDPOINTS.equipements, {
    query: { ...query, in_bbox: bbox.join(',') },
    signal,
  })
  return toEquipementCollection(raw)
}

/** Charge les propriétés complètes uniquement lorsque l'utilisateur ouvre la fiche. */
export async function fetchEquipement(id: string, { signal }: { signal?: AbortSignal } = {}): Promise<EquipementFeature> {
  if (USE_MOCK) {
    const [all] = await Promise.all([loadMockEquipements(), latency()])
    const found = all.features.find((feature) => feature.properties.id === id)
    if (!found) throw new Error(`Équipement introuvable : ${id}`)
    return found
  }
  const feature = toEquipementFeature(await apiGet<unknown>(ENDPOINTS.equipement(id), { signal }))
  if (!feature) throw new Error('Réponse invalide : un équipement GeoJSON est attendu.')
  return feature
}
