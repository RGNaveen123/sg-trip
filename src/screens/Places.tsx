import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Plus, Search, ShoppingBag, Store, X } from 'lucide-react'
import { Btn, Chip, spring } from '../components/ui'
import { PlaceSheet } from '../components/PlaceSheet'
import { ScheduleSheet } from '../components/ScheduleSheet'
import { AddPlaceSheet } from '../components/AddPlaceSheet'
import { CATEGORY_LABEL, CATEGORY_ORDER, CATEGORY_SHORT, CONVENIENCE_NOTE, PLACES } from '../data/places'
import { useTrip } from '../lib/store'
import { useAllItems } from '../lib/hooks'
import { formatDuration } from '../lib/geo'
import type { Place, PlaceCategory } from '../lib/types'

export function Places({
  toast,
  onAsk,
}: {
  toast: (t: string) => void
  onAsk: (prompt: string) => void
}) {
  const customPlaces = useTrip((s) => s.customPlaces)
  const all = useAllItems()
  const [query, setQuery] = useState('')
  const [openArea, setOpenArea] = useState<string | null>('Marina Bay')
  const [filter, setFilter] = useState<PlaceCategory | 'all'>('all')
  const [detail, setDetail] = useState<Place | null>(null)
  const [scheduling, setScheduling] = useState<Place | null>(null)
  const [adding, setAdding] = useState(false)

  const scheduledIds = useMemo(
    () => new Set(all.map((i) => i.placeId).filter(Boolean) as string[]),
    [all],
  )

  const pool = useMemo(() => [...customPlaces, ...PLACES].filter((p) => p.category !== 'transit'), [customPlaces])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return pool.filter((p) => {
      if (filter !== 'all' && p.category !== filter) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q) ||
        p.blurb.toLowerCase().includes(q) ||
        p.tags?.some((t) => t.includes(q))
      )
    })
  }, [pool, query, filter])

  /** Areas, then activity type inside each — never raw zone codes. */
  const grouped = useMemo(() => {
    const byArea = new Map<string, Map<PlaceCategory, Place[]>>()
    for (const p of filtered) {
      if (!byArea.has(p.area)) byArea.set(p.area, new Map())
      const cats = byArea.get(p.area)!
      if (!cats.has(p.category)) cats.set(p.category, [])
      cats.get(p.category)!.push(p)
    }
    return [...byArea.entries()].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
  }, [filtered])

  const searching = query.trim().length > 0

  return (
    <div className="pb-6">
      <div className="space-y-3 px-4 pt-1">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute-2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search places, areas, food…"
            className="w-full rounded-xl border border-line bg-ink-2/70 py-2.5 pl-10 pr-9 text-[14px] text-cream placeholder:text-mute-2 focus:border-gold/60 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-mute-2"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
          <FilterChip on={filter === 'all'} onClick={() => setFilter('all')}>
            Everything
          </FilterChip>
          {CATEGORY_ORDER.filter((c) => c !== 'transit').map((c) => (
            <FilterChip key={c} on={filter === c} onClick={() => setFilter(c)}>
              {CATEGORY_LABEL[c]}
            </FilterChip>
          ))}
        </div>

        <Btn full onClick={() => setAdding(true)}>
          <Plus size={14} /> Add your own spot
        </Btn>
      </div>

      <div className="mt-4 space-y-2 px-4">
        {grouped.length === 0 && (
          <div className="py-10 text-center text-[13px] text-mute">
            Nothing matches “{query}”. Add it as your own spot instead.
          </div>
        )}

        {grouped.map(([area, cats]) => {
          const open = searching || openArea === area
          const count = [...cats.values()].reduce((n, l) => n + l.length, 0)
          return (
            <div key={area} className="card overflow-hidden">
              <button
                onClick={() => setOpenArea(open && !searching ? null : area)}
                className="flex w-full items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1 text-left">
                  <div className="disp text-[20px] text-cream">{area}</div>
                  <div className="lbl mt-0.5">
                    {count} place{count === 1 ? '' : 's'} ·{' '}
                    {CATEGORY_ORDER.filter((c) => cats.has(c)).map((c) => CATEGORY_SHORT[c]).join(' · ')}
                  </div>
                </div>
                <motion.span
                  animate={{ rotate: open ? 180 : 0 }}
                  transition={spring.snap}
                  className="text-mute-2"
                >
                  <ChevronDown size={16} />
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={spring.soft}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-line">
                      {CATEGORY_ORDER.filter((c) => cats.has(c)).map((cat) => (
                        <div key={cat} className="px-4 py-3">
                          <div className="lbl mb-2">{CATEGORY_LABEL[cat]}</div>
                          <div className="space-y-1.5">
                            {cats.get(cat)!.map((p) => (
                              <PlaceRow
                                key={p.id}
                                place={p}
                                scheduled={scheduledIds.has(p.id)}
                                onOpen={() => setDetail(p)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}

        <div className="card flex items-start gap-3 p-3.5">
          <Store size={16} className="mt-0.5 shrink-0 text-mute-2" />
          <div>
            <div className="text-[13px] text-cream">Convenience stores</div>
            <p className="mt-0.5 text-[11.5px] leading-snug text-mute">{CONVENIENCE_NOTE}</p>
          </div>
        </div>
      </div>

      <PlaceSheet
        place={detail}
        onClose={() => setDetail(null)}
        onSchedule={(p) => {
          setDetail(null)
          setScheduling(p)
        }}
        onAsk={(prompt) => {
          setDetail(null)
          onAsk(prompt)
        }}
      />
      <ScheduleSheet
        open={Boolean(scheduling)}
        onClose={() => setScheduling(null)}
        place={scheduling}
        onDone={toast}
      />
      <AddPlaceSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={(p, msg) => {
          toast(msg)
          setDetail(p)
        }}
      />
    </div>
  )
}

function FilterChip({
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

function PlaceRow({
  place,
  scheduled,
  onOpen,
}: {
  place: Place
  scheduled: boolean
  onOpen: () => void
}) {
  return (
    <motion.button
      onClick={onOpen}
      whileTap={{ scale: 0.985 }}
      transition={spring.snap}
      className="flex w-full items-start gap-3 rounded-xl border border-line/60 bg-ink-2/30 px-3 py-2.5 text-left"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13.5px] leading-snug text-cream">{place.name}</span>
          {place.custom && <ShoppingBag size={10} className="shrink-0 text-walk" />}
        </div>
        <p className="mt-0.5 text-[11.5px] leading-snug text-mute">{place.blurb}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="font-mono text-[10px] text-mute-2">{formatDuration(place.typicalMin)}</span>
        {scheduled && <Chip tone="ok">on plan</Chip>}
      </div>
    </motion.button>
  )
}
