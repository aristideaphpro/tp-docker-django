import type { DomainNode, EquipementProperties, EquipementQuery } from '../api/types'

/**
 * État unifié des filtres :
 * - `leaves` : liste des clés canoniques des feuilles sélectionnées dans l'arbre à 3 niveaux
 *   (ex. « A␟A5␟A501 »). Permet d'exprimer n'importe quelle combinaison de niveaux 1, 2 et 3
 *   avec cases tri-état et compression automatique vers le niveau parent le plus haut.
 * - `villes` : liste des communes sélectionnées (ex. « Rennes », « Brest »).
 *
 * Logique de combinaison :
 * - Entre branches de domaines sélectionnées : OU (ex. tout le commerce B OU les médecins D201).
 * - Entre villes sélectionnées : OU (ex. Rennes OU Brest).
 * - Entre domaines et villes : ET.
 */
export type Filters = {
  leaves: string[]
  villes: string[]
}

export type CheckState = 'checked' | 'indeterminate' | 'unchecked'

export type DomainChip = {
  key: string
  code: string
  libelle: string
  level: 1 | 2 | 3
}

export type TreeEvaluation = {
  states: Map<string, CheckState>
  selectedLeafCounts: Map<string, number>
  totalLeafCounts: Map<string, number>
  chips: DomainChip[]
  totalLeaves: number
  selectedLeavesCount: number
  isAllSelected: boolean
  isNoneSelected: boolean
}

const SEP = '\u241F'
export const EMPTY_FILTERS: Filters = { leaves: [], villes: [] }

export const pathKey = (...codes: string[]) => codes.join(SEP)

/** Collecte toutes les clés feuilles sous un ensemble de nœuds. */
export function collectLeafKeys(nodes: DomainNode[], prefix: string[] = []): string[] {
  const keys: string[] = []
  for (const node of nodes) {
    const nextPath = [...prefix, node.code]
    if (!node.enfants || node.enfants.length === 0) {
      keys.push(pathKey(...nextPath))
    } else {
      keys.push(...collectLeafKeys(node.enfants, nextPath))
    }
  }
  return keys
}

export function defaultFilters(tree: DomainNode[], villes: string[] = []): Filters {
  return { leaves: collectLeafKeys(tree), villes }
}

function findNodeAtPath(tree: DomainNode[], pathCodes: string[]): DomainNode | null {
  let level = tree
  let current: DomainNode | null = null
  for (const code of pathCodes) {
    current = level.find((item) => item.code === code) ?? null
    if (!current) return null
    level = current.enfants
  }
  return current
}

function branchLeafKeys(tree: DomainNode[], pathCodes: string[]): string[] {
  const node = findNodeAtPath(tree, pathCodes)
  if (!node) return []
  if (!node.enfants || node.enfants.length === 0) return [pathKey(...pathCodes)]
  return collectLeafKeys(node.enfants, pathCodes)
}

/** Coche toute la branche si elle est décochée ou partielle ; la décoche si elle est entièrement cochée. */
export function toggleBranch(filters: Filters, tree: DomainNode[], pathCodes: string[]): Filters {
  const targetLeaves = branchLeafKeys(tree, pathCodes)
  if (targetLeaves.length === 0) return filters

  const currentSet = new Set(filters.leaves)
  const allChecked = targetLeaves.every((leaf) => currentSet.has(leaf))

  if (allChecked) {
    for (const leaf of targetLeaves) currentSet.delete(leaf)
  } else {
    for (const leaf of targetLeaves) currentSet.add(leaf)
  }
  return { ...filters, leaves: [...currentSet] }
}

/** Isole uniquement la branche ciblée (désélectionne tout le reste). */
export function selectOnlyBranch(filters: Filters, tree: DomainNode[], pathCodes: string[]): Filters {
  return { ...filters, leaves: branchLeafKeys(tree, pathCodes) }
}

export const clearDomains = (filters: Filters): Filters => ({ ...filters, leaves: [] })
export const resetDomains = (filters: Filters, tree: DomainNode[]): Filters => ({
  ...filters,
  leaves: collectLeafKeys(tree),
})

export function toggleVille(filters: Filters, ville: string): Filters {
  const exists = filters.villes.includes(ville)
  return {
    ...filters,
    villes: exists ? filters.villes.filter((v) => v !== ville) : [...filters.villes, ville],
  }
}

export const clearVilles = (filters: Filters): Filters => ({ ...filters, villes: [] })

/**
 * Évalue l'état tri-état de chaque nœud de l'arbre et extrait la couverture minimale
 * (au niveau hiérarchique le plus haut possible) pour les puces et la requête API.
 */
export function evaluateDomainTree(tree: DomainNode[], leaves: string[]): TreeEvaluation {
  const selectedSet = new Set(leaves)
  const states = new Map<string, CheckState>()
  const selectedLeafCounts = new Map<string, number>()
  const totalLeafCounts = new Map<string, number>()

  function walk(
    nodes: DomainNode[],
    prefix: string[],
    level: 1 | 2 | 3,
  ): {
    allChecked: boolean
    anyChecked: boolean
    selectedCount: number
    totalCount: number
    chips: DomainChip[]
  } {
    let checkedBranches = 0
    let indeterminateBranches = 0
    let selectedCount = 0
    let totalCount = 0
    const chips: DomainChip[] = []

    for (const node of nodes) {
      const nextPath = [...prefix, node.code]
      const key = pathKey(...nextPath)

      if (!node.enfants || node.enfants.length === 0) {
        const isChecked = selectedSet.has(key)
        states.set(key, isChecked ? 'checked' : 'unchecked')
        selectedLeafCounts.set(key, isChecked ? 1 : 0)
        totalLeafCounts.set(key, 1)
        totalCount += 1
        if (isChecked) {
          checkedBranches += 1
          selectedCount += 1
          chips.push({ key, code: node.code, libelle: node.libelle, level })
        }
      } else {
        const nextLevel = (Math.min(level + 1, 3) as 1 | 2 | 3)
        const child = walk(node.enfants, nextPath, nextLevel)
        selectedLeafCounts.set(key, child.selectedCount)
        totalLeafCounts.set(key, child.totalCount)
        selectedCount += child.selectedCount
        totalCount += child.totalCount

        if (child.allChecked) {
          states.set(key, 'checked')
          checkedBranches += 1
          // Tout le sous-arbre est coché : on remonte au code parent unique.
          chips.push({ key, code: node.code, libelle: node.libelle, level })
        } else if (child.anyChecked) {
          states.set(key, 'indeterminate')
          indeterminateBranches += 1
          chips.push(...child.chips)
        } else {
          states.set(key, 'unchecked')
        }
      }
    }

    return {
      allChecked: nodes.length > 0 && checkedBranches === nodes.length,
      anyChecked: checkedBranches > 0 || indeterminateBranches > 0,
      selectedCount,
      totalCount,
      chips,
    }
  }

  const root = walk(tree, [], 1)
  return {
    states,
    selectedLeafCounts,
    totalLeafCounts,
    chips: root.chips,
    totalLeaves: root.totalCount,
    selectedLeavesCount: root.selectedCount,
    isAllSelected: tree.length > 0 && root.allChecked,
    isNoneSelected: root.selectedCount === 0,
  }
}

/** Sérialise les filtres vers le contrat d'API (`domaine1`, `domaine2`, `domaine3`, `ville`). */
export function toQuery(filters: Filters, tree: DomainNode[]): EquipementQuery {
  const ville = filters.villes.length > 0 ? filters.villes : undefined

  if (tree.length === 0) {
    return { ville }
  }

  const evaluation = evaluateDomainTree(tree, filters.leaves)

  // Aucun domaine coché : on signale une liste vide pour court-circuiter la requête.
  if (evaluation.isNoneSelected) {
    return { domaine1: [], ville }
  }

  // Tous les domaines sont cochés : pas de filtre domaine nécessaire.
  if (evaluation.isAllSelected) {
    return { ville }
  }

  // L'API fait un OU entre valeurs répétées d'un même paramètre et un ET
  // entre paramètres différents. Représenter toutes les branches sélectionnées
  // à un seul niveau évite une intersection involontaire entre niveaux.
  const selected = new Set(filters.leaves)
  for (const level of [1, 2, 3] as const) {
    const codes: string[] = []
    const covered = new Set<string>()
    let hasShallowSelectedLeaf = false

    function visit(nodes: DomainNode[], prefix: string[], depth: 1 | 2 | 3) {
      for (const node of nodes) {
        const path = [...prefix, node.code]
        const leaves = collectLeafKeys([node], prefix)
        if (depth === level) {
          if (leaves.length > 0 && leaves.every((leaf) => selected.has(leaf))) {
            codes.push(node.code)
            leaves.forEach((leaf) => covered.add(leaf))
          }
        } else if (node.enfants.length > 0) {
          visit(node.enfants, path, (depth + 1) as 1 | 2 | 3)
        } else if (selected.has(pathKey(...path))) {
          hasShallowSelectedLeaf = true
        }
      }
    }

    visit(tree, [], 1)
    if (
      !hasShallowSelectedLeaf &&
      covered.size === selected.size &&
      [...selected].every((leaf) => covered.has(leaf))
    ) {
      const values = [...new Set(codes)]
      if (level === 1) return { domaine1: values, ville }
      if (level === 2) return { domaine2: values, ville }
      return { domaine3: values, ville }
  }
  }

  // Échec fermé si l'arbre est irrégulier et ne peut pas être représenté
  // exactement à un seul niveau de filtre.
  return { domaine1: [], ville }
}

/**
 * Évalue si un équipement correspond à la requête :
 * - OU entre valeurs d'un même paramètre répété.
 * - ET entre paramètres différents, conformément au backend.
 */
export function matchesEquipementQuery(
  props: Pick<EquipementProperties, 'domaine1_code' | 'domaine2_code' | 'domaine3_code' | 'ville'>,
  query: EquipementQuery,
): boolean {
  const domainFilters: Array<[string[] | undefined, string | undefined]> = [
    [query.domaine1, props.domaine1_code],
    [query.domaine2, props.domaine2_code],
    [query.domaine3, props.domaine3_code],
  ]
  for (const [values, code] of domainFilters) {
    if (values === undefined) continue
    if (values.length === 0 || !code || !values.includes(code)) return false
  }

  if (query.ville && query.ville.length > 0) {
    if (!props.ville || !query.ville.includes(props.ville)) return false
  }

  return true
}
