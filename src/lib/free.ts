/**
 * Everything in this file is a free, keyless public API. Nothing here costs
 * money or touches the Anthropic key. If a lookup fails we degrade quietly —
 * none of it is load-bearing.
 */
import type { LatLng } from './types'
import { isNearSingapore, parseCoordsFromUrl } from './geo'

// ---------------------------------------------------------------- Wikipedia

export interface WikiResult {
  extract: string
  photo: string | null
}

/** One call gets both the summary and a usable photo. */
export async function wikiSummary(title: string): Promise<WikiResult | null> {
  try {
    const r = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { Accept: 'application/json' } },
    )
    if (!r.ok) return null
    const j = await r.json()
    if (j.type === 'disambiguation') return null
    return {
      extract: j.extract || '',
      photo: j.thumbnail?.source
        ? String(j.thumbnail.source).replace(/\/\d+px-/, '/640px-')
        : j.originalimage?.source ?? null,
    }
  } catch {
    return null
  }
}

// ------------------------------------------------------------ Exchange rate

export interface RateResult {
  rate: number
  asOf: string
}

/** open.er-api.com: free, no key, updated daily. */
export async function fetchRate(base: string, quote: string): Promise<RateResult | null> {
  try {
    const r = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`)
    if (!r.ok) return null
    const j = await r.json()
    const rate = j?.rates?.[quote]
    if (typeof rate !== 'number') return null
    return { rate, asOf: (j.time_last_update_utc as string)?.slice(5, 16) ?? 'today' }
  } catch {
    return null
  }
}

// ----------------------------------------------------------------- Weather

export interface DayWeather {
  date: string
  maxC: number
  minC: number
  rainMm: number
  rainChance: number
  code: number
}

/** open-meteo: free, no key, 16-day forecast. */
export async function fetchForecast(c: LatLng): Promise<DayWeather[] | null> {
  try {
    const u = new URL('https://api.open-meteo.com/v1/forecast')
    u.searchParams.set('latitude', String(c.lat))
    u.searchParams.set('longitude', String(c.lng))
    u.searchParams.set(
      'daily',
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
    )
    u.searchParams.set('timezone', 'Asia/Singapore')
    u.searchParams.set('forecast_days', '16')
    const r = await fetch(u.toString())
    if (!r.ok) return null
    const j = await r.json()
    const d = j.daily
    if (!d?.time) return null
    return d.time.map((date: string, i: number) => ({
      date,
      maxC: d.temperature_2m_max[i],
      minC: d.temperature_2m_min[i],
      rainMm: d.precipitation_sum[i],
      rainChance: d.precipitation_probability_max?.[i] ?? 0,
      code: d.weather_code[i],
    }))
  } catch {
    return null
  }
}

export function weatherWord(code: number): string {
  if (code === 0) return 'Clear'
  if (code <= 3) return 'Cloudy'
  if (code <= 48) return 'Hazy'
  if (code <= 67) return 'Rain'
  if (code <= 82) return 'Showers'
  if (code <= 99) return 'Thunderstorms'
  return 'Mixed'
}

// ---------------------------------------------------------------- Geocoding

export interface GeocodeHit {
  name: string
  coords: LatLng
  kind: string
  /** Full street address, when the source knows one. */
  address?: string
  /** Singapore six-digit postal code. */
  postal?: string
  source: 'onemap' | 'photon' | 'osm'
}

/** A Singapore postal code identifies exactly one building. */
export const isPostalCode = (q: string): boolean => /^\s*\d{6}\s*$/.test(q)

/**
 * OneMap is the Singapore Land Authority's own gazetteer. It is free, needs no
 * key, and knows every building, hawker centre, HDB block and postal code in
 * the country — which generic geocoders emphatically do not. It is the right
 * first stop for anywhere in Singapore.
 */
export async function searchOneMap(query: string): Promise<GeocodeHit[]> {
  const q = query.trim()
  if (!q) return []
  try {
    const u = new URL('https://www.onemap.gov.sg/api/common/elastic/search')
    u.searchParams.set('searchVal', q)
    u.searchParams.set('returnGeom', 'Y')
    u.searchParams.set('getAddrDetails', 'Y')
    u.searchParams.set('pageNum', '1')
    const r = await fetch(u.toString())
    if (!r.ok) return []
    const j = await r.json()
    return (j.results ?? [])
      .filter((h: Record<string, string>) => h.LATITUDE && h.LONGITUDE)
      .slice(0, 8)
      .map((h: Record<string, string>) => ({
        name: titleCase(h.SEARCHVAL || h.BUILDING || h.ROAD_NAME || q),
        coords: { lat: parseFloat(h.LATITUDE), lng: parseFloat(h.LONGITUDE) },
        kind: h.BUILDING && h.BUILDING !== 'NIL' ? 'building' : 'address',
        address: titleCase(h.ADDRESS || ''),
        postal: h.POSTAL && h.POSTAL !== 'NIL' ? h.POSTAL : undefined,
        source: 'onemap' as const,
      }))
  } catch {
    return []
  }
}

/** Words that read wrong capitalised in the middle of an address. */
const LOWER_WORDS = new Set(['and', 'at', 'of', 'the'])

/** OneMap shouts. Nobody wants MAXWELL FOOD CENTRE in their itinerary. */
function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i) => {
      if (!w) return w
      if (i > 0 && LOWER_WORDS.has(w)) return w
      return w[0].toUpperCase() + w.slice(1)
    })
    .join(' ')
}

/** Photon: keyless OSM search, better than Nominatim at partial names. */
export async function searchPhoton(query: string): Promise<GeocodeHit[]> {
  try {
    const u = new URL('https://photon.komoot.io/api/')
    u.searchParams.set('q', query)
    u.searchParams.set('limit', '6')
    u.searchParams.set('lang', 'en')
    // Bias hard towards Singapore rather than matching a namesake abroad.
    u.searchParams.set('bbox', '103.59,1.15,104.10,1.48')
    const r = await fetch(u.toString())
    if (!r.ok) return []
    const j = await r.json()
    return (j.features ?? [])
      .filter((f: { geometry?: { coordinates?: number[] } }) => f.geometry?.coordinates?.length === 2)
      .map((f: { geometry: { coordinates: number[] }; properties: Record<string, string> }) => ({
        name: f.properties.name || f.properties.street || query,
        coords: { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] },
        kind: f.properties.osm_value || 'place',
        address: [f.properties.street, f.properties.district, f.properties.city]
          .filter(Boolean)
          .join(', '),
        postal: f.properties.postcode,
        source: 'photon' as const,
      }))
      .filter((h: GeocodeHit) => isNearSingapore(h.coords))
  } catch {
    return []
  }
}

/**
 * Everything in one call, best source first. Nothing here costs money or
 * needs a key, so there is no reason not to try all three.
 */
export async function findPlace(query: string): Promise<GeocodeHit[]> {
  const q = query.trim()
  if (!q) return []

  const onemap = await searchOneMap(q)
  if (onemap.length) return onemap

  const photon = await searchPhoton(q)
  if (photon.length) return photon

  return geocode(`${q}, Singapore`)
}

/** Nominatim: free, keyless, rate-limited to about one call a second. */
export async function geocode(query: string): Promise<GeocodeHit[]> {
  try {
    const u = new URL('https://nominatim.openstreetmap.org/search')
    u.searchParams.set('format', 'jsonv2')
    u.searchParams.set('q', query)
    u.searchParams.set('countrycodes', 'sg')
    u.searchParams.set('limit', '5')
    u.searchParams.set('addressdetails', '0')
    const r = await fetch(u.toString(), { headers: { Accept: 'application/json' } })
    if (!r.ok) return []
    const j = (await r.json()) as Array<Record<string, string>>
    return j.map((h) => ({
      name: h.display_name,
      coords: { lat: parseFloat(h.lat), lng: parseFloat(h.lon) },
      kind: h.type || h.category || 'place',
      source: 'osm' as const,
    }))
  } catch {
    return []
  }
}

// -------------------------------------------------- Shortened Maps links
//
// A maps.app.goo.gl link contains no coordinates at all — only the server that
// issued it knows where it points, and the browser cannot read a cross-origin
// redirect. So: try to have a public CORS proxy follow the redirect for us and
// scrape the coordinates out of what comes back. This is best-effort by
// nature; when it fails the UI falls back to name search, then to AI.

const PROXIES = [
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
]

export async function resolveShortLink(url: string): Promise<LatLng | null> {
  for (const wrap of PROXIES) {
    try {
      const r = await fetch(wrap(url), { redirect: 'follow' })
      if (!r.ok) continue
      const body = await r.text()

      // The redirect target often shows up verbatim in the HTML.
      const direct = parseCoordsFromUrl(body.slice(0, 200000))
      if (direct && isNearSingapore(direct)) return direct

      const meta = body.match(/<meta[^>]+content="[^"]*?[?&]center=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i)
      if (meta) {
        const c = { lat: parseFloat(meta[1]), lng: parseFloat(meta[2]) }
        if (isNearSingapore(c)) return c
      }
    } catch {
      /* try the next proxy */
    }
  }
  return null
}

/** Last free resort: pull a place name out of the URL and geocode that. */
export function nameFromMapsUrl(url: string): string | null {
  const m = url.match(/\/maps\/place\/([^/@?]+)/)
  if (m) return decodeURIComponent(m[1].replace(/\+/g, ' '))
  const q = url.match(/[?&](?:q|query)=([^&]+)/)
  if (q && !/^-?\d+\.\d+/.test(decodeURIComponent(q[1]))) {
    return decodeURIComponent(q[1].replace(/\+/g, ' '))
  }
  return null
}
