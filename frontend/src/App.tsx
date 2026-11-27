import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode, useCallback } from 'react'
import L, { type Map as LeafletMap } from 'leaflet'
import { fetchEquipement, fetchEquipements } from './api/equipements'
import { fetchDomaines, fetchVilles } from './api/referentiels'
import { createImplantation, deleteImplantation, fetchImplantations, updateImplantation, type ImplantationFeature } from './api/implantations'
import { apiRequest, setAuthToken } from './api/client'
import type { DomainNode, EquipementFeature, EquipementQuery, VilleOption } from './api/types'
import MapView from './components/MapView'
import SubFilters from './components/SubFilters'
import { domainStyle, enrichEquipement, indexDomainTree } from './lib/domains'
import {
  EMPTY_FILTERS,
  clearDomains,
  clearVilles,
  defaultFilters,
  evaluateDomainTree,
  resetDomains,
  selectOnlyBranch,
  toQuery,
  toggleBranch,
  toggleVille,
  type Filters,
} from './lib/filters'
import { INITIAL_CENTER, INITIAL_ZOOM, featureToPlace, type Place } from './lib/places'
import { missingBboxes, type EquipementBbox } from './lib/viewport'
import {
  BookIcon, BriefcaseIcon, BusIcon, ChevronIcon, CompassIcon, FilterIcon, FlagIcon, HeartIcon, ListIcon,
  MapPinSmallIcon, MinusIcon, PlusIcon, SearchIcon, SortIcon, StoreIcon, TargetIcon, TrophyIcon, WalkIcon,
} from './components/icons'

const DOMAIN_ICONS: Record<string, ReactNode> = {
  A: <BriefcaseIcon />, B: <StoreIcon />, C: <BookIcon />, D: <HeartIcon />,
  E: <BusIcon />, F: <TrophyIcon />, G: <CompassIcon />,
}
const domainIcon = (code: string) => DOMAIN_ICONS[code] ?? <MapPinSmallIcon />
const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'
type PendingViewportFetch = { bbox: EquipementBbox; controller: AbortController; generation: number }

function IconButton({ children, label, onClick, active = false }: { children: ReactNode; label: string; onClick?: () => void; active?: boolean }) {
  return (
    <button className={`icon-button ${active ? 'active' : ''}`} aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  )
}

export default function App() {
  const [tree, setTree] = useState<DomainNode[]>([])
  const [villes, setVilles] = useState<VilleOption[]>([])
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [equipmentFeatures, setEquipmentFeatures] = useState<EquipementFeature[]>([])
  const [viewportBbox, setViewportBbox] = useState<EquipementBbox | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<EquipementFeature | null>(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'equipements' | 'prospects'>('equipements')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [toast, setToast] = useState('')
  const [implantations, setImplantations] = useState<ImplantationFeature[]>([])
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('geoprospector_access') ?? '')
  const [selectedImplantation, setSelectedImplantation] = useState<ImplantationFeature | null>(null)
  const [editingImplantation, setEditingImplantation] = useState<ImplantationFeature | null>(null)
  const [selectedVisibleOnMap, setSelectedVisibleOnMap] = useState(true)
  const [sheetOffset, setSheetOffset] = useState(0)
  const [isSheetDragging, setIsSheetDragging] = useState(false)
  const mapRef = useRef<LeafletMap | null>(null)
  const loadedBboxes = useRef<EquipementBbox[]>([])
  const pendingBboxes = useRef(new Map<number, PendingViewportFetch>())
  const featureCache = useRef(new Map<string, EquipementFeature>())
  const cacheGeneration = useRef(0)
  const requestSequence = useRef(0)
  const activeFilterKey = useRef('')
  const sheetOffsetRef = useRef(0)
  const sheetDragOrigin = useRef({ pointerY: 0, offset: 0 })

  const evaluation = useMemo(() => evaluateDomainTree(tree, filters.leaves), [tree, filters.leaves])
  const domainIndex = useMemo(() => indexDomainTree(tree), [tree])
  const places = useMemo(
    () => equipmentFeatures.map((feature) => featureToPlace(enrichEquipement(feature, domainIndex))),
    [equipmentFeatures, domainIndex],
  )

  const activeFilterCount =
    filters.villes.length + (evaluation.isAllSelected ? 0 : evaluation.chips.length || 1)

  const visiblePlaces = useMemo(
    () => places.filter((place) => {
      if (!viewportBbox) return false
      const [west, south, east, north] = viewportBbox
      const inViewport = west <= place.lng && place.lng <= east && south <= place.lat && place.lat <= north
      return inViewport && `${place.name} ${place.address}`.toLowerCase().includes(search.trim().toLowerCase())
    }),
    [places, search, viewportBbox],
  )
  const selectedPlace = useMemo(() => {
    if (selectedDetail && selectedDetail.properties.id === selectedId) {
      return featureToPlace(enrichEquipement(selectedDetail, domainIndex))
    }
    return visiblePlaces.find((place) => place.id === selectedId) ?? null
  }, [selectedDetail, selectedId, domainIndex, visiblePlaces])

  function notify(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }

  useEffect(() => {
    setAuthToken(accessToken || null)
    if (!accessToken) { setImplantations([]); return }
    fetchImplantations().then((data) => setImplantations(data.features)).catch((error: unknown) => { notify(error instanceof Error ? error.message : 'Impossible de charger les implantations.') })
  }, [accessToken])

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    try {
      const tokens = await apiRequest<{ access: string; refresh: string }>('POST', '/auth/token/', { body: { username: fields.get('username'), password: fields.get('password') } })
      localStorage.setItem('geoprospector_access', tokens.access)
      setAccessToken(tokens.access)
    } catch (error) { notify(error instanceof Error ? error.message : 'Connexion impossible.') }
  }

  async function saveProspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const position = selectedPlace ? [selectedPlace.lng, selectedPlace.lat] : [mapRef.current?.getCenter().lng ?? -2.9, mapRef.current?.getCenter().lat ?? 48.2]
    const properties = { titre: String(fields.get('titre') ?? ''), commentaire: String(fields.get('commentaire') ?? ''), domaine3: String(fields.get('domaine3') ?? '') || null }
    try {
      if (editingImplantation) {
        const updated = await updateImplantation(editingImplantation.id, { properties })
        setImplantations((items) => items.map((item) => item.id === updated.id ? updated : item))
      } else {
        const created = await createImplantation({ type: 'Feature', geometry: { type: 'Point', coordinates: position as [number, number] }, properties })
        setImplantations((items) => [...items, created])
      }
      setShowModal(false); setEditingImplantation(null); notify('Implantation enregistrée.')
    } catch (error) { notify(error instanceof Error ? error.message : 'Enregistrement impossible.') }
  }

  async function removeImplantation(point: ImplantationFeature) {
    try { await deleteImplantation(point.id); setImplantations((items) => items.filter((item) => item.id !== point.id)); setSelectedImplantation(null); notify('Implantation supprimée.') }
    catch (error) { notify(error instanceof Error ? error.message : 'Suppression impossible.') }
  }

  // Référentiels : arbre des domaines (3 niveaux) et liste des villes.
  useEffect(() => {
    const controller = new AbortController()
    Promise.all([fetchDomaines({ signal: controller.signal }), fetchVilles({ signal: controller.signal })])
      .then(([domaines, villesList]) => {
        setTree(domaines)
        setVilles(villesList)
        setFilters((current) => ({ ...defaultFilters(domaines), villes: current.villes }))
      })
      .catch((error: unknown) => {
        if (!isAbort(error)) notify('Impossible de charger les filtres.')
      })
    return () => controller.abort()
  }, [])

  // La liste est paginée spatialement par emprises manquantes (l'API renvoie une FeatureCollection).
  const query = useMemo(() => toQuery(filters, tree), [filters, tree])
  const queryKey = JSON.stringify(query)
  const filterKey = JSON.stringify({ filters, query })
  activeFilterKey.current = filterKey

  useEffect(() => {
    cacheGeneration.current += 1
    for (const request of pendingBboxes.current.values()) request.controller.abort()
    pendingBboxes.current.clear()
    loadedBboxes.current = []
    featureCache.current.clear()
    setEquipmentFeatures([])
    setSelectedId(null)
    setSelectedDetail(null)
  }, [filterKey])

  useEffect(() => {
    if (!viewportBbox) return
    const generation = cacheGeneration.current
    const inFlight = [...pendingBboxes.current.values()]
      .filter((request) => request.generation === generation)
      .map((request) => request.bbox)
    const missing = missingBboxes(viewportBbox, [...loadedBboxes.current, ...inFlight])
    const requestQuery = JSON.parse(queryKey) as EquipementQuery

    for (const bbox of missing) {
      const requestId = ++requestSequence.current
      const controller = new AbortController()
      pendingBboxes.current.set(requestId, { bbox, controller, generation })
      fetchEquipements({ bbox, query: requestQuery, signal: controller.signal })
        .then((collection) => {
          if (generation !== cacheGeneration.current || activeFilterKey.current !== filterKey) return
          loadedBboxes.current.push(bbox)
          for (const feature of collection.features) {
            const id = String(feature.id ?? feature.properties.id)
            if (id && !featureCache.current.has(id)) featureCache.current.set(id, feature)
          }
          setEquipmentFeatures([...featureCache.current.values()])
        })
        .catch((error: unknown) => {
          if (!isAbort(error) && generation === cacheGeneration.current && activeFilterKey.current === filterKey) {
            notify(error instanceof Error ? error.message : 'Impossible de charger les équipements.')
          }
        })
        .finally(() => pendingBboxes.current.delete(requestId))
    }
  }, [viewportBbox, queryKey, filterKey])

  useEffect(
    () => () => {
      for (const request of pendingBboxes.current.values()) request.controller.abort()
      pendingBboxes.current.clear()
    },
    [],
  )

  // Une seule fiche complète est demandée à la fois, uniquement après sélection d'un équipement.
  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null)
      return
    }
    const controller = new AbortController()
    setSelectedDetail(null)
    fetchEquipement(selectedId, { signal: controller.signal })
      .then((feature) => {
        if (!controller.signal.aborted) setSelectedDetail(enrichEquipement(feature, domainIndex))
      })
      .catch((error: unknown) => {
        if (!isAbort(error) && !controller.signal.aborted) {
          notify(error instanceof Error ? error.message : 'Impossible de charger la fiche équipement.')
        }
      })
    return () => controller.abort()
  }, [selectedId, domainIndex])

  useEffect(() => {
    if (!selectedPlace) setSelectedVisibleOnMap(false)
  }, [selectedPlace])

  const handleSelect = useCallback(
    (id: string, zoomToPoint = false) => {
      const place = places.find((item) => item.id === id)
      if (!place) return
      const map = mapRef.current
      map?.setView([place.lat, place.lng], zoomToPoint ? Math.max(map.getZoom(), 15) : map.getZoom(), { animate: false })
      setSelectedId(id)
      setSelectedDetail(null)
      setSelectedVisibleOnMap(true)
      setSidebarOpen(true)
    },
    [places],
  )

  const handleZoomToSelectedVilles = useCallback(() => {
    if (!mapRef.current || places.length === 0) return
    const bounds = L.latLngBounds(places.map((p) => [p.lat, p.lng] as [number, number]))
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 })
    }
  }, [places])

  const visibleCollection = useMemo(
    () => ({ type: 'FeatureCollection' as const, features: visiblePlaces.map((place) => place.feature) }),
    [visiblePlaces],
  )

  const handleViewportChange = useCallback((bbox: EquipementBbox) => setViewportBbox(bbox), [])


  function startSheetDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    sheetDragOrigin.current = { pointerY: event.clientY, offset: sheetOffsetRef.current }
    setIsSheetDragging(true)
  }

  function moveSheet(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!isSheetDragging) return
    const maxOffset = Math.max(180, window.innerHeight * 0.42)
    const nextOffset = Math.min(maxOffset, Math.max(0, sheetDragOrigin.current.offset + event.clientY - sheetDragOrigin.current.pointerY))
    sheetOffsetRef.current = nextOffset
    setSheetOffset(nextOffset)
    if (nextOffset < sheetDragOrigin.current.offset) setSelectedVisibleOnMap(false)
  }

  function stopSheetDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!isSheetDragging) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const maxOffset = Math.max(180, window.innerHeight * 0.42)
    const nextOffset = sheetOffsetRef.current > maxOffset * 0.32 ? maxOffset : 0
    sheetOffsetRef.current = nextOffset
    setSheetOffset(nextOffset)
    if (nextOffset === 0) setSelectedVisibleOnMap(false)
    setIsSheetDragging(false)
  }

  function toggleSheetPosition() {
    if (sheetOffsetRef.current > 0) {
      sheetOffsetRef.current = 0
      setSheetOffset(0)
      setSelectedVisibleOnMap(false)
      return
    }
    const nextOffset = Math.max(180, window.innerHeight * 0.42)
    sheetOffsetRef.current = nextOffset
    setSheetOffset(nextOffset)
  }

  return (
    <div className="app-shell">
      <main>
        <aside
          className={`sidebar ${sidebarOpen ? '' : 'closed'} ${isSheetDragging ? 'sheet-dragging' : ''} ${showFilters ? 'show-filters' : 'hide-filters'}`}
          style={{ '--sheet-offset': `${sheetOffset}px` } as React.CSSProperties}
        >
          <button
            className="sheet-handle"
            aria-label="Faire glisser le panneau des résultats"
            title="Faites glisser pour ajuster le panneau"
            onPointerDown={startSheetDrag}
            onPointerMove={moveSheet}
            onPointerUp={stopSheetDrag}
            onPointerCancel={stopSheetDrag}
            onDoubleClick={toggleSheetPosition}
          >
            <span />
          </button>
          <div className="sidebar-heading">
            <div>
              <p className="eyebrow">Bretagne</p>
              <h1>Explorer le territoire</h1>
            </div>
            <div className="heading-actions">
              <button
                type="button"
                className={`filter-toggle-btn ${showFilters ? 'active' : ''}`}
                onClick={() => setShowFilters((v) => !v)}
                aria-expanded={showFilters}
              >
                <FilterIcon />
                <span>Filtres</span>
                {activeFilterCount > 0 && <b>{activeFilterCount}</b>}
              </button>
              <button className="close-sidebar" onClick={() => setSidebarOpen(false)} aria-label="Fermer le panneau">×</button>
            </div>
          </div>

          <div className="tabs" role="tablist">
            <button className={tab === 'equipements' ? 'active' : ''} onClick={() => setTab('equipements')}>
              Équipements <span>{visiblePlaces.length}</span>
            </button>
            <button className={tab === 'prospects' ? 'active' : ''} onClick={() => setTab('prospects')}>
              Implantations <span>{implantations.length}</span>
            </button>
          </div>

          {tab === 'equipements' ? (
            <div className="sidebar-scroll">
              {showFilters && (
                <section className="filter-block" aria-label="Filtres des équipements">
                  <div className="section-title quick-domains-title">
                    <h2>Domaines</h2>
                    <button type="button" onClick={() => setFilters((current) => resetDomains(current, tree))}>Tout afficher</button>
                  </div>
                  <div className="category-grid">
                    {tree.map((node) => {
                      const checkState = evaluation.states.get(node.code) ?? 'unchecked'
                      const active = checkState !== 'unchecked'
                      const style = domainStyle(node.code)
                      return (
                        <button
                          key={node.code}
                          className={`category-chip ${active ? 'selected' : ''} ${checkState === 'indeterminate' ? 'partial' : ''}`}
                          aria-pressed={active}
                          onClick={() => setFilters((current) => toggleBranch(current, tree, [node.code]))}
                          style={{ '--category': style.color } as React.CSSProperties}
                        >
                          <span>{domainIcon(node.code)}</span>{node.libelle}
                          <i>{checkState === 'checked' ? '✓' : checkState === 'indeterminate' ? '–' : '+'}</i>
                        </button>
                      )
                    })}
                  </div>

                  <SubFilters
                    tree={tree}
                    villes={villes}
                    filters={filters}
                    evaluation={evaluation}
                    onToggleBranch={(pathCodes) => setFilters((current) => toggleBranch(current, tree, pathCodes))}
                    onSelectOnlyBranch={(pathCodes) => setFilters((current) => selectOnlyBranch(current, tree, pathCodes))}
                    onSelectAllDomains={() => setFilters((current) => resetDomains(current, tree))}
                    onClearDomains={() => setFilters((current) => clearDomains(current))}
                    onToggleVille={(ville) => setFilters((current) => toggleVille(current, ville))}
                    onClearVilles={() => setFilters((current) => clearVilles(current))}
                    onZoomToVilles={handleZoomToSelectedVilles}
                  />
                </section>
              )}
            </div>
          ) : (
            <div className="prospect-panel">
              {!accessToken ? <><h2>Connexion</h2><p>Connectez-vous pour gérer vos implantations privées.</p><form onSubmit={login}><label>Nom d’utilisateur<input name="username" required autoComplete="username" /></label><label>Mot de passe<input name="password" type="password" required autoComplete="current-password" /></label><button className="primary-button" type="submit">Se connecter</button></form></> : <>
                <h2>Mes implantations</h2>
                <button className="primary-button" onClick={() => { setEditingImplantation(null); setShowModal(true) }}><PlusIcon /> Ajouter une implantation</button>
                {implantations.map((point) => <div className="place-card" key={point.id}><strong>{point.properties.titre}</strong><button onClick={() => { setEditingImplantation(point); setShowModal(true) }}>Modifier</button><button onClick={() => removeImplantation(point)}>Supprimer</button></div>)}
                <button className="link-button" onClick={() => { localStorage.removeItem('geoprospector_access'); setAccessToken('') }}>Se déconnecter</button>
              </>}
            </div>
          )}
        </aside>

        <section className="map" aria-label="Carte des équipements de Bretagne">
          <MapView
            data={visibleCollection}
            selectedId={selectedId}
            selectedPlace={selectedPlace}
            onSelect={handleSelect}
            onViewportChange={handleViewportChange}
            onSelectedVisibilityChange={setSelectedVisibleOnMap}
            mapRef={mapRef}
            implantations={implantations}
            onSelectImplantation={setSelectedImplantation}
          />

          <div className="map-search">
            <SearchIcon />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher une ville, une adresse…"
              aria-label="Rechercher une ville ou une adresse"
            />
            {search && <button aria-label="Effacer la recherche" onClick={() => setSearch('')}>×</button>}
          </div>

          {tab === 'equipements' && (
            <aside className="nearby-results-panel" aria-label="Résultats à proximité">
              <div className="results-heading"><div><strong>{visiblePlaces.length} résultats</strong><span> à proximité</span></div><button><SortIcon /> Distance</button></div>
              <div className="place-list">
                {visiblePlaces.length ? visiblePlaces.map((place) => {
                  const color = domainStyle(place.domaineCode).color
                  return <button className={`place-card ${selectedId === place.id ? 'selected' : ''}`} key={place.id} onClick={() => handleSelect(place.id, true)}><span className="place-icon" style={{ color, background: `${color}18` }}>{domainIcon(place.domaineCode)}</span><span className="place-copy"><span className="place-category">{place.category}</span><strong>{place.name}</strong><small>{place.address}</small><span className="distance"><WalkIcon /> {place.distance}</span></span><ChevronIcon /></button>
                }) : <div className="empty-state"><SearchIcon /><strong>Aucun résultat</strong><span>Modifiez votre recherche ou vos filtres.</span></div>}
              </div>
            </aside>
          )}

          {selectedVisibleOnMap && selectedPlace && (
            <article className="map-popup">
              <button className="popup-close" onClick={() => setSelectedId(null)}>×</button>
              <span className="popup-tag">{selectedPlace.category}</span>
              <h3>{selectedPlace.name}</h3>
              <p><MapPinSmallIcon /> {selectedPlace.address || 'Adresse détaillée en chargement…'}</p>
              {selectedPlace.dept && <p>Département {selectedPlace.dept}</p>}
              {selectedPlace.siret && <p>SIRET {selectedPlace.siret}</p>}
              <button onClick={() => setShowModal(true)}><FlagIcon /> Ajouter une implantation</button>
            </article>
          )}
          {selectedImplantation && <article className="map-popup"><button className="popup-close" onClick={() => setSelectedImplantation(null)}>×</button><h3>{selectedImplantation.properties.titre}</h3><p>{selectedImplantation.properties.commentaire}</p><button onClick={() => { setEditingImplantation(selectedImplantation); setShowModal(true) }}>Modifier</button><button onClick={() => removeImplantation(selectedImplantation)}>Supprimer</button></article>}

          {!sidebarOpen && (
            <button
              className="open-sidebar"
              onClick={() => {
                setSidebarOpen(true)
                setShowFilters(true)
              }}
            >
              <ListIcon /> Filtres & résultats
            </button>
          )}

          <div className="map-actions">
            <IconButton label="Recentrer la carte" onClick={() => mapRef.current?.setView(INITIAL_CENTER, INITIAL_ZOOM)}><TargetIcon /></IconButton>
          </div>
          <div className="zoom-controls">
            <IconButton label="Zoomer" onClick={() => mapRef.current?.zoomIn()}><PlusIcon /></IconButton>
            <IconButton label="Dézoomer" onClick={() => mapRef.current?.zoomOut()}><MinusIcon /></IconButton>
          </div>

          <button className="floating-add" onClick={() => setShowModal(true)}><PlusIcon /><span>Ajouter un emplacement</span></button>
          <button
            className={`filter-fab ${showFilters ? 'active' : ''}`}
            onClick={() => {
              setShowFilters((prev) => !prev)
              setSidebarOpen(true)
            }}
          >
            <FilterIcon /> Filtres {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
          </button>
        </section>
      </main>

      {showModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowModal(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" aria-label="Fermer" onClick={() => setShowModal(false)}>×</button>
            <div className="modal-icon"><FlagIcon /></div>
            <p className="eyebrow">Implantation potentielle</p>
            <h2 id="modal-title">{editingImplantation ? 'Modifier l’implantation' : 'Ajouter une implantation'}</h2>
            <p className="modal-intro">Ajoutez un point géographique et vos observations.</p>
            <form onSubmit={saveProspect}>
              <label>Nom de l’emplacement<input name="titre" required defaultValue={editingImplantation?.properties.titre ?? (selectedPlace ? `À proximité de ${selectedPlace.name}` : '')} placeholder="Ex. Local rue du Temple" /></label>
              <label>Domaine BPE<select name="domaine3" defaultValue={editingImplantation?.properties.domaine3 ?? ''}><option value="">Aucun domaine</option>{tree.flatMap((d1) => d1.enfants.flatMap((d2) => d2.enfants.map((d3) => <option key={d3.code} value={d3.code}>{d3.libelle}</option>)))}</select></label>
              <label>Commentaire<textarea name="commentaire" defaultValue={editingImplantation?.properties.commentaire ?? ''} placeholder="Notes sur cette implantation…" rows={4} /></label>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)}>Annuler</button>
                {editingImplantation && <button type="button" onClick={() => removeImplantation(editingImplantation)}>Supprimer</button>}
                <button type="submit">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </div>
  )
}
