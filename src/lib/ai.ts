import type { CostTier, ItineraryItem, Place, Stay, TripAction, TripSetup, ValidatedAction } from './types'
import { PLACES } from '../data/places'
import { dateForDay, dayCount, formatDayLabel, endOf } from './trip'
import { formatDuration, isValidTime, toMinutes } from './geo'

/**
 * One model, the cheapest one, for everything. This is deliberate and the
 * user has asked for it repeatedly — do not quietly upgrade it.
 */
export const MODEL = 'claude-haiku-4-5-20251001'

/** Haiku 4.5 list price, USD per million tokens. */
const PRICE_IN = 1.0
const PRICE_OUT = 5.0
/** Server-side web search, USD per search. */
const PRICE_SEARCH = 0.01

export const TIER_LABEL: Record<CostTier, { name: string; note: string; rough: string }> = {
  text: { name: 'Text', note: 'Cheapest tier — plain text in, text out.', rough: '~$0.001–0.01' },
  vision: { name: 'Vision', note: 'Sends an image. Costs more than text.', rough: '~$0.01–0.03' },
  search: { name: 'Web search', note: 'Billed per search on top of tokens.', rough: '~$0.01–0.03' },
}

export class AiError extends Error {}
export class BudgetDeclined extends Error {
  constructor() {
    super('Cancelled at the AI budget check.')
  }
}

// --- budget gate -----------------------------------------------------------
// The UI registers a confirmer; ai.ts stays free of React.

type Confirmer = (info: { calls: number; budget: number; tier: CostTier }) => Promise<boolean>
let confirmer: Confirmer | null = null
export function setBudgetConfirmer(fn: Confirmer | null) {
  confirmer = fn
}

interface CallCtx {
  apiKey: string
  calls: number
  budget: number
  onSpend: (usd: number) => void
}

export interface AiCallOptions {
  system: string
  messages: { role: 'user' | 'assistant'; content: unknown }[]
  maxTokens?: number
  tier: CostTier
  webSearch?: boolean
}

export interface AiReply {
  text: string
  costUsd: number
  searches: number
}

export async function aiCall(ctx: CallCtx, opts: AiCallOptions): Promise<AiReply> {
  if (!ctx.apiKey) throw new AiError('No API key set. Add one in Settings — it stays on this phone.')

  if (ctx.calls >= ctx.budget && confirmer) {
    const ok = await confirmer({ calls: ctx.calls, budget: ctx.budget, tier: opts.tier })
    if (!ok) throw new BudgetDeclined()
  }

  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1400,
    system: opts.system,
    messages: opts.messages,
  }
  if (opts.webSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }]
  }

  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ctx.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AiError('Could not reach the API. Check your connection.')
  }

  if (!res.ok) {
    let detail = ''
    try {
      const j = await res.json()
      detail = j?.error?.message ?? ''
    } catch {
      /* ignore */
    }
    if (res.status === 401) throw new AiError('API key rejected. Check it in Settings.')
    if (res.status === 429) throw new AiError('Rate limited by the API. Wait a moment and retry.')
    throw new AiError(`API error ${res.status}${detail ? `: ${detail}` : ''}`)
  }

  const j = await res.json()
  const text: string = (j.content ?? [])
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text)
    .join('\n')
    .trim()

  const inTok = (j.usage?.input_tokens ?? 0) + (j.usage?.cache_read_input_tokens ?? 0)
  const outTok = j.usage?.output_tokens ?? 0
  const searches = j.usage?.server_tool_use?.web_search_requests ?? 0
  const costUsd =
    (inTok / 1e6) * PRICE_IN + (outTok / 1e6) * PRICE_OUT + searches * PRICE_SEARCH

  ctx.onSpend(costUsd)
  return { text, costUsd, searches }
}

// --- trip context ----------------------------------------------------------

export interface TripContext {
  setup: TripSetup
  stay: Stay | null
  all: ItineraryItem[]
  customPlaces: Place[]
}

export function tripStateBlock(c: TripContext): string {
  const days = dayCount(c.setup)
  const lines: string[] = []
  lines.push(
    `TRIP: Kochi -> Singapore, Singapore Airlines. Land ${c.setup.arriveISO.replace('T', ' ')}, fly home ${c.setup.departISO.replace('T', ' ')}. ${days} days on the ground.`,
  )
  lines.push(
    `STAY: ${c.stay?.name ? `${c.stay.name}${c.stay.area ? ` (${c.stay.area})` : ''}` : 'not set'} — a relative's guest house, NOT a hotel. Never call it a hotel.`,
  )
  lines.push(`PACE: ${c.setup.pace}. Budget-conscious: MRT and bus by default, taxi only for genuinely tight transitions.`)
  lines.push('')
  lines.push('CURRENT ITINERARY (id | day | start | duration | name). LOCKED rows cannot be moved or removed:')
  for (let d = 1; d <= days; d++) {
    const date = dateForDay(c.setup, d)
    const { dow, dm } = formatDayLabel(date)
    lines.push(`  Day ${d} — ${dow} ${dm}`)
    const items = c.all
      .filter((i) => i.day === d)
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
    if (!items.length) lines.push('    (nothing scheduled)')
    for (const i of items) {
      lines.push(
        `    ${i.locked ? 'LOCKED' : i.id} | ${i.start}-${endOf(i)} | ${formatDuration(i.durationMin)} | ${i.name}`,
      )
    }
  }
  lines.push('')
  lines.push('PLACE CATALOGUE (placeId | name | area | typical minutes):')
  for (const p of [...PLACES, ...c.customPlaces]) {
    if (p.category === 'transit') continue
    lines.push(`  ${p.id} | ${p.name} | ${p.area} | ${p.typicalMin}`)
  }
  return lines.join('\n')
}

export const ACTION_PROTOCOL = `
When — and only when — the user asks you to change the plan, end your reply with one fenced code block tagged trip-actions containing JSON:

\`\`\`trip-actions
{"actions":[
  {"op":"add","day":3,"start":"14:00","durationMin":90,"name":"Gardens by the Bay","placeId":"gardens-bay"},
  {"op":"move","id":"a1b2c3","day":4,"start":"10:30","durationMin":120},
  {"op":"remove","id":"a1b2c3"}
]}
\`\`\`

Rules for that block:
- Use placeId from the catalogue whenever the stop is a catalogue place; the app fills in coordinates from it.
- "id" for move/remove must be an id printed in the itinerary above. Rows printed as LOCKED have no id and must never be touched.
- day is 1-based and must be within the trip. start is 24-hour "HH:MM".
- Do not invent ids. Do not include the block at all if you are only answering a question.
- Keep the prose above the block short and specific: say what you changed and why, in one or two sentences.
`.trim()

export function systemPrompt(c: TripContext): string {
  return [
    'You are the trip assistant inside a Singapore trip-planner app used by three siblings on the ground in Singapore.',
    'Answer briefly and practically. Assume phone screen, walking, humidity, and a real budget.',
    'Prefer MRT and bus. Flag a taxi only when a connection is genuinely too tight or trains have stopped.',
    'The accommodation is a free guest house at a relative\'s place. It is never a hotel.',
    'Use Markdown: short paragraphs, bullets, and small tables where a table genuinely helps.',
    '',
    tripStateBlock(c),
    '',
    ACTION_PROTOCOL,
  ].join('\n')
}

// --- action parsing and validation -----------------------------------------

export function extractActions(text: string): { prose: string; raw: unknown[] } {
  const m = text.match(/```trip-actions\s*([\s\S]*?)```/)
  if (!m) return { prose: text.trim(), raw: [] }
  const prose = text.replace(m[0], '').trim()
  try {
    const parsed = JSON.parse(m[1].trim())
    const arr = Array.isArray(parsed) ? parsed : parsed?.actions
    return { prose, raw: Array.isArray(arr) ? arr : [] }
  } catch {
    return { prose, raw: [] }
  }
}

const PLACE_BY_ID = new Map(PLACES.map((p) => [p.id, p]))

/**
 * Never trust the model's edits. Every action is checked against the itinerary
 * as it actually is right now, and anything that does not check out is
 * rejected with a reason the user can read.
 */
export function validateActions(
  raw: unknown[],
  ctx: { setup: TripSetup; all: ItineraryItem[]; customPlaces: Place[] },
): ValidatedAction[] {
  const days = dayCount(ctx.setup)
  const editable = new Map(ctx.all.filter((i) => !i.locked).map((i) => [i.id, i]))
  const lockedIds = new Set(ctx.all.filter((i) => i.locked).map((i) => i.id))
  const catalogue = new Map([
    ...PLACE_BY_ID,
    ...ctx.customPlaces.map((p) => [p.id, p] as [string, Place]),
  ])
  const out: ValidatedAction[] = []

  const reject = (action: TripAction, reason: string, summary: string) =>
    out.push({ action, ok: false, reason, summary })

  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const a = r as Record<string, unknown>
    const op = a.op

    if (op === 'add') {
      const name = typeof a.name === 'string' ? a.name.trim() : ''
      const placeId = typeof a.placeId === 'string' ? a.placeId : undefined
      const place = placeId ? catalogue.get(placeId) : undefined
      const label = name || place?.name || 'Untitled stop'
      const day = Number(a.day)
      const start = a.start
      const durationMin = Math.round(Number(a.durationMin))
      const action: TripAction = {
        op: 'add',
        day,
        start: String(start),
        durationMin,
        name: label,
        placeId,
        notes: typeof a.notes === 'string' ? a.notes : undefined,
      }
      const summary = `Add ${label} — day ${day || '?'} at ${start ?? '?'} for ${
        isFinite(durationMin) ? formatDuration(durationMin) : '?'
      }`

      if (!label) { reject(action, 'No name given.', summary); continue }
      if (!Number.isInteger(day) || day < 1 || day > days) {
        reject(action, `Day ${a.day} is outside the ${days}-day trip.`, summary); continue
      }
      if (!isValidTime(start)) { reject(action, `"${String(start)}" is not a valid HH:MM time.`, summary); continue }
      if (!isFinite(durationMin) || durationMin < 15 || durationMin > 720) {
        reject(action, 'Duration must be between 15 minutes and 12 hours.', summary); continue
      }
      if (toMinutes(String(start)) + durationMin > 1440) {
        reject(action, 'That stop would run past midnight.', summary); continue
      }
      if (placeId && !place) { reject(action, `No place called "${placeId}" in the catalogue.`, summary); continue }
      out.push({ action, ok: true, summary })
      continue
    }

    if (op === 'move') {
      const id = String(a.id ?? '')
      const target = editable.get(id)
      const day = a.day === undefined ? undefined : Number(a.day)
      const start = a.start === undefined ? undefined : String(a.start)
      const durationMin = a.durationMin === undefined ? undefined : Math.round(Number(a.durationMin))
      const action: TripAction = { op: 'move', id, day, start, durationMin }
      const summary = target
        ? `Move ${target.name} → ${day ? `day ${day}` : `day ${target.day}`} at ${start ?? target.start}${
            durationMin ? `, ${formatDuration(durationMin)}` : ''
          }`
        : `Move ${id}`

      if (lockedIds.has(id)) { reject(action, 'That is a fixed block — flights, Universal or the concert. It cannot be moved.', summary); continue }
      if (!target) { reject(action, `No editable stop with id ${id}.`, summary); continue }
      if (day !== undefined && (!Number.isInteger(day) || day < 1 || day > days)) {
        reject(action, `Day ${a.day} is outside the ${days}-day trip.`, summary); continue
      }
      if (start !== undefined && !isValidTime(start)) {
        reject(action, `"${start}" is not a valid HH:MM time.`, summary); continue
      }
      if (durationMin !== undefined && (!isFinite(durationMin) || durationMin < 15 || durationMin > 720)) {
        reject(action, 'Duration must be between 15 minutes and 12 hours.', summary); continue
      }
      out.push({ action, ok: true, summary })
      continue
    }

    if (op === 'remove') {
      const id = String(a.id ?? '')
      const target = editable.get(id)
      const action: TripAction = { op: 'remove', id }
      const summary = target ? `Remove ${target.name} (day ${target.day})` : `Remove ${id}`
      if (lockedIds.has(id)) { reject(action, 'That is a fixed block and cannot be removed.', summary); continue }
      if (!target) { reject(action, `No editable stop with id ${id}.`, summary); continue }
      out.push({ action, ok: true, summary })
      continue
    }
  }

  return out
}

/** Apply only the actions that passed validation, to a copy of the list. */
export function applyActions(
  items: ItineraryItem[],
  actions: ValidatedAction[],
  customPlaces: Place[],
): ItineraryItem[] {
  const catalogue = new Map([
    ...PLACE_BY_ID,
    ...customPlaces.map((p) => [p.id, p] as [string, Place]),
  ])
  let next = [...items]
  for (const v of actions) {
    if (!v.ok) continue
    const a = v.action
    if (a.op === 'add') {
      const place = a.placeId ? catalogue.get(a.placeId) : undefined
      next.push({
        id: Math.random().toString(36).slice(2, 10),
        day: a.day,
        start: a.start,
        durationMin: a.durationMin,
        name: a.name,
        placeId: a.placeId,
        coords: place?.coords ?? null,
        notes: a.notes,
        category: place?.category,
        minRecommendedMin: place?.minRecommendedMin,
      })
    } else if (a.op === 'move') {
      next = next.map((i) =>
        i.id === a.id
          ? {
              ...i,
              day: a.day ?? i.day,
              start: a.start ?? i.start,
              durationMin: a.durationMin ?? i.durationMin,
            }
          : i,
      )
    } else if (a.op === 'remove') {
      next = next.filter((i) => i.id !== a.id)
    }
  }
  return next
}

// --- auto-plan -------------------------------------------------------------

export function autoPlanPrompt(c: TripContext): string {
  const days = dayCount(c.setup)
  const dayList = Array.from({ length: days }, (_, i) => {
    const d = dateForDay(c.setup, i + 1)
    const { dow, dm } = formatDayLabel(d)
    return `day ${i + 1} = ${dow} ${dm}`
  }).join(', ')

  return [
    `Fill every open gap in this ${days}-day plan (${dayList}) with a sensible day-by-day itinerary.`,
    '',
    'Requirements:',
    '- Work around the LOCKED blocks; never move or duplicate them.',
    '- Night Safari must get an evening slot on a day that is not the Universal day or the concert day. It is out at Mandai, so allow real travel time and do not stack anything after it.',
    '- Group each day geographically. Do not bounce across the island twice in a day.',
    '- Two meals a day from the catalogue: hawker centres by default, one or two sit-down restaurants across the whole trip.',
    '- Day 1 starts tired off a red-eye. Keep the first afternoon light and near the stay.',
    '- The Universal day already runs to about 19:00 — only an easy dinner after it, close to Sentosa or the stay.',
    '- The concert day: nothing scheduled after the concert block, and keep the afternoon before it near Kallang.',
    '- The last day must end well before the airport block. Nothing far from Changi that morning.',
    '- Respect typical durations from the catalogue. Do not under-schedule the big parks.',
    '',
    'Reply with two or three sentences describing the shape of the plan, then the trip-actions block with every stop as an "add" action. Do not remove or move anything that already exists.',
  ].join('\n')
}

// --- receipt vision --------------------------------------------------------

export const RECEIPT_SYSTEM = [
  'You read a photo of a receipt or bill from Singapore and return structured data.',
  'Reply with nothing but a JSON object:',
  '{"amount": number, "currency": "SGD", "vendor": "string", "category": "transport|food|shopping|attractions|misc", "date": "YYYY-MM-DD or null"}',
  'amount is the final total actually paid, including GST and service charge. If you cannot read the total, use null.',
].join('\n')

export interface ReceiptDraft {
  amount: number | null
  currency: string
  vendor: string
  category: string
  date: string | null
}

export function parseReceiptReply(text: string): ReceiptDraft | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const j = JSON.parse(m[0])
    return {
      amount: typeof j.amount === 'number' ? j.amount : null,
      currency: typeof j.currency === 'string' ? j.currency : 'SGD',
      vendor: typeof j.vendor === 'string' ? j.vendor : '',
      category: ['transport', 'food', 'shopping', 'attractions', 'misc'].includes(j.category)
        ? j.category
        : 'misc',
      date: typeof j.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.date) ? j.date : null,
    }
  } catch {
    return null
  }
}

// --- find a place by name (web search) -------------------------------------

export const FIND_PLACE_SYSTEM = [
  'You locate a specific place in Singapore and return its coordinates.',
  'Search the web if you are not certain. Reply with nothing but JSON:',
  '{"name": "official name", "lat": number, "lng": number, "area": "neighbourhood", "confident": true|false}',
  'If you cannot find it with reasonable confidence, set confident to false and lat/lng to null.',
].join('\n')

export function parseFindPlaceReply(text: string): { name: string; lat: number; lng: number; area: string } | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const j = JSON.parse(m[0])
    if (!j.confident || typeof j.lat !== 'number' || typeof j.lng !== 'number') return null
    return { name: String(j.name ?? ''), lat: j.lat, lng: j.lng, area: String(j.area ?? '') }
  } catch {
    return null
  }
}

/** Keeps multi-turn memory useful without letting the token bill grow forever. */
export function windowedHistory(
  chat: { role: 'user' | 'assistant'; content: string }[],
  maxTurns = 8,
): { role: 'user' | 'assistant'; content: string }[] {
  const trimmed = chat.slice(-maxTurns * 2)
  // The API rejects a leading assistant message.
  while (trimmed.length && trimmed[0].role === 'assistant') trimmed.shift()
  return trimmed.map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
}
