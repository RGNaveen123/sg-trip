import { useEffect, useMemo, useState } from 'react'
import { Bus, Car, Footprints, Minus, Plus, TriangleAlert } from 'lucide-react'
import { Btn, Chip, Field, inputCls, Sheet } from './ui'
import { MapView, type MapPoint } from './LazyMap'
import { useTrip } from '../lib/store'
import { useAllItems } from '../lib/hooks'
import {
  dateForDay,
  dayCount,
  endOf,
  formatDayLabel,
  formatTime12,
  itemsForDay,
} from '../lib/trip'
import {
  addMinutes,
  directionsUrl,
  estimateTravel,
  formatDuration,
  toMinutes,
} from '../lib/geo'
import type { ItineraryItem, Place } from '../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  /** Scheduling a catalogue/custom place. */
  place?: Place | null
  /** Editing an existing stop instead. */
  editing?: ItineraryItem | null
  onDone?: (msg: string) => void
}

export function ScheduleSheet({ open, onClose, place, editing, onDone }: Props) {
  const setup = useTrip((s) => s.setup)
  const stay = useTrip((s) => s.stay)
  const addItem = useTrip((s) => s.addItem)
  const updateItem = useTrip((s) => s.updateItem)
  const all = useAllItems()
  const days = dayCount(setup)

  const name = editing?.name ?? place?.name ?? ''
  const coords = editing?.coords ?? place?.coords ?? null
  const minRec = editing?.minRecommendedMin ?? place?.minRecommendedMin

  const [day, setDay] = useState(editing?.day ?? 1)
  const [start, setStart] = useState(editing?.start ?? '10:00')
  const [duration, setDuration] = useState(
    editing?.durationMin ?? place?.typicalMin ?? 90,
  )
  const [fromId, setFromId] = useState<string>('stay')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [touchedTime, setTouchedTime] = useState(false)

  // Reset each time the sheet is opened for something new.
  useEffect(() => {
    if (!open) return
    setDay(editing?.day ?? 1)
    setStart(editing?.start ?? '10:00')
    setDuration(editing?.durationMin ?? place?.typicalMin ?? 90)
    setNotes(editing?.notes ?? '')
    setFromId('stay')
    setTouchedTime(Boolean(editing))
  }, [open, editing, place])

  /** Anything already on that day that could plausibly be the previous stop. */
  const dayItems = useMemo(
    () => itemsForDay(all, day).filter((i) => i.id !== editing?.id),
    [all, day, editing?.id],
  )

  const fromOptions = useMemo(() => {
    const opts: { id: string; label: string; coords: typeof coords; endsAt?: string }[] = []
    if (stay?.coords) {
      opts.push({ id: 'stay', label: `${stay.name || 'The guest house'} — your stay`, coords: stay.coords })
    }
    for (const i of dayItems) {
      if (!i.coords) continue
      opts.push({
        id: i.id,
        label: `${formatTime12(i.start)} · ${i.name}`,
        coords: i.coords,
        endsAt: endOf(i),
      })
    }
    opts.push({ id: 'none', label: 'Nowhere in particular', coords: null })
    return opts
  }, [stay, dayItems])

  useEffect(() => {
    if (!fromOptions.some((o) => o.id === fromId)) {
      setFromId(fromOptions[0]?.id ?? 'none')
    }
  }, [fromOptions, fromId])

  const from = fromOptions.find((o) => o.id === fromId) ?? null
  const estimate = from?.coords && coords ? estimateTravel(from.coords, coords) : null

  // Suggest a start time that actually accounts for getting there.
  useEffect(() => {
    if (touchedTime || !from) return
    if (from.endsAt && estimate) {
      setStart(addMinutes(from.endsAt, Math.max(15, estimate.transitMin)))
    }
  }, [from, estimate, touchedTime])

  const conflict = useMemo(() => {
    const s = toMinutes(start)
    const e = s + duration
    return dayItems.find((i) => {
      const is = toMinutes(i.start)
      const ie = is + i.durationMin
      return s < ie && e > is
    })
  }, [dayItems, start, duration])

  const mapPoints: MapPoint[] = []
  if (from?.coords) {
    mapPoints.push({
      id: 'from',
      name: from.label,
      coords: from.coords,
      badge: '↑',
      kind: fromId === 'stay' ? 'stay' : 'normal',
    })
  }
  if (coords) {
    mapPoints.push({ id: 'to', name: name || 'This stop', coords, badge: '★', kind: 'normal' })
  }

  const save = () => {
    if (editing) {
      updateItem(editing.id, { day, start, durationMin: duration, notes })
      onDone?.(`${name} moved to day ${day}, ${formatTime12(start)}.`)
    } else {
      addItem({
        day,
        start,
        durationMin: duration,
        name,
        placeId: place?.id,
        coords,
        notes,
        category: place?.category,
        minRecommendedMin: place?.minRecommendedMin,
      })
      onDone?.(`${name} added to day ${day} at ${formatTime12(start)}.`)
    }
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Reschedule' : 'Add to the plan'}
      subtitle={name}
      full
    >
      <div className="space-y-5">
        <div>
          <div className="lbl mb-2">Which day</div>
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
              const { dow, dm } = formatDayLabel(dateForDay(setup, d))
              const on = d === day
              return (
                <button
                  key={d}
                  onClick={() => setDay(d)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-left transition-colors ${
                    on ? 'border-gold bg-gold/12' : 'border-line'
                  }`}
                >
                  <div className={`font-mono text-[9px] uppercase tracking-[0.14em] ${on ? 'text-gold' : 'text-mute-2'}`}>
                    Day {d} · {dow}
                  </div>
                  <div className={`disp text-[17px] ${on ? 'text-gold' : 'text-cream'}`}>{dm}</div>
                </button>
              )
            })}
          </div>
        </div>

        <Field label="Coming from" hint="Sets a realistic start time and shows the actual hop.">
          <select
            value={fromId}
            onChange={(e) => {
              setFromId(e.target.value)
              setTouchedTime(false)
            }}
            className={inputCls}
          >
            {fromOptions.map((o) => (
              <option key={o.id} value={o.id} className="bg-ink-2">
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        {mapPoints.length > 0 && (
          <MapView points={mapPoints} connect height={180} interactive={false} />
        )}

        {estimate && (
          <div className="card p-3">
            <div className="lbl mb-2">Getting there · about {estimate.km} km</div>
            <div className="grid grid-cols-3 gap-2">
              <ModeCell icon={<Footprints size={13} />} label="Walk" mins={estimate.walkMin} tone="walk" />
              <ModeCell icon={<Bus size={13} />} label="MRT/bus" mins={estimate.transitMin} tone="transit" />
              <ModeCell icon={<Car size={13} />} label="Taxi" mins={estimate.taxiMin} tone="taxi" />
            </div>
            {from?.coords && coords && (
              <a
                href={directionsUrl(from.coords, coords, estimate.suggested)}
                target="_blank"
                rel="noreferrer"
                className="mt-2.5 block text-center font-mono text-[10px] uppercase tracking-[0.12em] text-transit"
              >
                Live directions & traffic ↗
              </a>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <input
              type="time"
              value={start}
              onChange={(e) => {
                setStart(e.target.value || '10:00')
                setTouchedTime(true)
              }}
              className={inputCls}
            />
          </Field>
          <Field label="How long">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDuration((d) => Math.max(15, d - 15))}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-mute active:scale-90 transition-transform"
                aria-label="Less time"
              >
                <Minus size={14} />
              </button>
              <div className="flex-1 text-center disp text-[20px] text-cream">
                {formatDuration(duration)}
              </div>
              <button
                onClick={() => setDuration((d) => Math.min(720, d + 15))}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-mute active:scale-90 transition-transform"
                aria-label="More time"
              >
                <Plus size={14} />
              </button>
            </div>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="mute">
            {formatTime12(start)} → {formatTime12(addMinutes(start, duration))}
          </Chip>
          {minRec && duration < minRec && (
            <Chip tone="alert">
              <TriangleAlert size={10} /> most people need {formatDuration(minRec)}
            </Chip>
          )}
        </div>

        {conflict && (
          <div className="rounded-xl border border-danger/40 bg-danger/8 p-3 text-[12px] leading-snug text-danger">
            Overlaps <span className="font-semibold">{conflict.name}</span> ({formatTime12(conflict.start)}–
            {formatTime12(endOf(conflict))}). You can still save it — the itinerary will flag it.
          </div>
        )}

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Booking reference, who wants to go, what to order…"
            className={inputCls}
          />
        </Field>

        <Btn variant="gold" full onClick={save}>
          {editing ? 'Save changes' : 'Add to day ' + day}
        </Btn>
      </div>
    </Sheet>
  )
}

function ModeCell({
  icon,
  label,
  mins,
  tone,
}: {
  icon: React.ReactNode
  label: string
  mins: number
  tone: 'walk' | 'transit' | 'taxi'
}) {
  const colors = { walk: 'text-walk', transit: 'text-transit', taxi: 'text-taxi' }
  return (
    <div className="rounded-lg border border-line bg-ink-2/40 px-2 py-2 text-center">
      <div className={`flex items-center justify-center gap-1 ${colors[tone]}`}>{icon}</div>
      <div className="disp mt-1 text-[19px] text-cream">{mins}<span className="text-[11px] text-mute">m</span></div>
      <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-mute-2">{label}</div>
    </div>
  )
}
