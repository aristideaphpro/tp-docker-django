import { useEffect, useMemo, useRef, useState } from 'react'
import type { DomainNode, VilleOption } from '../api/types'
import {
  pathKey,
  type CheckState,
  type Filters,
  type TreeEvaluation,
} from '../lib/filters'

const MAX_CITIES_SHOWN = 80

const BRETAGNE_DEPTS = [
  { code: '35', label: '35' },
  { code: '29', label: '29' },
  { code: '56', label: '56' },
  { code: '22', label: '22' },
] as const

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[-']/g, ' ')
    .toLowerCase()
    .trim()

function TriStateCheckbox({
  state,
  onChange,
  ariaLabel,
}: {
  state: CheckState
  onChange: () => void
  ariaLabel: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = state === 'indeterminate'
    }
  }, [state])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={state === 'checked'}
      onChange={onChange}
      aria-label={ariaLabel}
    />
  )
}

function filterTreeByQuery(
  nodes: DomainNode[],
  rawQuery: string,
  prefix: string[] = [],
): { filtered: DomainNode[]; autoExpanded: Set<string> } {
  const term = normalize(rawQuery)
  const autoExpanded = new Set<string>()
  if (!term) return { filtered: nodes, autoExpanded }

  function walk(list: DomainNode[], path: string[]): DomainNode[] {
    const out: DomainNode[] = []
    for (const node of list) {
      const nextPath = [...path, node.code]
      const key = pathKey(...nextPath)
      const selfMatch =
        normalize(node.libelle).includes(term) ||
        node.code.toLowerCase().startsWith(term)

      if (!node.enfants || node.enfants.length === 0) {
        if (selfMatch) out.push(node)
        continue
      }

      const matchingChildren = walk(node.enfants, nextPath)
      if (matchingChildren.length > 0) {
        autoExpanded.add(key)
        out.push({ ...node, enfants: matchingChildren })
      } else if (selfMatch) {
        out.push(node)
      }
    }
    return out
  }

  return { filtered: walk(nodes, prefix), autoExpanded }
}

/**
 * Filtres avancés :
 * 1. Synthèse des filtres actifs (puces supprimables + recentrage carte).
 * 2. Zone géographique : sélection multi-villes avec raccourci départemental (22, 29, 35, 56).
 * 3. Arbre des domaines sur 3 niveaux (7 domaines -> 27 sous-domaines -> 233 types) avec recherche et cases tri-état.
 */
export default function SubFilters({
  tree,
  villes,
  filters,
  evaluation,
  onToggleBranch,
  onSelectOnlyBranch,
  onSelectAllDomains,
  onClearDomains,
  onToggleVille,
  onClearVilles,
  onZoomToVilles,
}: {
  tree: DomainNode[]
  villes: VilleOption[]
  filters: Filters
  evaluation: TreeEvaluation
  onToggleBranch: (pathCodes: string[]) => void
  onSelectOnlyBranch: (pathCodes: string[]) => void
  onSelectAllDomains: () => void
  onClearDomains: () => void
  onToggleVille: (ville: string) => void
  onClearVilles: () => void
  onZoomToVilles?: () => void
}) {
  const [citySearch, setCitySearch] = useState('')
  const [deptFilter, setDeptFilter] = useState<string | null>(null)
  const [domainSearch, setDomainSearch] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set())

  const { filtered: filteredTree, autoExpanded } = useMemo(
    () => filterTreeByQuery(tree, domainSearch),
    [tree, domainSearch],
  )

  const matchingCities = useMemo(() => {
    const term = normalize(citySearch)
    return villes.filter((item) => {
      if (deptFilter && item.dept !== deptFilter) return false
      if (!term) return true
      const matchName = normalize(item.nom).includes(term)
      const matchCp = item.codepostal ? item.codepostal.startsWith(term) : false
      return matchName || matchCp
    }).sort((a, b) => Number(filters.villes.includes(b.nom)) - Number(filters.villes.includes(a.nom)))
  }, [villes, filters.villes, deptFilter, citySearch])

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const hasAnySummary = filters.villes.length > 0

  const renderTreeNodes = (nodes: DomainNode[], prefix: string[] = [], depth = 1) =>
    nodes.map((node) => {
      const pathCodes = [...prefix, node.code]
      const key = pathKey(...pathCodes)
      const hasChildren = Boolean(node.enfants && node.enfants.length > 0)
      const isExpanded = domainSearch.trim()
        ? autoExpanded.has(key)
        : expandedKeys.has(key)
      const state = evaluation.states.get(key) ?? 'unchecked'

      return (
        <div key={key} className={`tree-node depth-${depth}`}>
          <div className="tree-row">
            {hasChildren ? (
              <button
                type="button"
                className="tree-expand"
                onClick={() => toggleExpand(key)}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? `Replier ${node.libelle}` : `Déplier ${node.libelle}`}
              >
                {isExpanded ? '▾' : '▸'}
              </button>
            ) : (
              <span className="tree-leaf-spacer" />
            )}

            <label className="tree-check">
              <TriStateCheckbox
                state={state}
                onChange={() => onToggleBranch(pathCodes)}
                ariaLabel={node.libelle}
              />
              <span className="tree-label-text" title={node.libelle}>
                {node.libelle}
              </span>
            </label>

            <button
              type="button"
              className="tree-only-btn"
              onClick={() => onSelectOnlyBranch(pathCodes)}
              title={`Afficher uniquement : ${node.libelle}`}
            >
              Seul
            </button>

            {typeof node.count === 'number' && (
              <span className="tree-count">{node.count.toLocaleString('fr-FR')}</span>
            )}
          </div>

          {hasChildren && isExpanded && (
            <div className="tree-children">
              {renderTreeNodes(node.enfants, pathCodes, depth + 1)}
            </div>
          )}
        </div>
      )
    })

  return (
    <div className="subfilters">
      {hasAnySummary && (
        <div className="active-summary">
          <div className="active-summary-head">
            <span>Filtres actifs</span>
            {filters.villes.length > 0 && onZoomToVilles && (
              <button type="button" className="link-button" onClick={onZoomToVilles}>
                Centrer sur la sélection
              </button>
            )}
          </div>
          <div className="chip-row">
            {filters.villes.map((ville) => (
              <button
                key={`v-${ville}`}
                type="button"
                className="sub-chip selected city-pill"
                onClick={() => onToggleVille(ville)}
                aria-label={`Retirer ${ville}`}
              >
                {ville} ×
              </button>
            ))}

          </div>
        </div>
      )}

      {/* 1. Zone géographique : une ou plusieurs villes */}
      <details className="filter-group" open>
        <summary>
          Zone géographique (villes)
          {filters.villes.length > 0 && <b>{filters.villes.length}</b>}
        </summary>

        <div className="dept-filter-row" role="group" aria-label="Filtrer par département breton">
          <button
            type="button"
            className={`dept-pill ${deptFilter === null ? 'active' : ''}`}
            onClick={() => setDeptFilter(null)}
          >
            Tous
          </button>
          {BRETAGNE_DEPTS.map((d) => (
            <button
              key={d.code}
              type="button"
              className={`dept-pill ${deptFilter === d.code ? 'active' : ''}`}
              onClick={() => setDeptFilter((prev) => (prev === d.code ? null : d.code))}
            >
              {d.label}
            </button>
          ))}
          {filters.villes.length > 0 && (
            <button type="button" className="link-button ml-auto" onClick={onClearVilles}>
              Tout retirer
            </button>
          )}
        </div>

        <input
          className="city-search"
          type="search"
          value={citySearch}
          onChange={(event) => setCitySearch(event.target.value)}
          placeholder="Rechercher une ville ou un CP (ex. Rennes, 29200)…"
          aria-label="Rechercher une ville ou un code postal"
        />

        <ul className="city-list">
          {matchingCities.slice(0, MAX_CITIES_SHOWN).map((item) => (
            <li key={item.nom}>
              <label>
                <input
                  type="checkbox"
                  checked={filters.villes.includes(item.nom)}
                  onChange={() => onToggleVille(item.nom)}
                />
                <span className="city-name">
                  {item.nom}
                  {item.dept && <small className="city-dept"> ({item.dept})</small>}
                </span>
                {typeof item.count === 'number' && (
                  <span className="tree-count">{item.count.toLocaleString('fr-FR')}</span>
                )}
              </label>
            </li>
          ))}
        </ul>

        {matchingCities.length > MAX_CITIES_SHOWN && (
          <p className="hint">
            +{matchingCities.length - MAX_CITIES_SHOWN} autres villes : affinez votre recherche.
          </p>
        )}
        {matchingCities.length === 0 && (
          <p className="hint">Aucune autre ville ne correspond.</p>
        )}
      </details>

      {/* 2. Arbre des domaines BPE sur 3 niveaux */}
      <details className="filter-group" open>
        <summary>
          Type de domaines
          {!evaluation.isAllSelected && (
            <b>
              {evaluation.selectedLeavesCount}/{evaluation.totalLeaves}
            </b>
          )}
        </summary>

        <div className="tree-toolbar">
          <button type="button" className="link-button" onClick={onSelectAllDomains}>
            Tout cocher
          </button>
          <span>·</span>
          <button type="button" className="link-button" onClick={onClearDomains}>
            Tout décocher
          </button>
        </div>

        <input
          className="city-search"
          type="search"
          value={domainSearch}
          onChange={(event) => setDomainSearch(event.target.value)}
          placeholder="Filtrer un domaine ou type (ex. boulangerie, école)…"
          aria-label="Filtrer l'arbre des domaines"
        />

        <div className="domain-tree">
          {filteredTree.length > 0 ? (
            renderTreeNodes(filteredTree)
          ) : (
            <p className="hint">Aucun domaine ou type ne correspond.</p>
          )}
        </div>
      </details>
    </div>
  )
}
