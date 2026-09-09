import type { LatLng } from './types'

export type TravelMode = 'walk' | 'transit' | 'taxi'

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(la1) * Math.cos(la2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface TravelEstimate {
  km: number
  walkMin: number
  transitMin: number
  taxiMin: number
  /** What we would do by default: cheapest thing that is not silly. */
  suggested: TravelMode
}

/**
 * Rough door-to-door estimates. Straight-line distance with a detour factor,
 * plus fixed overheads for walking to the station, waiting and transfers.
 * Deliberately pessimistic — better to arrive early than miss the show.
 */
export function estimateTravel(a: LatLng, b: LatLng): TravelEstimate {
  const straight = haversineKm(a, b)
  const km = straight * 1.28 // real routes are not straight lines
  const walkMin = Math.round(2 + (km / 4.6) * 60)
  const transitMin = Math.round(10 + km * 2.8)
  const taxiMin = Math.round(5 + km * 1.6)
  const suggested: TravelMode = km <= 1.1 ? 'walk' : 'transit'
  return { km: Math.round(km * 10) / 10, walkMin, transitMin, taxiMin, suggested }
}

export function minutesFor(e: TravelEstimate, mode: TravelMode): number {
  return mode === 'walk' ? e.walkMin : mode === 'taxi' ? e.taxiMin : e.transitMin
}

/** MRT stops running around here; after this a taxi is the honest answer. */
export function isAfterLastTrain(hhmm: string): boolean {
  const m = toMinutes(hhmm)
  return m >= 23 * 60 + 20 || m < 5 * 60 + 30
}

/** Live turn-by-turn with current traffic, in whatever maps app is installed. */
export function directionsUrl(
  from: LatLng | null,
  to: LatLng,
  mode: TravelMode = 'transit',
  toName?: string,
): string {
  const travelmode = mode === 'walk' ? 'walking' : mode === 'taxi' ? 'driving' : 'transit'
  const dest = `${to.lat},${to.lng}`
  const params = new URLSearchParams({
    api: '1',
    destination: dest,
    travelmode,
  })
  if (toName) params.set('destination_place_id', '')
  if (from) params.set('origin', `${from.lat},${from.lng}`)
  const q = params.toString().replace('&destination_place_id=', '')
  return `https://www.google.com/maps/dir/?${q}`
}

export function mapsPlaceUrl(c: LatLng, name?: string): string {
  const q = name ? encodeURIComponent(name) : `${c.lat},${c.lng}`
  return `https://www.google.com/maps/search/?api=1&query=${q}&center=${c.lat},${c.lng}`
}

export function youtubeSearchUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(name + ' Singapore')}`
}

// ---------- time helpers ----------

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function fromMinutes(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function addMinutes(hhmm: string, delta: number): string {
  return fromMinutes(toMinutes(hhmm) + delta)
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function isValidTime(hhmm: unknown): hhmm is string {
  return typeof hhmm === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm)
}

// ---------- coordinate parsing ----------

/**
 * Pull coordinates straight out of a Google Maps URL when they are actually
 * in there. Shortened links (maps.app.goo.gl / goo.gl/maps) never contain
 * coordinates — only the server-side redirect knows where they point — so
 * this returns null for those and the caller must resolve the redirect.
 */
export function parseCoordsFromUrl(raw: string): LatLng | null {
  const s = raw.trim()
  const patterns: RegExp[] = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/, //  /maps/@1.28,103.85,17z
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, //  place data blob
    /[?&]query=(-?\d+\.\d+)%2C(-?\d+\.\d+)/i,
    /[?&](?:q|query|destination|daddr|ll|center|sll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/i,
    /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/, // pasted bare coordinates
  ]
  for (const re of patterns) {
    const m = s.match(re)
    if (m) {
      const lat = parseFloat(m[1])
      const lng = parseFloat(m[2])
      if (isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat, lng }
      }
    }
  }
  return null
}

export function isShortenedMapsLink(raw: string): boolean {
  return /(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs|maps\.google\.[a-z.]+\/(?:url|maps)\?)/i.test(raw)
}

export function looksLikeUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw.trim())
}

/** Rough sanity check — is this pin actually in or near Singapore? */
export function isNearSingapore(c: LatLng): boolean {
  return c.lat > 1.1 && c.lat < 1.55 && c.lng > 103.5 && c.lng < 104.15
}
