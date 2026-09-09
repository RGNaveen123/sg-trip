import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useEffect, useMemo } from 'react'
import type { LatLng } from '../lib/types'

export interface MapPoint {
  id: string
  name: string
  coords: LatLng
  /** Short badge drawn inside the pin — usually the stop number. */
  badge?: string
  kind?: 'normal' | 'locked' | 'stay'
  photo?: string | null
  /** Extra line under the name in the popup. */
  meta?: string
  href?: string
  hrefLabel?: string
}

const SG_CENTRE: [number, number] = [1.3, 103.85]

function icon(p: MapPoint) {
  const cls = `pin ${p.kind === 'locked' ? 'locked' : p.kind === 'stay' ? 'stay' : ''}`
  return L.divIcon({
    className: 'bg-transparent border-0',
    html: `<div class="${cls}">${p.badge ?? '•'}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  })
}

function Fit({ points, active }: { points: MapPoint[]; active: boolean }) {
  const map = useMap()
  const key = points.map((p) => `${p.coords.lat},${p.coords.lng}`).join('|')
  useEffect(() => {
    if (!active) return
    if (points.length === 0) {
      map.setView(SG_CENTRE, 11.5)
      return
    }
    if (points.length === 1) {
      map.setView([points[0].coords.lat, points[0].coords.lng], 15)
      return
    }
    const b = L.latLngBounds(points.map((p) => [p.coords.lat, p.coords.lng] as [number, number]))
    map.fitBounds(b, { padding: [46, 46], maxZoom: 15 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active])
  return null
}

/**
 * Tap anywhere to drop the pin. No geocoder, no link parsing, no network —
 * the one way of setting a location that cannot fail.
 */
function ClickToPlace({ onPick }: { onPick: (c: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) })
    },
  })
  return null
}

/** Leaflet measures itself on mount; inside a sheet that is too early. */
function Resize() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 180)
    const onResize = () => map.invalidateSize()
    window.addEventListener('resize', onResize)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', onResize)
    }
  }, [map])
  return null
}

export function MapView({
  points,
  connect = false,
  height = 300,
  interactive = true,
  fit = true,
  className = '',
  onPick,
}: {
  points: MapPoint[]
  connect?: boolean
  height?: number | string
  interactive?: boolean
  fit?: boolean
  className?: string
  /** When set, tapping the map reports the coordinates instead of doing nothing. */
  onPick?: (c: LatLng) => void
}) {
  const line = useMemo(
    () => points.map((p) => [p.coords.lat, p.coords.lng] as [number, number]),
    [points],
  )

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-line ${className}`}
      style={{ height }}
    >
      <MapContainer
        center={SG_CENTRE}
        zoom={11.5}
        zoomControl={interactive}
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        attributionControl
        style={{ height: '100%', width: '100%' }}
      >
        {/* Keyless OpenStreetMap tiles, darkened in CSS — no API key, no quota. */}
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
          maxZoom={19}
        />
        {connect && line.length > 1 && (
          <Polyline
            positions={line}
            pathOptions={{ color: '#E8B45C', weight: 2, opacity: 0.55, dashArray: '5 7' }}
          />
        )}
        {points.map((p) => (
          <Marker key={p.id} position={[p.coords.lat, p.coords.lng]} icon={icon(p)}>
            <Popup>
              {p.photo && (
                <img
                  src={p.photo}
                  alt=""
                  className="mb-2 h-24 w-full rounded-lg object-cover"
                  loading="lazy"
                />
              )}
              <div className="font-semibold text-[13px] text-cream">{p.name}</div>
              {p.meta && <div className="mt-0.5 text-[11px] text-mute">{p.meta}</div>}
              {p.href && (
                <a
                  href={p.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block font-mono text-[10px] uppercase tracking-[0.1em] text-transit"
                >
                  {p.hrefLabel ?? 'Directions ↗'}
                </a>
              )}
            </Popup>
          </Marker>
        ))}
        {onPick && <ClickToPlace onPick={onPick} />}
        <Fit points={points} active={fit} />
        <Resize />
      </MapContainer>
    </div>
  )
}
