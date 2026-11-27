import type { DomainNode, EquipementCollection, EquipementFeature, VilleOption } from './types'

/**
 * Adaptateur : SEUL endroit qui connaît la forme exacte de la réponse du backend.
 * Si les noms de champs diffèrent (ex. `name` au lieu de `nom`), on ne modifie que ce fichier.
 * Les entrées invalides sont ignorées pour ne jamais casser la carte.
 */
type Raw = Record<string, unknown>
const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null
const text = (value: unknown) => (typeof value === 'string' ? value : '')

export function toEquipementFeature(raw: unknown): EquipementFeature | null {
  if (!isObject(raw) || !isObject(raw.geometry)) return null
  const { type, coordinates } = raw.geometry
  if (type !== 'Point' || !Array.isArray(coordinates) || coordinates.length < 2) return null

  // GeoJSON : [longitude, latitude]
  const lng = Number(coordinates[0])
  const lat = Number(coordinates[1])
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null

  const props = isObject(raw.properties) ? raw.properties : {}
  // Le contrat API expose l’UUID au niveau de Feature.id.
  const id = text(raw.id) || text(props.id)
  if (!id) return null

  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: {
      id,
      nom: text(props.nom),
      adresse: text(props.adresse) || undefined,
      codepostal: text(props.codepostal) || undefined,
      ville: text(props.ville) || undefined,
      dept: text(props.dept) || undefined,
      siret: text(props.siret) || undefined,
      domaine1_code: text(props.domaine1_code),
      domaine1_libelle: text(props.domaine1_libelle),
      domaine2_code: text(props.domaine2_code),
      domaine2_libelle: text(props.domaine2_libelle),
      domaine3_code: text(props.domaine3) || text(props.domaine3_code),
      domaine3_libelle: text(props.domaine3_libelle),
    },
  }
}

export function toEquipementCollection(raw: unknown): EquipementCollection {
  if (!isObject(raw) || raw.type !== 'FeatureCollection' || !Array.isArray(raw.features)) {
    throw new Error('Réponse invalide : une FeatureCollection GeoJSON est attendue.')
  }
  const byId = new Map<string, EquipementFeature>()
  let ignored = 0
  for (const item of raw.features) {
    const feature = toEquipementFeature(item)
    if (feature) byId.set(feature.properties.id, feature)
    else ignored += 1
  }
  if (ignored > 0) console.warn(`[api] ${ignored} équipement(s) ignoré(s) : géométrie ou identifiant invalide.`)
  return { type: 'FeatureCollection', features: [...byId.values()] }
}

/** Attendu : [{ code, libelle, enfants: [{ code, libelle, enfants: [{ code, libelle }] }] }], 3 niveaux maximum. */
export function toDomainTree(raw: unknown, depth = 1): DomainNode[] {
  if (!Array.isArray(raw)) {
    if (depth === 1) throw new Error('Réponse invalide : une liste de domaines est attendue.')
    return []
  }
  const nodes: DomainNode[] = []
  for (const item of raw) {
    if (!isObject(item) || !text(item.code)) continue
    nodes.push({
      code: text(item.code),
      libelle: text(item.libelle) || text(item.code),
      enfants: depth < 3 ? toDomainTree(item.enfants, depth + 1) : [],
      count: typeof item.count === 'number' ? item.count : undefined,
    })
  }
  return nodes
}

/** Attendu : ["Rennes", "Brest"] ou [{ nom: "Rennes", dept: "35", codepostal: "35000", count: 8009 }]. */
export function toVilles(raw: unknown): VilleOption[] {
  if (!Array.isArray(raw)) throw new Error('Réponse invalide : une liste de villes est attendue.')
  const byName = new Map<string, VilleOption>()

  for (const item of raw) {
    if (typeof item === 'string') {
      const nom = item.trim()
      if (nom && !byName.has(nom)) byName.set(nom, { nom })
      continue
    }
    if (!isObject(item)) continue
    const nom = (text(item.nom) || text(item.ville)).trim()
    if (!nom) continue
    const codepostal = text(item.codepostal).trim() || undefined
    const rawDept = text(item.dept).trim() || (codepostal && codepostal.length >= 2 ? codepostal.slice(0, 2) : undefined)
    const count = typeof item.count === 'number' ? item.count : undefined
    const existing = byName.get(nom)
    if (!existing) {
      byName.set(nom, { nom, dept: rawDept, codepostal, count })
    } else {
      if (count !== undefined) existing.count = (existing.count ?? 0) + count
      if (!existing.dept && rawDept) existing.dept = rawDept
      if (!existing.codepostal && codepostal) existing.codepostal = codepostal
    }
  }

  return [...byName.values()].sort((a, b) => {
    if (a.count !== undefined && b.count !== undefined && b.count !== a.count) {
      return b.count - a.count
    }
    return a.nom.localeCompare(b.nom, 'fr')
  })
}
