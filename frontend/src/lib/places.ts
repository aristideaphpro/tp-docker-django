import type { EquipementFeature } from '../api/types'

// Vue initiale. L.map / MapContainer / setView attendent [latitude, longitude].
export const INITIAL_CENTER: [number, number] = [48.2, -2.9]
export const INITIAL_ZOOM = 8

export type Place = {
  id: string
  name: string
  domaineCode: string // code de niveau 1 (couleur, icône)
  category: string // libellé de niveau 3 (type d'équipement)
  address: string
  dept?: string
  siret?: string
  distance: string
  lat: number
  lng: number
  feature: EquipementFeature
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const rad = (d: number) => (d * Math.PI) / 180
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}

// Distance affichée = depuis le centre initial de la carte (provisoire).
export function featureToPlace(feature: EquipementFeature): Place {
  const [lng, lat] = feature.geometry.coordinates // GeoJSON : [longitude, latitude]
  const p = feature.properties
  const km = distanceKm(INITIAL_CENTER[0], INITIAL_CENTER[1], lat, lng)
  const cityLine = [p.codepostal, p.ville].filter(Boolean).join(' ')
  return {
    id: p.id,
    name: p.nom || p.domaine3_libelle || p.domaine3_code || 'Équipement',
    domaineCode: p.domaine1_code ?? '',
    category: p.domaine3_libelle || p.domaine3_code || 'Équipement',
    address: [p.adresse, cityLine].filter(Boolean).join(', '),
    dept: p.dept,
    siret: p.siret,
    distance: km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(0)} km`,
    lat,
    lng,
    feature,
  }
}
