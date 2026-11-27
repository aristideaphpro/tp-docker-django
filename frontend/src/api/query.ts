export type Query = Record<string, string | number | boolean | null | undefined | Array<string | number>>

/** Paramètres répétés : { ville: ['Rennes','Brest'] } -> ?ville=Rennes&ville=Brest */
export function buildQuery(query?: Query): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined) continue
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item))
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}
