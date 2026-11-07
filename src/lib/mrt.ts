import { LINES, STATIONS } from '../data/mrt'
import { estimateTravel, haversineKm, type TravelEstimate } from './geo'
import type { LatLng } from './types'

/**
 * Door-to-door MRT routing on a small static graph. No network, no keys —
 * good enough to say "Yishun → Orchard, 9 stops, no change, about 40 min"
 * and to order a plan by how far each place really is by train. Live
 * timings come from Google Maps or Citymapper once you tap through.
 */

/** Walking speed with crossings and covered-walkway detours, km per minute. */
const WALK_KM_PER_MIN = 4.3 / 60
/** Detour factor from a straight line to the footpath. */
const WALK_DETOUR = 1.3
/** Do not offer a station further than this on foot — take a bus instead. */
const MAX_WALK_MIN = 22
/** Average wait for the first train, peak and off-peak blended. */
const FIRST_WAIT_MIN = 4
/** Walking between platforms at an interchange plus the next wait. */
const TRANSFER_MIN = 6

const walkMin = (a: LatLng, b: LatLng) =>
  Math.round((haversineKm(a, b) * WALK_DETOUR) / WALK_KM_PER_MIN)

/** Running time between neighbouring stations, including the dwell. */
const hopMin = (km: number) => 0.9 + km * 1.1

export interface Station {
  name: string
  /** Every code the station carries, e.g. ["NS24", "NE6", "CC1"]. */
  codes: string[]
  coords: LatLng
}

const codesByName = new Map<string, string[]>()
for (const l of LINES) {
  for (const [code, name] of l.stops) {
    if (!code) continue
    const list = codesByName.get(name) ?? []
    if (!list.includes(code)) list.push(code)
    codesByName.set(name, list)
  }
}

export const ALL_STATIONS: Station[] = Object.entries(STATIONS).map(([name, coords]) => ({
  name,
  codes: codesByName.get(name) ?? [],
  coords,
}))

const STATION_BY_NAME = new Map(ALL_STATIONS.map((s) => [s.name, s]))
const LINE_BY_ID = new Map(LINES.map((l) => [l.id, l]))

/** "Yishun NS13 → Orchard NS22" style code for the line actually ridden. */
const codeOn = (s: Station, line: string) =>
  s.codes.find((c) => c.startsWith(line)) ?? s.codes[0] ?? ''

/** "Yishun (NS13)", "Dhoby Ghaut (NS24/NE6/CC1)". */
export const stationLabel = (s: Station) =>
  s.codes.length ? `${s.name} (${s.codes.join('/')})` : s.name

export function nearestStations(c: LatLng, n = 3): { station: Station; walkMin: number }[] {
  return ALL_STATIONS.map((station) => ({ station, walkMin: walkMin(c, station.coords) }))
    .sort((a, b) => a.walkMin - b.walkMin)
    .slice(0, n)
}

/**
 * Places no MRT station reaches on foot, but a dedicated shuttle runs from
 * one. Treated as a longer "walk" between the station and the place.
 */
interface Feeder {
  name: string
  station: string
  /** Somewhere inside the served area, and how far from it still counts. */
  centre: LatLng
  radiusKm: number
  /** Where the shuttle sets you down; you walk the rest. */
  drops: LatLng[]
  /** Wait plus ride, one way. */
  minutes: number
}

const FEEDERS: Feeder[] = [
  {
    // Mandai Khatib Shuttle: Khatib MRT to the Zoo / River Wonders / Night
    // Safari entrance, with a stop at Bird Paradise.
    name: 'Mandai Khatib Shuttle',
    station: 'Khatib',
    centre: { lat: 1.402, lng: 103.791 },
    radiusKm: 1.6,
    drops: [
      { lat: 1.4043, lng: 103.7918 },
      { lat: 1.3965, lng: 103.7895 },
    ],
    minutes: 25,
  },
  {
    // Sentosa Express from VivoCity, next to HarbourFront MRT.
    name: 'Sentosa Express',
    station: 'HarbourFront',
    centre: { lat: 1.2515, lng: 103.8215 },
    radiusKm: 2.2,
    drops: [
      { lat: 1.2557, lng: 103.8214 }, // Resorts World
      { lat: 1.25515, lng: 103.81669 }, // Imbiah
      { lat: 1.2516, lng: 103.81862 }, // Beach
    ],
    minutes: 15,
  },
]

interface Access {
  station: Station
  walkMin: number
  feeder?: string
}

/** Ways to get between a point and the network: walk, or a shuttle. */
function accessFor(c: LatLng): Access[] {
  const out: Access[] = nearestStations(c, 3).filter((s) => s.walkMin <= MAX_WALK_MIN)
  for (const f of FEEDERS) {
    if (haversineKm(c, f.centre) > f.radiusKm) continue
    const lastLeg = Math.min(...f.drops.map((d) => walkMin(c, d)))
    out.push({ station: STATION_BY_NAME.get(f.station)!, walkMin: f.minutes + lastLeg, feeder: f.name })
  }
  return out
}

// ---------------------------------------------------------------- graph

/** Node = a station on a particular line, so changing lines can cost time. */
type Node = string // `${line}|${station}`
interface Edge {
  to: Node
  min: number
}

const graph = new Map<Node, Edge[]>()
const addEdge = (a: Node, b: Node, min: number) => {
  const list = graph.get(a) ?? []
  list.push({ to: b, min })
  graph.set(a, list)
}

for (const l of LINES) {
  for (let i = 1; i < l.stops.length; i++) {
    const a = l.stops[i - 1][1]
    const b = l.stops[i][1]
    const min = hopMin(haversineKm(STATIONS[a], STATIONS[b]))
    addEdge(`${l.id}|${a}`, `${l.id}|${b}`, min)
    addEdge(`${l.id}|${b}`, `${l.id}|${a}`, min)
  }
}
// Interchanges: every pair of lines through the same station.
const linesAt = new Map<string, string[]>()
for (const l of LINES) {
  for (const [, name] of l.stops) {
    const list = linesAt.get(name) ?? []
    if (!list.includes(l.id)) list.push(l.id)
    linesAt.set(name, list)
  }
}
/**
 * Circle Line trains from Marina Bay carry on round the main line, so that is
 * no real change. The airport branch is: you do get off at Tanah Merah.
 */
const SAME_TRAIN = new Set(['CC|CE', 'CE|CC'])
for (const [name, ids] of linesAt) {
  for (const a of ids) {
    for (const b of ids) {
      if (a === b) continue
      addEdge(`${a}|${name}`, `${b}|${name}`, SAME_TRAIN.has(`${a}|${b}`) ? 2 : TRANSFER_MIN)
    }
  }
}

// ---------------------------------------------------------------- routing

export interface MrtStep {
  line: string
  lineName: string
  colour: string
  from: Station
  to: Station
  stops: number
}

export interface MrtRoute {
  /** Door to door, walking and any shuttle included. */
  minutes: number
  walkToMin: number
  walkFromMin: number
  board: Station
  alight: Station
  steps: MrtStep[]
  /** Real changes of train — a branch continuing on the same train is not one. */
  changes: number
  /** Stations where you actually change trains. */
  changeAt: string[]
  /** Shuttle from the start to the network, e.g. leaving Mandai. */
  feederFrom?: string
  /** Shuttle from the network to the end, e.g. to Sentosa. */
  feederTo?: string
}

/**
 * Best MRT journey between two points, or null when the train is not the
 * sensible answer (too close to bother, or no station within a fair walk).
 */
export function mrtRoute(a: LatLng, b: LatLng): MrtRoute | null {
  const starts = accessFor(a)
  const ends = accessFor(b)
  if (!starts.length || !ends.length) return null

  // Dijkstra from every line at every candidate start station at once.
  const dist = new Map<Node, number>()
  const prev = new Map<Node, Node>()
  const startOf = new Map<Node, Access>()
  const queue: [number, Node][] = []
  for (const s of starts) {
    for (const line of linesAt.get(s.station.name) ?? []) {
      const node = `${line}|${s.station.name}`
      const d = s.walkMin + FIRST_WAIT_MIN
      if (d < (dist.get(node) ?? Infinity)) {
        dist.set(node, d)
        startOf.set(node, s)
        queue.push([d, node])
      }
    }
  }
  const done = new Set<Node>()
  while (queue.length) {
    queue.sort((x, y) => x[0] - y[0])
    const [d, node] = queue.shift()!
    if (done.has(node)) continue
    done.add(node)
    for (const e of graph.get(node) ?? []) {
      const nd = d + e.min
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd)
        prev.set(e.to, node)
        queue.push([nd, e.to])
      }
    }
  }

  let best: { node: Node; total: number; end: Access } | null = null
  for (const e of ends) {
    for (const line of linesAt.get(e.station.name) ?? []) {
      const node = `${line}|${e.station.name}`
      const d = dist.get(node)
      if (d === undefined) continue
      const total = d + e.walkMin
      if (!best || total < best.total) best = { node, total, end: e }
    }
  }
  if (!best) return null

  // Walk back to the start, then collapse into one step per line ridden.
  const path: Node[] = [best.node]
  while (prev.has(path[0])) path.unshift(prev.get(path[0])!)
  const split = (n: Node) => n.split('|') as [string, string]

  const steps: MrtStep[] = []
  for (const node of path) {
    const [line, name] = split(node)
    const last = steps[steps.length - 1]
    if (last && last.line === line) {
      if (last.to.name !== name) {
        last.to = STATION_BY_NAME.get(name)!
        last.stops++
      }
    } else {
      const l = LINE_BY_ID.get(line)!
      steps.push({
        line,
        lineName: l.name,
        colour: l.colour,
        from: STATION_BY_NAME.get(name)!,
        to: STATION_BY_NAME.get(name)!,
        stops: 0,
      })
    }
  }
  const riding = steps.filter((s) => s.stops > 0)
  if (!riding.length) return null

  const changeAt: string[] = []
  for (let i = 1; i < riding.length; i++) {
    if (!SAME_TRAIN.has(`${riding[i - 1].line}|${riding[i].line}`)) changeAt.push(riding[i].from.name)
  }
  const start = startOf.get(path[0])!

  return {
    minutes: Math.round(best.total),
    walkToMin: start.walkMin,
    walkFromMin: best.end.walkMin,
    board: riding[0].from,
    alight: riding[riding.length - 1].to,
    steps: riding,
    changes: changeAt.length,
    changeAt,
    feederFrom: start.feeder,
    feederTo: best.end.feeder,
  }
}

/**
 * One line for a leg:
 * "Yishun NS13 → Khatib NS14 · 1 stop · no change · then Mandai Khatib Shuttle".
 */
export function routeSummary(r: MrtRoute): string {
  const first = r.steps[0]
  const last = r.steps[r.steps.length - 1]
  const stops = r.steps.reduce((n, s) => n + s.stops, 0)
  return [
    r.feederFrom && `${r.feederFrom} first`,
    `${r.board.name} ${codeOn(r.board, first.line)} → ${r.alight.name} ${codeOn(r.alight, last.line)}`.trim(),
    `${stops} stop${stops === 1 ? '' : 's'}`,
    r.changes ? `change at ${r.changeAt.join(', ')}` : 'no change',
    r.feederTo && `then ${r.feederTo}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * The app's travel estimate, with the transit figure taken from a real MRT
 * route whenever there is one. The plan leans on the train on purpose — the
 * stay is out in Yishun and the MRT is how this trip gets anywhere.
 */
export function estimateJourney(a: LatLng, b: LatLng): TravelEstimate {
  const est = estimateTravel(a, b)
  if (est.suggested === 'walk') return est
  const mrt = mrtRoute(a, b)
  if (!mrt) return est
  return { ...est, transitMin: mrt.minutes, mrt }
}
