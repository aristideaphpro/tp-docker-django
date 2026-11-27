export type EquipementBbox = [west: number, south: number, east: number, north: number]

/** Découpe une emprise en rectangles non chevauchants qui ne sont pas déjà chargés. */
export function subtractBbox(source: EquipementBbox, covered: EquipementBbox): EquipementBbox[] {
  const [west, south, east, north] = source
  const [coveredWest, coveredSouth, coveredEast, coveredNorth] = covered
  const intersectionWest = Math.max(west, coveredWest)
  const intersectionSouth = Math.max(south, coveredSouth)
  const intersectionEast = Math.min(east, coveredEast)
  const intersectionNorth = Math.min(north, coveredNorth)

  if (intersectionWest >= intersectionEast || intersectionSouth >= intersectionNorth) return [source]

  const remainder: EquipementBbox[] = []
  if (west < intersectionWest) remainder.push([west, south, intersectionWest, north])
  if (intersectionEast < east) remainder.push([intersectionEast, south, east, north])
  if (south < intersectionSouth) remainder.push([intersectionWest, south, intersectionEast, intersectionSouth])
  if (intersectionNorth < north) remainder.push([intersectionWest, intersectionNorth, intersectionEast, north])
  return remainder
}

export function missingBboxes(viewport: EquipementBbox, covered: EquipementBbox[]): EquipementBbox[] {
  return covered.reduce<EquipementBbox[]>(
    (fragments, loaded) => fragments.flatMap((fragment) => subtractBbox(fragment, loaded)),
    [viewport],
  )
}

/** Conserve des coordonnées valides pour le contrat PostGIS in_bbox. */
export function clampBbox(bbox: EquipementBbox): EquipementBbox | null {
  const west = Math.max(-180, bbox[0])
  const south = Math.max(-90, bbox[1])
  const east = Math.min(180, bbox[2])
  const north = Math.min(90, bbox[3])
  if (![west, south, east, north].every(Number.isFinite) || west >= east || south >= north) return null
  return [west, south, east, north]
}
