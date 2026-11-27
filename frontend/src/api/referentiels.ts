import { apiGet } from './client'
import { ENDPOINTS, USE_MOCK } from './config'
import { toDomainTree, toVilles } from './adapters'
import { loadMockEquipements } from './mock/equipements'
import type { DomainNode, VilleOption } from './types'

const BRETAGNE_DEPTS = new Set(['22', '29', '35', '56'])

function upsertNode(list: DomainNode[], code: string, libelle: string): DomainNode {
  let node = list.find((item) => item.code === code)
  if (!node) {
    node = { code, libelle, enfants: [], count: 0 }
    list.push(node)
  }
  node.count = (node.count ?? 0) + 1
  return node
}

function sortChildrenByCount(nodes: DomainNode[]): DomainNode[] {
  return [...nodes]
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.code.localeCompare(b.code))
    .map((n) => ({ ...n, enfants: sortChildrenByCount(n.enfants) }))
}

export async function fetchDomaines({ signal }: { signal?: AbortSignal } = {}): Promise<DomainNode[]> {
  if (USE_MOCK) {
    const roots: DomainNode[] = []
    for (const { properties: p } of (await loadMockEquipements()).features) {
      const { domaine1_code, domaine2_code, domaine3_code } = p
      if (!domaine1_code || !domaine2_code || !domaine3_code) continue
      const d1 = upsertNode(roots, domaine1_code, p.domaine1_libelle || domaine1_code)
      const d2 = upsertNode(d1.enfants, domaine2_code, p.domaine2_libelle || domaine2_code)
      upsertNode(d2.enfants, domaine3_code, p.domaine3_libelle || domaine3_code)
    }
    // Niveau 1 trié par code (A -> G) pour conserver l'ordre visuel des cartes, niveaux 2 et 3 par volume décroissant.
    return roots
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((n) => ({ ...n, enfants: sortChildrenByCount(n.enfants) }))
  }
  return toDomainTree(await apiGet<unknown>(ENDPOINTS.domaines, { signal }))
}

export async function fetchVilles({ signal }: { signal?: AbortSignal } = {}): Promise<VilleOption[]> {
  if (USE_MOCK) {
    const byCity = new Map<string, VilleOption>()
    for (const { properties: p } of (await loadMockEquipements()).features) {
      const nom = p.ville?.trim()
      if (!nom) continue
      const cp = p.codepostal?.trim() ?? ''
      const deptCandidate = cp.slice(0, 2)
      const dept = BRETAGNE_DEPTS.has(deptCandidate) ? deptCandidate : undefined
      const existing = byCity.get(nom)
      if (!existing) {
        byCity.set(nom, { nom, dept, codepostal: cp || undefined, count: 1 })
      } else {
        existing.count = (existing.count ?? 0) + 1
        if (!existing.dept && dept) existing.dept = dept
        if (!existing.codepostal && cp) existing.codepostal = cp
      }
    }
    return [...byCity.values()].sort(
      (a, b) => (b.count ?? 0) - (a.count ?? 0) || a.nom.localeCompare(b.nom, 'fr'),
    )
  }
  return toVilles(await apiGet<unknown>(ENDPOINTS.villes, { signal }))
}
