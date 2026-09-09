import { useEffect, useMemo, useState } from 'react'
import { Layers, LocateFixed } from 'lucide-react'
import { MapView, type MapPoint } from '../components/LazyMap'
import { Chip } from '../components/ui'
import { useTrip } from '../lib/store'
import { useAllItems } from '../lib/hooks'
import { PLACE_BY_ID } from '../data/places'
import { dateForDay, dayCount, formatDayLabel, itemsForDay, legsForDay } from '../lib/trip'
import { directionsUrl, formatDuration } from '../lib/geo'
import { wikiSummary } from '../lib/free'

export function MapScreen({ position }: { position: { lat: number; lng: number } | null }) {
  const setup = useTrip((s) => s.setup)
  const stay = useTrip((s) => s.stay)
  const customPlaces = useTrip((s) => s.customPlaces)
  const placeInfo = useTrip((s) => s.placeInfo)
  const cachePlaceInfo = useTrip((s) => s.cachePlaceInfo)
  const all = useAllItems()
  const days = dayCount(setup)
  const [day, setDay] = useState<number | 'all'>('all')

  const shown = useMemo(() => {
    if (day === 'all') {
      return Array.from({ length: days }, (_, i) => i + 1).flatMap((d) => itemsForDay(all, d))
    }
    return itemsForDay(all, day)
  }, [all, day, days])

  const withCoords = shown.filter((i) => i.coords)

  // Warm the photo cache for whatever is on screen — free, and cached forever.
  useEffect(() => {
    const missing = withCoords
      .map((i) => PLACE_BY_ID.get(i.placeId ?? '')?.wiki)
      .filter((w): w is string => Boolean(w) && !placeInfo[w!])
      .slice(0, 4)
    missing.forEach((w) => {
      wikiSummary(w).then((r) =>
        cachePlaceInfo(w, { extract: r?.extract ?? '', photo: r?.photo ?? null, fetchedAt: Date.now() }),
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, shown.length])

  const legsByDay = useMemo(() => {
    const m = new Map<string, number>()
    for (let d = 1; d <= days; d++) {
      const items = itemsForDay(all, d)
      legsForDay(items, stay).forEach((l) => m.set(l.to.id, l.minutes))
    }
    return m
  }, [all, days, stay])

  const points: MapPoint[] = withCoords.map((it, i) => {
    const place = PLACE_BY_ID.get(it.placeId ?? '') ?? customPlaces.find((p) => p.id === it.placeId)
    const wiki = place && 'wiki' in place ? place.wiki : undefined
    const travel = legsByDay.get(it.id)
    return {
      id: it.id,
      name: it.name,
      coords: it.coords!,
      badge: String(i + 1),
      kind: it.locked ? 'locked' : 'normal',
      photo: wiki ? (placeInfo[wiki]?.photo ?? null) : null,
      meta: `Day ${it.day} · ${it.start} · ${formatDuration(it.durationMin)}${
        travel ? ` · ${travel}m to get here` : ''
      }`,
      href: directionsUrl(position, it.coords!, 'transit'),
      hrefLabel: 'Live directions ↗',
    }
  })

  if (stay?.coords) {
    points.unshift({
      id: 'stay',
      name: stay.name || 'Your stay',
      coords: stay.coords,
      badge: '⌂',
      kind: 'stay',
      meta: stay.area ?? undefined,
      href: directionsUrl(position, stay.coords, 'transit'),
    })
  }

  if (position) {
    points.push({
      id: 'me',
      name: 'You are here',
      coords: position,
      badge: '●',
      kind: 'stay',
    })
  }

  return (
    <div className="px-4 pb-6">
      <div className="no-scrollbar -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4">
        <DayChip on={day === 'all'} onClick={() => setDay('all')}>
          Whole trip
        </DayChip>
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
          const { dm } = formatDayLabel(dateForDay(setup, d))
          return (
            <DayChip key={d} on={day === d} onClick={() => setDay(d)}>
              D{d} · {dm}
            </DayChip>
          )
        })}
      </div>

      <MapView points={points} connect={day !== 'all'} height="calc(100dvh - 290px)" />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Chip tone="gold">
          <Layers size={10} /> {withCoords.length} stop{withCoords.length === 1 ? '' : 's'}
        </Chip>
        {stay?.coords && <Chip tone="walk">⌂ your stay</Chip>}
        {position && (
          <Chip tone="ok">
            <LocateFixed size={10} /> live position
          </Chip>
        )}
        {day !== 'all' && <Chip tone="mute">connected in visit order</Chip>}
      </div>

      <p className="mt-2 text-[11.5px] leading-snug text-mute-2">
        Tap any pin for a photo and a live-traffic directions link. Tiles are cached as you browse,
        so the map still draws with no signal.
      </p>
    </div>
  )
}

function DayChip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
        on ? 'border-gold bg-gold/12 text-gold' : 'border-line text-mute'
      }`}
    >
      {children}
    </button>
  )
}
