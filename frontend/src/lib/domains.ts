import type { DomainNode, EquipementFeature } from '../api/types'

// Style des 7 domaines de niveau 1 de la BPE (couleur du marqueur et lettre affichée).
export const DOMAIN_STYLES: Record<string, { color: string; short: string }> = {
  A: { color: '#36a880', short: 'P' }, // Services pour les particuliers
  B: { color: '#ff6b35', short: 'C' }, // Commerces
  C: { color: '#7c6ce7', short: 'E' }, // Enseignement
  D: { color: '#e45b8c', short: 'S' }, // Santé et action sociale
  E: { color: '#3f8fd2', short: 'T' }, // Transports et déplacements
  F: { color: '#d99a1d', short: 'L' }, // Sports, loisirs et culture
  G: { color: '#1f9aa8', short: 'V' }, // Tourisme
}
export const domainStyle = (code: string) => DOMAIN_STYLES[code] ?? { color: '#5b6b69', short: '•' }

export type DomainMetadata = Pick<EquipementFeature['properties'],
  'domaine1_code' | 'domaine1_libelle' | 'domaine2_code' | 'domaine2_libelle' | 'domaine3_code' | 'domaine3_libelle'
>

export function indexDomainTree(tree: DomainNode[]): Map<string, DomainMetadata> {
  const byDomain3 = new Map<string, DomainMetadata>()
  for (const domaine1 of tree) {
    for (const domaine2 of domaine1.enfants) {
      for (const domaine3 of domaine2.enfants) {
        byDomain3.set(domaine3.code, {
          domaine1_code: domaine1.code,
          domaine1_libelle: domaine1.libelle,
          domaine2_code: domaine2.code,
          domaine2_libelle: domaine2.libelle,
          domaine3_code: domaine3.code,
          domaine3_libelle: domaine3.libelle,
        })
      }
    }
  }
  return byDomain3
}

export function enrichEquipement(feature: EquipementFeature, domains: Map<string, DomainMetadata>): EquipementFeature {
  const metadata = domains.get(feature.properties.domaine3_code ?? '')
  if (!metadata) return feature
  const current = feature.properties
  if (
    current.domaine1_code === metadata.domaine1_code &&
    current.domaine1_libelle === metadata.domaine1_libelle &&
    current.domaine2_code === metadata.domaine2_code &&
    current.domaine2_libelle === metadata.domaine2_libelle &&
    current.domaine3_libelle === metadata.domaine3_libelle
  ) return feature
  return { ...feature, properties: { ...feature.properties, ...metadata } }
}
