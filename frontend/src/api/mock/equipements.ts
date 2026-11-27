import type { EquipementCollection } from '../types'

// Échantillon réel de la BPE 2025 en Bretagne (3 281 équipements, chaque type de niveau 3 représenté).
// Chargé à la demande pour ne pas alourdir le bundle principal.
let cache: Promise<EquipementCollection> | null = null
export function loadMockEquipements(): Promise<EquipementCollection> {
  if (!cache) cache = import('./equipements.sample.json').then((m) => m.default as unknown as EquipementCollection)
  return cache
}
