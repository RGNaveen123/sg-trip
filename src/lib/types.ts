export type LatLng = { lat: number; lng: number }
export type Coords = LatLng | null

export type PlaceCategory =
  | 'sights' | 'nature' | 'hawker' | 'restaurant' | 'shopping' | 'nightlife' | 'transit'

export interface Place {
  id: string
  name: string
  area: string
  category: PlaceCategory
  coords: LatLng
  /** Wikipedia article title, for the free photo + summary lookup. */
  wiki?: string
  blurb: string
  /** Sensible visit length in minutes. */
  typicalMin: number
  /** Flagged when a place really needs more time than people expect. */
  minRecommendedMin?: number
  tags?: string[]
  custom?: boolean
  /** How a custom place's coordinates were obtained. */
  source?: 'url' | 'proxy' | 'geocode' | 'ai' | 'manual'
}

export interface ItineraryItem {
  id: string
  day: number
  /** "HH:MM", 24h. */
  start: string
  durationMin: number
  name: string
  placeId?: string
  coords: Coords
  notes?: string
  category?: PlaceCategory
  /** System block: cannot be deleted, moved or edited by user or AI. */
  locked?: boolean
  minRecommendedMin?: number
  /** Day-of tracking. */
  arrivedAt?: number
  doneAt?: number
}

export interface Stay {
  name: string
  coords: Coords
  area: string | null
  rawInput: string
}

export type ExpenseCategory = 'transport' | 'food' | 'shopping' | 'attractions' | 'misc'
export type ExpenseFor = 'personal' | 'split' | 'onbehalf'

export interface Expense {
  id: string
  amount: number
  category: ExpenseCategory
  label: string
  /** "YYYY-MM-DD" */
  date: string
  forWhom: ExpenseFor
  /** Equal split across N people. */
  splitCount?: number
  /** Custom split: individual shares. */
  shares?: { name: string; amount: number }[]
  createdAt: number
}

export interface TripSetup {
  /** Local departure from Kochi. */
  outboundISO: string
  /** Arrival in Singapore. */
  arriveISO: string
  /** Departure from Singapore. */
  departISO: string
  homeCurrency: string
  pace: 'relaxed' | 'balanced' | 'packed'
}

export interface PackingItem {
  id: string
  text: string
  packed: boolean
  /** Linked to a scheduled activity, e.g. "uss". */
  reason?: string
  who?: string
}

export interface CustodyItem {
  id: string
  what: string
  who: string
  note?: string
  updatedAt: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: number
  /** Pending, validated trip edits proposed by the model. */
  proposal?: Proposal
  error?: boolean
}

export type TripAction =
  | { op: 'add'; day: number; start: string; durationMin: number; name: string; placeId?: string; notes?: string }
  | { op: 'move'; id: string; day?: number; start?: string; durationMin?: number }
  | { op: 'remove'; id: string }

export interface ValidatedAction {
  action: TripAction
  ok: boolean
  reason?: string
  /** Human summary of what this does. */
  summary: string
}

export interface Proposal {
  id: string
  actions: ValidatedAction[]
  applied: boolean
  dismissed?: boolean
  source: 'chat' | 'autoplan'
}

export type CostTier = 'text' | 'vision' | 'search'
