/**
 * Géocodage d'adresses françaises via le service de la Géoplateforme (IGN), sans clé, CORS ouvert.
 * Remplace l'ancienne API Adresse (api-adresse.data.gouv.fr), décommissionnée depuis janvier 2026.
 * Doc : https://geoservices.ign.fr/documentation/services/services-geoplateforme/geocodage
 */
const GEOCODAGE_URL = 'https://data.geopf.fr/geocodage/search'

/** Départements de la région Bretagne (périmètre des données BPE importées). */
export const BRETAGNE_DEPTS = new Set(['22', '29', '35', '56'])

export type GeocodeResult = {
  lng: number
  lat: number
  label: string
  /** Code département (ex. « 35 »), vide si le service ne le fournit pas. */
  depcode: string
  inBretagne: boolean
}

export async function geocodeAdresse(
  adresse: string,
  near?: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<GeocodeResult> {
  const params = new URLSearchParams({ q: adresse, limit: '1', index: 'address' })
  if (near) {
    params.set('lat', String(near.lat))
    params.set('lon', String(near.lng))
  }

  let response: Response
  try {
    response = await fetch(`${GEOCODAGE_URL}?${params}`, { signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('Service d’adresses injoignable. Vérifiez votre connexion.')
  }
  if (!response.ok) throw new Error('Service d’adresses indisponible.')

  const data = await response.json()
  const feature = data?.features?.[0]
  if (!feature) throw new Error('Adresse introuvable. Précisez la ville ou le code postal.')

  const [lng, lat] = feature.geometry.coordinates as [number, number]
  const props = feature.properties ?? {}
  const depcode = String(props.depcode ?? String(props.citycode ?? '').slice(0, 2))
  return {
    lng,
    lat,
    label: String(props.label ?? adresse),
    depcode,
    inBretagne: BRETAGNE_DEPTS.has(depcode),
  }
}
