import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ChatMessage,
  CustodyItem,
  Expense,
  ItineraryItem,
  PackingItem,
  Place,
  Proposal,
  Stay,
  Ticket,
  TicketKind,
  Pass,
  TripSetup,
} from './types'
import { DEFAULT_ANCHORS, DEFAULT_SETUP, type Anchors } from './trip'
import { STORE_KEY } from './storageKey'

export interface PlaceInfo {
  extract: string
  photo: string | null
  fetchedAt: number
}

export interface FxRate {
  base: string
  quote: string
  rate: number
  fetchedAt: number
  /** Date the provider says the rate is from. */
  asOf: string
}

interface State {
  setup: TripSetup
  anchors: Anchors
  stay: Stay | null
  items: ItineraryItem[]
  customPlaces: Place[]
  expenses: Expense[]
  /** The trip party. The first name is always "you" on this device. */
  people: string[]
  chat: ChatMessage[]
  packing: PackingItem[]
  custody: CustodyItem[]
  tickets: Ticket[]

  apiKey: string
  aiCalls: number
  aiBudget: number
  /** Approximate spend, in USD, accumulated from token usage the API reports. */
  aiSpendUsd: number
  budgetAcknowledgedAt: number

  tracking: boolean
  placeInfo: Record<string, PlaceInfo>
  fx: FxRate | null
  lastUndo: { items: ItineraryItem[]; label: string } | null

  // ---- actions ----
  setSetup: (p: Partial<TripSetup>) => void
  setAnchors: (p: Partial<Anchors>) => void
  setStay: (s: Stay | null) => void

  addItem: (i: Omit<ItineraryItem, 'id'>) => string
  updateItem: (id: string, p: Partial<ItineraryItem>) => void
  removeItem: (id: string) => void
  replaceItems: (items: ItineraryItem[], label: string) => void
  undo: () => void

  addCustomPlace: (p: Place) => void
  removeCustomPlace: (id: string) => void

  setPeople: (names: string[]) => void
  addPerson: (name: string) => void
  removePerson: (name: string) => void
  /** Renames across the roster and every expense that referenced the old name. */
  renamePerson: (from: string, to: string) => void

  addExpense: (e: Omit<Expense, 'id' | 'createdAt'>) => void
  updateExpense: (id: string, p: Partial<Expense>) => void
  removeExpense: (id: string) => void

  pushChat: (m: Omit<ChatMessage, 'id' | 'ts'>) => string
  patchChat: (id: string, p: Partial<ChatMessage>) => void
  clearChat: () => void
  setProposalState: (msgId: string, p: Partial<Proposal>) => void

  togglePacking: (id: string) => void
  addPacking: (text: string, reason?: string) => void
  removePacking: (id: string) => void
  seedPacking: (items: Omit<PackingItem, 'id' | 'packed'>[]) => void

  addTicket: (t: Omit<Ticket, 'id' | 'createdAt' | 'passes'> & { passes?: Pass[] }) => string
  updateTicket: (id: string, p: Partial<Omit<Ticket, 'id' | 'passes'>>) => void
  removeTicket: (id: string) => void
  addPasses: (ticketId: string, passes: Omit<Pass, 'id' | 'addedAt'>[]) => void
  updatePass: (ticketId: string, passId: string, p: Partial<Pick<Pass, 'label'>>) => void
  removePass: (ticketId: string, passId: string) => void

  setCustody: (what: string, who: string, note?: string) => void
  removeCustody: (id: string) => void

  setApiKey: (k: string) => void
  noteAiCall: (costUsd: number) => void
  setAiBudget: (n: number) => void
  acknowledgeBudget: () => void
  resetAiCounter: () => void

  setTracking: (b: boolean) => void
  cachePlaceInfo: (key: string, info: PlaceInfo) => void
  setFx: (f: FxRate) => void
}

const uid = () => Math.random().toString(36).slice(2, 10)

/** Three siblings. Placeholder names, meant to be edited in Settings. */
export const DEFAULT_PEOPLE = ['Me', 'Sibling 1', 'Sibling 2']

export const DEFAULT_PACKING: Omit<PackingItem, 'id' | 'packed'>[] = [
  { text: 'Passport + visa/SG Arrival Card done', reason: 'entry' },
  { text: 'Printed / offline copy of SQ boarding passes', reason: 'entry' },
  { text: 'Concert tickets — screenshot them, stadium wifi is useless', reason: 'concert' },
  { text: 'USS tickets saved offline', reason: 'uss' },
  { text: 'Poncho or cheap rain jacket', reason: 'uss' },
  { text: 'Swimwear + quick-dry shorts', reason: 'uss' },
  { text: 'Dry bag / ziplock for phones on the water rides', reason: 'uss' },
  { text: 'Power bank (charged) + cable', reason: 'daily' },
  { text: 'Type G plug adapter — Singapore uses UK sockets', reason: 'daily' },
  { text: 'Refillable water bottle — tap water is drinkable', reason: 'daily' },
  { text: 'Sunscreen + cap', reason: 'daily' },
  { text: 'Light long sleeves for temples and over-cold malls', reason: 'daily' },
  { text: 'Mosquito repellent for Night Safari', reason: 'night-safari' },
  { text: 'Comfortable shoes you can walk 15 km in', reason: 'daily' },
  { text: 'Some SGD cash — hawker stalls are still cash-friendly', reason: 'money' },
  { text: 'Card that does not charge forex fees', reason: 'money' },
]

export const useTrip = create<State>()(
  persist(
    (set, get) => ({
      setup: DEFAULT_SETUP,
      anchors: DEFAULT_ANCHORS,
      stay: null,
      items: [],
      customPlaces: [],
      expenses: [],
      people: DEFAULT_PEOPLE,
      chat: [],
      packing: [],
      custody: [],
      tickets: [],

      apiKey: '',
      aiCalls: 0,
      aiBudget: 25,
      aiSpendUsd: 0,
      budgetAcknowledgedAt: 0,

      tracking: false,
      placeInfo: {},
      fx: null,
      lastUndo: null,

      setSetup: (p) => set((s) => ({ setup: { ...s.setup, ...p } })),
      setAnchors: (p) => set((s) => ({ anchors: { ...s.anchors, ...p } })),
      setStay: (stay) => set({ stay }),

      addItem: (i) => {
        const id = uid()
        set((s) => ({ items: [...s.items, { ...i, id }] }))
        return id
      },
      updateItem: (id, p) =>
        set((s) => ({
          items: s.items.map((x) => (x.id === id ? { ...x, ...p, id: x.id } : x)),
        })),
      removeItem: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
      replaceItems: (items, label) =>
        set((s) => ({ items, lastUndo: { items: s.items, label } })),
      undo: () =>
        set((s) => (s.lastUndo ? { items: s.lastUndo.items, lastUndo: null } : {})),

      addCustomPlace: (p) => set((s) => ({ customPlaces: [...s.customPlaces, p] })),
      removeCustomPlace: (id) =>
        set((s) => ({ customPlaces: s.customPlaces.filter((x) => x.id !== id) })),

      setPeople: (people) => set({ people: people.filter((p) => p.trim()).slice(0, 10) }),
      addPerson: (name) =>
        set((s) => {
          const n = name.trim()
          if (!n || s.people.some((p) => p.toLowerCase() === n.toLowerCase())) return {}
          return { people: [...s.people, n] }
        }),
      removePerson: (name) =>
        set((s) =>
          s.people.length <= 1 ? {} : { people: s.people.filter((p) => p !== name) },
        ),
      renamePerson: (from, to) =>
        set((s) => {
          const n = to.trim()
          if (!n || from === n) return {}
          const swap = (x: string) => (x === from ? n : x)
          return {
            people: s.people.map(swap),
            expenses: s.expenses.map((e) => ({
              ...e,
              paidBy: e.paidBy ? swap(e.paidBy) : e.paidBy,
              splitWith: e.splitWith?.map(swap),
              onBehalfOf: e.onBehalfOf?.map(swap),
              shares: e.shares?.map((sh) => ({ ...sh, name: swap(sh.name) })),
            })),
          }
        }),

      addExpense: (e) =>
        set((s) => ({
          expenses: [{ ...e, id: uid(), createdAt: Date.now() }, ...s.expenses],
        })),
      updateExpense: (id, p) =>
        set((s) => ({ expenses: s.expenses.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
      removeExpense: (id) =>
        set((s) => ({ expenses: s.expenses.filter((x) => x.id !== id) })),

      pushChat: (m) => {
        const id = uid()
        set((s) => ({ chat: [...s.chat, { ...m, id, ts: Date.now() }] }))
        return id
      },
      patchChat: (id, p) =>
        set((s) => ({ chat: s.chat.map((x) => (x.id === id ? { ...x, ...p } : x)) })),
      clearChat: () => set({ chat: [] }),
      setProposalState: (msgId, p) =>
        set((s) => ({
          chat: s.chat.map((x) =>
            x.id === msgId && x.proposal ? { ...x, proposal: { ...x.proposal, ...p } } : x,
          ),
        })),

      togglePacking: (id) =>
        set((s) => ({
          packing: s.packing.map((x) => (x.id === id ? { ...x, packed: !x.packed } : x)),
        })),
      addPacking: (text, reason) =>
        set((s) => ({ packing: [...s.packing, { id: uid(), text, packed: false, reason }] })),
      removePacking: (id) => set((s) => ({ packing: s.packing.filter((x) => x.id !== id) })),
      seedPacking: (items) =>
        set((s) => {
          const have = new Set(s.packing.map((x) => x.text.toLowerCase()))
          const add = items
            .filter((x) => !have.has(x.text.toLowerCase()))
            .map((x) => ({ ...x, id: uid(), packed: false }))
          return { packing: [...s.packing, ...add] }
        }),

      addTicket: (t) => {
        const id = uid()
        set((s) => ({
          tickets: [...s.tickets, { ...t, id, passes: t.passes ?? [], createdAt: Date.now() }],
        }))
        return id
      },
      updateTicket: (id, p) =>
        set((s) => ({
          tickets: s.tickets.map((t) => (t.id === id ? { ...t, ...p, id: t.id } : t)),
        })),
      removeTicket: (id) => set((s) => ({ tickets: s.tickets.filter((t) => t.id !== id) })),
      addPasses: (ticketId, passes) =>
        set((s) => ({
          tickets: s.tickets.map((t) =>
            t.id === ticketId
              ? {
                  ...t,
                  passes: [
                    ...t.passes,
                    ...passes.map((x) => ({ ...x, id: uid(), addedAt: Date.now() })),
                  ],
                }
              : t,
          ),
        })),
      updatePass: (ticketId, passId, p) =>
        set((s) => ({
          tickets: s.tickets.map((t) =>
            t.id === ticketId
              ? { ...t, passes: t.passes.map((x) => (x.id === passId ? { ...x, ...p } : x)) }
              : t,
          ),
        })),
      removePass: (ticketId, passId) =>
        set((s) => ({
          tickets: s.tickets.map((t) =>
            t.id === ticketId ? { ...t, passes: t.passes.filter((x) => x.id !== passId) } : t,
          ),
        })),

      setCustody: (what, who, note) =>
        set((s) => {
          const existing = s.custody.find((x) => x.what.toLowerCase() === what.toLowerCase())
          if (existing) {
            return {
              custody: s.custody.map((x) =>
                x.id === existing.id ? { ...x, who, note, updatedAt: Date.now() } : x,
              ),
            }
          }
          return {
            custody: [...s.custody, { id: uid(), what, who, note, updatedAt: Date.now() }],
          }
        }),
      removeCustody: (id) => set((s) => ({ custody: s.custody.filter((x) => x.id !== id) })),

      setApiKey: (apiKey) => set({ apiKey }),
      noteAiCall: (costUsd) =>
        set((s) => ({ aiCalls: s.aiCalls + 1, aiSpendUsd: s.aiSpendUsd + costUsd })),
      setAiBudget: (aiBudget) => set({ aiBudget }),
      acknowledgeBudget: () =>
        set((s) => ({
          budgetAcknowledgedAt: Date.now(),
          // Raise the bar so the same answer is not asked for again next call.
          aiBudget: s.aiCalls + Math.max(10, Math.round(s.aiBudget / 2)),
        })),
      resetAiCounter: () => set({ aiCalls: 0, aiSpendUsd: 0 }),

      setTracking: (tracking) => set({ tracking }),
      cachePlaceInfo: (key, info) =>
        set((s) => ({ placeInfo: { ...s.placeInfo, [key]: info } })),
      setFx: (fx) => set({ fx }),
    }),
    {
      name: STORE_KEY,
      version: 1,
      // Explicit allow-list: everything the trip is, nothing transient.
      partialize: (s) => ({
        setup: s.setup,
        anchors: s.anchors,
        stay: s.stay,
        items: s.items,
        customPlaces: s.customPlaces,
        expenses: s.expenses,
        people: s.people,
        chat: s.chat.slice(-40),
        packing: s.packing,
        custody: s.custody,
        tickets: s.tickets,
        apiKey: s.apiKey,
        aiCalls: s.aiCalls,
        aiBudget: s.aiBudget,
        aiSpendUsd: s.aiSpendUsd,
        budgetAcknowledgedAt: s.budgetAcknowledgedAt,
        tracking: s.tracking,
        placeInfo: s.placeInfo,
        fx: s.fx,
      }) as unknown as State,
    },
  ),
)
