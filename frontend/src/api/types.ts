import type { Feature, FeatureCollection, Point } from 'geojson'

/**
 * Contrat GeoJSON des équipements (colonnes de la BPE, `_id` devenant `id`).
 * Coordonnées [longitude, latitude].
 */
export type EquipementProperties = {
  id: string // UUID
  nom: string
  adresse?: string
  codepostal?: string
  ville?: string
  dept?: string
  siret?: string
  domaine1_code?: string
  domaine1_libelle?: string
  domaine2_code?: string
  domaine2_libelle?: string
  domaine3_code?: string
  domaine3_libelle?: string
}
export type EquipementFeature = Feature<Point, EquipementProperties>
export type EquipementCollection = FeatureCollection<Point, EquipementProperties>

/** Arbre des domaines sur 3 niveaux : niveau 1 > niveau 2 > niveau 3. Ex. A > A5 > A501. */
export type DomainNode = {
  code: string
  libelle: string
  enfants: DomainNode[]
  count?: number
}

/** Ville enrichie pour le filtre géographique (rétrocompatible avec une liste de chaînes). */
export type VilleOption = {
  nom: string
  dept?: string
  codepostal?: string
  count?: number
}

/** Filtres envoyés à l'API. Chaque liste devient un paramètre répété : ?domaine1=A&domaine2=D1&domaine3=A501 */
export type EquipementQuery = {
  domaine1?: string[] // codes de niveau 1
  domaine2?: string[] // codes de niveau 2
  domaine3?: string[] // codes de niveau 3
  ville?: string[] // noms de villes
}
