import type { ItineraryItem, LatLng, Stay, TripSetup } from './types'
import { PLACE_BY_ID } from '../data/places'
import {
  addMinutes,
  estimateTravel,
  isAfterLastTrain,
  minutesFor,
  toMinutes,
  type TravelEstimate,
  type TravelMode,
} from './geo'

export interface Anchors {
  /** Universal Studios is booked for a specific date. */
  ussDate: string
  /** Concert date, showtime, and how early Express entry wants you there. */
  concertDate: string
  concertStart: string
  concertArriveEarlyMin: number
  concertRunMin: number
  /** Minutes on the ground at Changi before the flight home. */
  departureBufferMin: number
  /** Immigration, bags, SIM card. */
  arrivalBufferMin: number
  /** Getting to the guest house and dropping bags. */
  transferMin: number
}

export const DEFAULT_ANCHORS: Anchors = {
  ussDate: '2026-12-18',
  concertDate: '2026-12-20',
  concertStart: '19:00',
  concertArriveEarlyMin: 180,
  concertRunMin: 180,
  departureBufferMin: 180,
  arrivalBufferMin: 90,
  transferMin: 90,
}

export const DEFAULT_SETUP: TripSetup = {
  outboundISO: '2026-12-16T22:45',
  arriveISO: '2026-12-17T06:00',
  departISO: '2026-12-21T20:20',
  homeCurrency: 'INR',
  pace: 'balanced',
}

export const CHANGI: LatLng = { lat: 1.3556, lng: 103.9865 }
export const USS_COORDS: LatLng = { lat: 1.254, lng: 103.8238 }
export const STADIUM_COORDS: LatLng = { lat: 1.3048, lng: 103.8742 }

// ---------- dates ----------

export function parseLocal(iso: string): Date {
  const [d, t = '00:00'] = iso.split('T')
  const [y, mo, da] = d.split('-').map(Number)
  const [h, mi] = t.split(':').map(Number)
  return new Date(y, (mo || 1) - 1, da || 1, h || 0, mi || 0)
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function timeOf(iso: string): string {
  return iso.split('T')[1]?.slice(0, 5) ?? '00:00'
}

export function dateOf(iso: string): string {
  return iso.split('T')[0]
}

export function dayCount(setup: TripSetup): number {
  const a = parseLocal(dateOf(setup.arriveISO))
  const b = parseLocal(dateOf(setup.departISO))
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000)
  return Math.max(1, Math.min(21, diff + 1))
}

export function dateForDay(setup: TripSetup, day: number): Date {
  const a = parseLocal(dateOf(setup.arriveISO))
  a.setDate(a.getDate() + (day - 1))
  return a
}

export function dayForDate(setup: TripSetup, dateStr: string): number | null {
  const a = parseLocal(dateOf(setup.arriveISO))
  const t = parseLocal(dateStr)
  const diff = Math.round((t.getTime() - a.getTime()) / 86400000)
  const d = diff + 1
  return d >= 1 && d <= dayCount(setup) ? d : null
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDayLabel(d: Date): { dow: string; dm: string } {
  return { dow: DOW[d.getDay()], dm: `${d.getDate()} ${MON[d.getMonth()]}` }
}

export function formatTime12(hhmm: string): string {
  const m = toMinutes(hhmm)
  const h24 = Math.floor(m / 60)
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h}:${String(m % 60).padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}`
}

// ---------- locked / system blocks ----------

/**
 * The blocks that are not up for negotiation. Derived from trip setup rather
 * than stored, so changing a flight time moves them instead of leaving a
 * stale copy behind. Nothing — user or model — can delete or move these.
 */
export function fixedBlocks(
  setup: TripSetup,
  anchors: Anchors,
  stay: Stay | null,
): ItineraryItem[] {
  const out: ItineraryItem[] = []
  const days = dayCount(setup)
  const arriveTime = timeOf(setup.arriveISO)

  out.push({
    id: 'fx-arrival',
    day: 1,
    start: arriveTime,
    durationMin: anchors.arrivalBufferMin,
    name: 'Land at Changi · immigration & bags',
    coords: CHANGI,
    locked: true,
    category: 'transit',
    notes: 'SQ from Kochi. Clear immigration, grab bags, pick up an EZ-Link/SimplyGo card and a SIM before leaving the terminal.',
  })

  if (stay?.coords) {
    out.push({
      id: 'fx-transfer',
      day: 1,
      start: addMinutes(arriveTime, anchors.arrivalBufferMin),
      durationMin: anchors.transferMin,
      name: `Travel to ${stay.name || 'the guest house'} · drop bags`,
      coords: stay.coords,
      locked: true,
      category: 'transit',
      notes: 'MRT from Changi, change at Tanah Merah. Drop the bags, then the day is yours.',
    })
  }

  const ussDay = dayForDate(setup, anchors.ussDate)
  if (ussDay) {
    out.push({
      id: 'fx-uss',
      day: ussDay,
      start: '09:30',
      durationMin: 570,
      name: 'Universal Studios Singapore',
      placeId: 'uss',
      coords: USS_COORDS,
      locked: true,
      category: 'sights',
      minRecommendedMin: 420,
      notes: 'Full day, booked. Sentosa Express from VivoCity. Water rides are real — pack a poncho and a dry bag.',
    })
  }

  const concertDay = dayForDate(setup, anchors.concertDate)
  if (concertDay) {
    out.push({
      id: 'fx-concert',
      day: concertDay,
      start: addMinutes(anchors.concertStart, -anchors.concertArriveEarlyMin),
      durationMin: anchors.concertArriveEarlyMin + anchors.concertRunMin,
      name: 'Concert · National Stadium',
      placeId: 'national-stadium',
      coords: STADIUM_COORDS,
      locked: true,
      category: 'nightlife',
      notes: `Doors well before the ${formatTime12(anchors.concertStart)} start — arrive ${Math.round(anchors.concertArriveEarlyMin / 60)} hours early for Express entry. Stadium MRT, Circle Line. Bag rules are strict.`,
    })
  }

  const departTime = timeOf(setup.departISO)
  out.push({
    id: 'fx-departure',
    day: days,
    start: addMinutes(departTime, -anchors.departureBufferMin),
    durationMin: anchors.departureBufferMin,
    name: 'Changi T3 · check-in & fly home',
    coords: CHANGI,
    locked: true,
    category: 'transit',
    notes: `SQ departs ${formatTime12(departTime)}. Leave the city at least 90 minutes before this block starts.`,
  })

  return out
}

export function allItems(
  items: ItineraryItem[],
  setup: TripSetup,
  anchors: Anchors,
  stay: Stay | null,
): ItineraryItem[] {
  return [...fixedBlocks(setup, anchors, stay), ...items]
}

export function itemsForDay(all: ItineraryItem[], day: number): ItineraryItem[] {
  return all
    .filter((i) => i.day === day)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start) || a.durationMin - b.durationMin)
}

export function endOf(item: ItineraryItem): string {
  return addMinutes(item.start, item.durationMin)
}

// ---------- travel legs between stops ----------

export interface Leg {
  from: { name: string; coords: LatLng } | null
  to: ItineraryItem
  estimate: TravelEstimate | null
  mode: TravelMode
  minutes: number
  /** Free minutes between the end of the previous stop and the next start. */
  gapMin: number
  /** Not enough slack to make it by train — a taxi is the honest fallback. */
  tight: boolean
  /** Trains have stopped by then. */
  lateNight: boolean
  overlaps: boolean
  /** Nothing to show: the block itself is the journey, or you just landed. */
  hidden: boolean
}

/**
 * Two blocks are journeys rather than destinations you travel to: you arrive
 * at Changi off the plane, and the transfer block *is* the ride to the guest
 * house. Drawing a leg into either would be nonsense, so they are suppressed.
 */
const NO_INBOUND_LEG = new Set(['fx-arrival', 'fx-transfer'])

export function legsForDay(
  dayItems: ItineraryItem[],
  stay: Stay | null,
): Leg[] {
  const legs: Leg[] = []
  for (let i = 0; i < dayItems.length; i++) {
    const to = dayItems[i]
    const hidden = NO_INBOUND_LEG.has(to.id)
    const prev = i === 0 ? null : dayItems[i - 1]
    const fromCoords: LatLng | null = prev
      ? prev.coords
      : stay?.coords ?? null
    // Leaving the transfer block means leaving the guest house — say so.
    const fromName = prev
      ? prev.id === 'fx-transfer'
        ? stay?.name || 'the guest house'
        : prev.name
      : stay?.name || 'your stay'

    const gapMin = prev
      ? toMinutes(to.start) - toMinutes(endOf(prev))
      : Number.POSITIVE_INFINITY

    if (hidden || !fromCoords || !to.coords) {
      legs.push({
        from: fromCoords ? { name: fromName, coords: fromCoords } : null,
        to,
        estimate: null,
        mode: 'transit',
        minutes: 0,
        gapMin: isFinite(gapMin) ? gapMin : 0,
        tight: false,
        lateNight: !hidden && isAfterLastTrain(to.start),
        overlaps: !hidden && isFinite(gapMin) && gapMin < 0,
        hidden,
      })
      continue
    }

    const est = estimateTravel(fromCoords, to.coords)
    const lateNight = isAfterLastTrain(to.start)
    let mode: TravelMode = est.suggested
    const need = minutesFor(est, mode)
    const slack = isFinite(gapMin) ? gapMin : need + 999
    const tight = slack >= 0 && slack < need
    if (lateNight && mode === 'transit') mode = 'taxi'
    else if (tight && est.taxiMin <= slack) mode = 'taxi'

    legs.push({
      from: { name: fromName, coords: fromCoords },
      to,
      estimate: est,
      mode,
      minutes: minutesFor(est, mode),
      gapMin: isFinite(gapMin) ? gapMin : 0,
      tight,
      lateNight,
      overlaps: isFinite(gapMin) && gapMin < 0,
      hidden: false,
    })
  }
  return legs
}

// ---------- open slots, for auto-plan ----------

export interface FreeSlot {
  day: number
  start: string
  minutes: number
}

const DAY_WINDOW: Record<TripSetup['pace'], { from: string; to: string }> = {
  relaxed: { from: '10:00', to: '21:00' },
  balanced: { from: '09:00', to: '22:00' },
  packed: { from: '08:00', to: '23:00' },
}

export function freeSlots(
  all: ItineraryItem[],
  setup: TripSetup,
  minSlotMin = 60,
): FreeSlot[] {
  const win = DAY_WINDOW[setup.pace]
  const out: FreeSlot[] = []
  for (let day = 1; day <= dayCount(setup); day++) {
    const items = itemsForDay(all, day)
    let cursor = toMinutes(win.from)
    const dayEnd = toMinutes(win.to)
    // Day 1 cannot start before the plane lands.
    if (day === 1) cursor = Math.max(cursor, toMinutes(timeOf(setup.arriveISO)))
    for (const it of items) {
      const s = toMinutes(it.start)
      if (s - cursor >= minSlotMin) out.push({ day, start: `${pad(cursor)}`, minutes: s - cursor })
      cursor = Math.max(cursor, toMinutes(endOf(it)))
    }
    if (dayEnd - cursor >= minSlotMin) out.push({ day, start: pad(cursor), minutes: dayEnd - cursor })
  }
  return out
}

function pad(mins: number): string {
  const m = Math.max(0, Math.min(1439, mins))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

// ---------- warnings ----------

export interface Warning {
  id: string
  level: 'info' | 'warn' | 'danger'
  text: string
  day?: number
}

/** A fixed block whose date no longer falls inside the trip. */
export interface StrandedAnchor {
  key: 'ussDate' | 'concertDate'
  label: string
  date: string
}

/**
 * Anchors are absolute dates because the bookings they represent are. Move the
 * flights and an anchor can fall outside the trip entirely — at which point
 * `fixedBlocks` stops emitting it and the commitment silently disappears.
 * This finds those so the UI can shout about it.
 */
export function strandedAnchors(setup: TripSetup, anchors: Anchors): StrandedAnchor[] {
  const out: StrandedAnchor[] = []
  if (!dayForDate(setup, anchors.ussDate)) {
    out.push({ key: 'ussDate', label: 'Universal Studios', date: anchors.ussDate })
  }
  if (!dayForDate(setup, anchors.concertDate)) {
    out.push({ key: 'concertDate', label: 'The concert', date: anchors.concertDate })
  }
  return out
}

export function tripWarnings(
  all: ItineraryItem[],
  setup: TripSetup,
  stay: Stay | null,
  anchors?: Anchors,
): Warning[] {
  const out: Warning[] = []
  const days = dayCount(setup)

  // Loudest first: a booking that has fallen off the end of the trip.
  if (anchors) {
    for (const a of strandedAnchors(setup, anchors)) {
      out.push({
        id: `stranded-${a.key}`,
        level: 'danger',
        text: `${a.label} is booked for ${a.date}, which is outside these trip dates — so its block has disappeared from the plan. Fix the date in Settings.`,
      })
    }
  }

  for (let day = 1; day <= days; day++) {
    const items = itemsForDay(all, day)
    const legs = legsForDay(items, stay)

    for (const leg of legs) {
      if (leg.overlaps) {
        out.push({
          id: `overlap-${leg.to.id}`,
          level: 'danger',
          day,
          text: `${leg.to.name} starts before the stop before it finishes.`,
        })
      } else if (leg.tight && leg.estimate) {
        out.push({
          id: `tight-${leg.to.id}`,
          level: 'warn',
          day,
          text: `Only ${leg.gapMin}m to reach ${leg.to.name} — about ${leg.estimate.transitMin}m by MRT. Taxi, or shift it later.`,
        })
      }
    }

    for (const it of items) {
      const min = it.minRecommendedMin ?? PLACE_BY_ID.get(it.placeId ?? '')?.minRecommendedMin
      if (min && it.durationMin < min) {
        out.push({
          id: `short-${it.id}`,
          level: 'warn',
          day,
          text: `${it.name} is down for ${Math.round(it.durationMin / 60)}h — most people need at least ${Math.round(min / 60)}h.`,
        })
      }
    }
  }

  const nightSafari = all.some((i) => i.placeId === 'night-safari')
  if (!nightSafari) {
    out.push({
      id: 'no-night-safari',
      level: 'info',
      text: 'Night Safari is not on the plan yet — it needs an evening slot, and it is out at Mandai.',
    })
  }

  if (!stay?.coords) {
    out.push({
      id: 'no-stay',
      level: 'info',
      text: 'No stay location set. Everything still works — you just will not get travel times from the guest house.',
    })
  }

  return out
}
