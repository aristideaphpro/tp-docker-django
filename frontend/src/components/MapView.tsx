import { useEffect, useRef, type RefObject } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L, { type Map as LeafletMap } from 'leaflet'
import 'leaflet.markercluster'
import type { EquipementCollection, EquipementProperties } from '../api/types'
import type { ImplantationFeature } from '../api/implantations'
import { domainStyle } from '../lib/domains'
import { INITIAL_CENTER, INITIAL_ZOOM, type Place } from '../lib/places'
import { clampBbox, type EquipementBbox } from '../lib/viewport'

function makeIcon(props: EquipementProperties, selected: boolean) {
  const style = domainStyle(props.domaine1_code ?? '')
  return L.divIcon({
    className: 'equipment-marker-shell',
    html: `<span class="equipment-marker${selected ? ' selected' : ''}" style="--marker:${style.color}"><i>${style.short}</i></span>`,
    iconSize: [38, 44],
    iconAnchor: [19, 42],
  })
}

/** Conserve le groupe de marqueurs et ne lui transmet que les ajouts/retraits. */
function ClusterLayer({
  data, selectedId, onSelect,
}: { data: EquipementCollection; selectedId: string | null; onSelect: (id: string) => void }) {
  const map = useMap()
  const markers = useRef(new Map<string, L.Marker>())
  const features = useRef(new Map<string, EquipementCollection['features'][number]>())
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const onSelectRef = useRef(onSelect)
  const selectedRef = useRef<string | null>(selectedId)
  onSelectRef.current = onSelect
  selectedRef.current = selectedId

  useEffect(() => {
    // chunkedLoading : à l'échelle régionale (~130 000 points), l'ajout par lots évite de figer la page.
    const cluster = L.markerClusterGroup({ showCoverageOnHover: false, animate: false, animateAddingMarkers: false, chunkedLoading: true })
    clusterRef.current = cluster
    map.addLayer(cluster)
    return () => {
      map.removeLayer(cluster)
      markers.current.clear()
      features.current.clear()
      clusterRef.current = null
    }
  }, [map])

  useEffect(() => {
    const cluster = clusterRef.current
    if (!cluster) return
    const nextIds = new Set(data.features.map((feature) => String(feature.id ?? feature.properties.id)))

    for (const [id, marker] of markers.current) {
      if (nextIds.has(id)) continue
      cluster.removeLayer(marker)
      markers.current.delete(id)
      features.current.delete(id)
    }

    const additions: L.Marker[] = []
    for (const feature of data.features) {
      const id = String(feature.id ?? feature.properties.id)
      const [lng, lat] = feature.geometry.coordinates
      const props = feature.properties
      const existing = markers.current.get(id)
      if (!existing) {
        const marker = L.marker([lat, lng], {
          icon: makeIcon(props, selectedRef.current === id),
          title: props.nom || props.domaine3_libelle || props.domaine3_code,
        })
        marker.on('click', () => onSelectRef.current(id))
        markers.current.set(id, marker)
        features.current.set(id, feature)
        additions.push(marker)
      } else if (features.current.get(id) !== feature) {
        existing.setLatLng([lat, lng])
        existing.setIcon(makeIcon(props, selectedRef.current === id))
        existing.options.title = props.nom || props.domaine3_libelle || props.domaine3_code
        features.current.set(id, feature)
      }
    }
    if (additions.length) cluster.addLayers(additions)
  }, [data, map])

  const previousId = useRef<string | null>(null)
  useEffect(() => {
    for (const id of [previousId.current, selectedId]) {
      if (!id) continue
      const marker = markers.current.get(id)
      const feature = features.current.get(id)
      if (marker && feature) marker.setIcon(makeIcon(feature.properties, id === selectedId))
    }
    previousId.current = selectedId
  }, [selectedId])

  return null
}

/** Première emprise immédiate, puis mise à jour après chaque moveend avec debounce. */
function ViewportWatcher({ onChange }: { onChange: (bbox: EquipementBbox) => void }) {
  const map = useMap()
  const callback = useRef(onChange)
  callback.current = onChange

  useEffect(() => {
    let timer: number | undefined
    const emitBounds = () => {
      const bounds = map.getBounds()
      if (!bounds.isValid()) return
      const bbox = clampBbox([
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ])
      if (bbox) callback.current(bbox)
    }
    const debounceMoveEnd = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(emitBounds, 250)
    }

    map.whenReady(emitBounds)
    map.on('moveend', debounceMoveEnd)
    return () => {
      window.clearTimeout(timer)
      map.off('moveend', debounceMoveEnd)
    }
  }, [map])

  return null
}

function ResizeWatcher() {
  const map = useMap()
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    return () => observer.disconnect()
  }, [map])
  return null
}

/** Implantations privées : clic = fiche, glisser-déposer = déplacement (onMove persiste la position). */
function ImplantationLayer({
  points, onSelect, onMove,
}: {
  points: ImplantationFeature[]
  onSelect: (point: ImplantationFeature) => void
  onMove?: (point: ImplantationFeature, position: { lat: number; lng: number }) => void
}) {
  const map = useMap()
  const callback = useRef(onSelect)
  const moveCallback = useRef(onMove)
  const markers = useRef(new Map<number, L.Marker>())
  const pointsById = useRef(new Map<number, ImplantationFeature>())
  const layerRef = useRef<L.MarkerClusterGroup | null>(null)
  callback.current = onSelect
  moveCallback.current = onMove
  useEffect(() => {
    const layer = L.markerClusterGroup({ showCoverageOnHover: false, animate: false, animateAddingMarkers: false }).addTo(map)
    layerRef.current = layer
    return () => { map.removeLayer(layer); markers.current.clear(); layerRef.current = null }
  }, [map])
  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    pointsById.current = new Map(points.map((point) => [point.id, point]))
    const ids = new Set(points.map((point) => point.id))
    for (const [id, marker] of markers.current) {
      if (ids.has(id)) continue
      layer.removeLayer(marker)
      markers.current.delete(id)
    }
    const additions: L.Marker[] = []
    points.forEach((point) => {
      const [lng, lat] = point.geometry.coordinates
      const existing = markers.current.get(point.id)
      if (existing) {
        existing.setLatLng([lat, lng])
        existing.options.title = point.properties.titre
        return
      }
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({ className: 'implantation-marker', html: '<span>★</span>', iconSize: [34, 34], iconAnchor: [17, 17] }),
        title: point.properties.titre,
        draggable: true,
        autoPan: true,
      })
      marker.on('click', () => {
        const latest = pointsById.current.get(point.id)
        if (latest) callback.current(latest)
      })
      marker.on('dragend', () => {
        const latest = pointsById.current.get(point.id)
        if (!latest) return
        const position = marker.getLatLng()
        if (moveCallback.current) moveCallback.current(latest, { lat: position.lat, lng: position.lng })
        else marker.setLatLng([latest.geometry.coordinates[1], latest.geometry.coordinates[0]])
      })
      markers.current.set(point.id, marker)
      additions.push(marker)
    })
    if (additions.length) layer.addLayers(additions)
  }, [points])
  return null
}

/** Repère temporaire de l'adresse trouvée par la barre de recherche. */
function SearchResultLayer({ result }: { result: SearchResult | null }) {
  const map = useMap()
  useEffect(() => {
    if (!result) return
    const marker = L.marker([result.lat, result.lng], {
      icon: L.divIcon({ className: 'search-result-marker', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
      title: result.label,
      keyboard: false,
      zIndexOffset: 1000,
    }).addTo(map)
    return () => { marker.remove() }
  }, [map, result])
  return null
}

export type SearchResult = { lat: number; lng: number; label: string }

function SelectedVisibilityWatcher({
  selectedPlace, onChange,
}: { selectedPlace: Place | null; onChange: (visible: boolean) => void }) {
  const map = useMap()
  useEffect(() => {
    if (!selectedPlace) {
      onChange(false)
      return
    }
    const update = () => {
      if (!map.getBounds().contains([selectedPlace.lat, selectedPlace.lng])) onChange(false)
    }
    update()
    map.on('move zoom resize', update)
    return () => {
      map.off('move zoom resize', update)
    }
  }, [map, selectedPlace, onChange])
  return null
}

export default function MapView({
  data, selectedId, selectedPlace, onSelect, onViewportChange, onSelectedVisibilityChange, mapRef, implantations = [], onSelectImplantation,
  onMoveImplantation, searchResult = null,
}: {
  data: EquipementCollection
  selectedId: string | null
  selectedPlace: Place | null
  onSelect: (id: string) => void
  onViewportChange: (bbox: EquipementBbox) => void
  onSelectedVisibilityChange: (visible: boolean) => void
  mapRef: RefObject<LeafletMap | null>
  implantations?: ImplantationFeature[]
  onSelectImplantation?: (point: ImplantationFeature) => void
  onMoveImplantation?: (point: ImplantationFeature, position: { lat: number; lng: number }) => void
  searchResult?: SearchResult | null
}) {
  return (
    <MapContainer
      ref={mapRef}
      center={INITIAL_CENTER}
      zoom={INITIAL_ZOOM}
      zoomControl={false}
      minZoom={4}
      maxZoom={19}
      className="leaflet-map"
    >
      <TileLayer url="https://tile.openstreetmap.de/{z}/{x}/{y}.png" maxZoom={19} attribution="&copy; OpenStreetMap contributors" />
      <ClusterLayer data={data} selectedId={selectedId} onSelect={onSelect} />
      {onSelectImplantation && <ImplantationLayer points={implantations} onSelect={onSelectImplantation} onMove={onMoveImplantation} />}
      <SearchResultLayer result={searchResult} />
      <ViewportWatcher onChange={onViewportChange} />
      <ResizeWatcher />
      <SelectedVisibilityWatcher selectedPlace={selectedPlace} onChange={onSelectedVisibilityChange} />
    </MapContainer>
  )
}
