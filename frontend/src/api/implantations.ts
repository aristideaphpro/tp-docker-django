import { apiGet, apiRequest } from './client'
import type { Feature, FeatureCollection, Point } from 'geojson'

export type ImplantationProperties = {
  titre: string
  commentaire: string
  domaine3: string | null
  created_at?: string
  updated_at?: string
}
export type ImplantationFeature = Feature<Point, ImplantationProperties> & { id: number }
export type ImplantationCollection = FeatureCollection<Point, ImplantationProperties> & { features: ImplantationFeature[] }

export function fetchImplantations(signal?: AbortSignal) {
  return apiGet<ImplantationCollection>('/implantations/', { signal })
}

export function createImplantation(feature: Feature<Point, ImplantationProperties>) {
  return apiRequest<ImplantationFeature>('POST', '/implantations/', { body: feature })
}

export function updateImplantation(id: number, body: { geometry?: Point; properties?: Partial<ImplantationProperties> }) {
  return apiRequest<ImplantationFeature>('PATCH', `/implantations/${id}/`, { body })
}

export function deleteImplantation(id: number) {
  return apiRequest<void>('DELETE', `/implantations/${id}/`)
}
