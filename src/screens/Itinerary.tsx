import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bus,
  Car,
  CheckCircle2,
  ChevronDown,
  CloudRain,
  Footprints,
  Info,
  Lock,
  MapPin,
  Navigation,
  Pencil,
  Sparkles,
  Trash2,
  TriangleAlert,
  Wand2,
} from 'lucide-react'
import { Btn, Chip, Empty, spring, Spinner } from '../components/ui'
import { ProposalCard } from '../components/ProposalCard'
import { ScheduleSheet } from '../components/ScheduleSheet'
import { useTrip } from '../lib/store'
import { useAi, useAllItems, useNow, useTripContext, useWeather } from '../lib/hooks'
import {
  dateForDay,
  dayCount,
  dayForDate,
  endOf,
  formatDayLabel,
  formatTime12,
  itemsForDay,
  legsForDay,
  tripWarnings,
  ymd,
  type Leg,
} from '../lib/trip'
import { directionsUrl, formatDuration, toMinutes } from '../lib/geo'
import {
  applyActions,
  autoPlanPrompt,
  BudgetDeclined,
  extractActions,
  systemPrompt,
  TIER_LABEL,
  validateActions,
} from '../lib/ai'
import { weatherWord } from '../lib/free'
import type { ItineraryItem, Proposal } from '../lib/types'

export function Itinerary({
  toast,
  goSettings,
}: {
  toast: (t: string, action?: { label: string; run: () => void }) => void
  goSettings: () => void
}) {
  const setup = useTrip((s) => s.setup)
  const stay = useTrip((s) => s.stay)
  const expenses = useTrip((s) => s.expenses)
  const removeItem = useTrip((s) => s.removeItem)
  const replaceItems = useTrip((s) => s.replaceItems)
  const undo = useTrip((s) => s.undo)
  const rawItems = useTrip((s) => s.items)
  const customPlaces = useTrip((s) => s.customPlaces)
  const all = useAllItems()
  const ctx = useTripContext()
  const { call, hasKey } = useAi()
  const weather = useWeather()
  const now = useNow()

  const days = dayCount(setup)
  const today = dayForDate(setup, ymd(now))
  const [day, setDay] = useState(() => today ?? 1)
  const [editing, setEditing] = useState<ItineraryItem | null>(null)
  const [showWarnings, setShowWarnings] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)

  const items = useMemo(() => itemsForDay(all, day), [all, day])
  const legs = useMemo(() => legsForDay(items, stay), [items, stay])
  const warnings = useMemo(() => tripWarnings(all, setup, stay), [all, setup, stay])
  const dayWarnings = warnings.filter((w) => w.day === day)
  const globalWarnings = warnings.filter((w) => !w.day)

  const dayDate = dateForDay(setup, day)
  const dayWeather = weather?.find((w) => w.date === ymd(dayDate))
  const outdoorHeavy = items.some((i) =>
    ['gardens-bay', 'night-safari', 'singapore-zoo', 'east-coast-park', 'botanic-gardens', 'treetop-walk', 'siloso', 'palawan', 'fort-canning', 'jurong-lake-gardens'].includes(i.placeId ?? ''),
  )

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const isToday = today === day

  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-day="${day}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [day])

  const autoPlan = async () => {
    setPlanning(true)
    setProposal(null)
    try {
      const r = await call({
        tier: 'text',
        maxTokens: 2200,
        system: systemPrompt(ctx),
        messages: [{ role: 'user', content: autoPlanPrompt(ctx) }],
      })
      const { raw } = extractActions(r.text)
      const actions = validateActions(raw, { setup, all, customPlaces })
      setProposal({ id: 'autoplan', actions, applied: false, source: 'autoplan' })
      if (!actions.length) toast('The model came back without any usable stops. Try again.')
    } catch (e) {
      if (!(e instanceof BudgetDeclined)) {
        toast(e instanceof Error ? e.message : 'Auto-plan failed.')
      }
    } finally {
      setPlanning(false)
    }
  }

  const applyProposal = () => {
    if (!proposal) return
    const next = applyActions(rawItems, proposal.actions, customPlaces)
    replaceItems(next, 'auto-plan')
    setProposal({ ...proposal, applied: true })
    toast(`${proposal.actions.filter((a) => a.ok).length} stops added.`, {
      label: 'Undo',
      run: () => undo(),
    })
  }

  const del = (it: ItineraryItem) => {
    const snapshot = rawItems
    removeItem(it.id)
    toast(`Removed ${it.name}.`, { label: 'Undo', run: () => replaceItems(snapshot, 'undo delete') })
  }

  const daySpend = expenses
    .filter((e) => e.date === ymd(dayDate))
    .reduce((s, e) => s + e.amount, 0)
  const visited = items.filter((i) => i.arrivedAt).length

  return (
    <div className="pb-6">
      {/* ---- day strip ---- */}
      <div ref={stripRef} className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3 pt-1">
        {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
          const { dow, dm } = formatDayLabel(dateForDay(setup, d))
          const on = d === day
          const count = itemsForDay(all, d).length
          return (
            <button
              key={d}
              data-day={d}
              onClick={() => setDay(d)}
              className="relative shrink-0 rounded-2xl px-3.5 py-2.5 text-left"
            >
              {on && (
                <motion.div
                  layoutId="day-pill"
                  className="absolute inset-0 rounded-2xl border border-gold/70 bg-gold/12"
                  transition={spring.snap}
                />
              )}
              <div className="relative">
                <div
                  className={`font-mono text-[9px] uppercase tracking-[0.16em] ${
                    on ? 'text-gold' : 'text-mute-2'
                  }`}
                >
                  {today === d ? 'TODAY' : `D${d}`} · {dow}
                </div>
                <div className={`disp text-[19px] ${on ? 'text-gold' : 'text-cream'}`}>{dm}</div>
                <div className="mt-0.5 flex gap-0.5">
                  {Array.from({ length: Math.min(count, 6) }, (_, k) => (
                    <span
                      key={k}
                      className={`h-[3px] w-[3px] rounded-full ${on ? 'bg-gold/70' : 'bg-line-2'}`}
                    />
                  ))}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* ---- weather + warnings ---- */}
      <div className="space-y-2 px-4">
        {dayWeather && (
          <div className="flex items-center gap-2.5 rounded-xl border border-line bg-ink-2/50 px-3 py-2">
            <CloudRain size={14} className={dayWeather.rainChance >= 60 ? 'text-transit' : 'text-mute-2'} />
            <span className="text-[12px] text-mute">
              {weatherWord(dayWeather.code)} · {Math.round(dayWeather.maxC)}° / {Math.round(dayWeather.minC)}° ·{' '}
              {dayWeather.rainChance}% rain
            </span>
            {outdoorHeavy && dayWeather.rainChance >= 60 && (
              <Chip tone="alert" className="ml-auto">
                outdoor day
              </Chip>
            )}
          </div>
        )}

        {(dayWarnings.length > 0 || globalWarnings.length > 0) && (
          <div className="card overflow-hidden">
            <button
              onClick={() => setShowWarnings((v) => !v)}
              className="flex w-full items-center gap-2 px-3.5 py-2.5"
            >
              <TriangleAlert
                size={14}
                className={dayWarnings.some((w) => w.level === 'danger') ? 'text-danger' : 'text-alert'}
              />
              <span className="text-[12.5px] text-cream">
                {dayWarnings.length + globalWarnings.length} thing
                {dayWarnings.length + globalWarnings.length === 1 ? '' : 's'} worth a look
              </span>
              <motion.span
                animate={{ rotate: showWarnings ? 180 : 0 }}
                transition={spring.snap}
                className="ml-auto text-mute-2"
              >
                <ChevronDown size={15} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {showWarnings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={spring.soft}
                  className="overflow-hidden"
                >
                  <div className="space-y-1.5 border-t border-line px-3.5 py-2.5">
                    {[...dayWarnings, ...globalWarnings].map((w) => (
                      <div key={w.id} className="flex items-start gap-2">
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                            w.level === 'danger'
                              ? 'bg-danger'
                              : w.level === 'warn'
                                ? 'bg-alert'
                                : 'bg-mute-2'
                          }`}
                        />
                        <span className="text-[12px] leading-snug text-mute">{w.text}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ---- timeline ---- */}
      <div className="mt-4 px-4">
        {items.length === 0 ? (
          <Empty
            icon={<MapPin size={22} />}
            title="Nothing on this day yet"
            body="Add stops from Places, or let auto-plan fill every open gap across the whole trip in one call."
          />
        ) : (
          <div className="relative">
            <AnimatePresence initial={false}>
              {items.map((it, i) => (
                <StopRow
                  key={it.id}
                  item={it}
                  leg={legs[i]}
                  index={i}
                  firstLeg={i === legs.findIndex((l) => !l.hidden && l.estimate)}
                  last={i === items.length - 1}
                  isNow={isToday && nowMin >= toMinutes(it.start) && nowMin < toMinutes(endOf(it))}
                  onEdit={() => setEditing(it)}
                  onDelete={() => del(it)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ---- day summary ---- */}
      {items.length > 0 && (
        <div className="mt-4 px-4">
          <div className="card p-3.5">
            <div className="lbl mb-2">Day {day} at a glance</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="stops" value={String(items.length)} />
              <Stat
                label="visited"
                value={`${visited}`}
                tone={visited > 0 ? 'ok' : 'mute'}
              />
              <Stat label="spent" value={daySpend ? `S$${daySpend.toFixed(0)}` : '—'} />
            </div>
            {isToday && visited > 0 && (
              <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-ok">
                <CheckCircle2 size={12} /> Live tracking has logged {visited} arrival
                {visited === 1 ? '' : 's'} today.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- auto-plan ---- */}
      <div className="mt-4 space-y-3 px-4">
        {proposal && (
          <ProposalCard
            proposal={proposal}
            onApply={applyProposal}
            onDismiss={() => setProposal({ ...proposal, dismissed: true })}
          />
        )}
        <div className="card p-3.5">
          <div className="flex items-center gap-2">
            <Wand2 size={15} className="text-gold" />
            <span className="text-[13.5px] text-cream">Auto-plan the whole trip</span>
            <Chip tone="gold" className="ml-auto">
              {TIER_LABEL.text.name} · {TIER_LABEL.text.rough}
            </Chip>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-snug text-mute">
            One call. Fills every open gap around the fixed blocks, groups days by area, and gives
            Night Safari an evening. Nothing is applied until you read it and tap apply.
          </p>
          <Btn
            full
            className="mt-2.5"
            variant="gold"
            disabled={planning || !hasKey}
            onClick={hasKey ? autoPlan : goSettings}
          >
            {planning ? <Spinner size={14} /> : <Sparkles size={14} />}
            {planning ? 'Thinking…' : hasKey ? 'Plan my days' : 'Add an API key first'}
          </Btn>
        </div>
      </div>

      <ScheduleSheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        editing={editing}
        onDone={toast}
      />
    </div>
  )
}

function Stat({ label, value, tone = 'mute' }: { label: string; value: string; tone?: 'mute' | 'ok' }) {
  return (
    <div className="rounded-lg border border-line bg-ink-2/40 py-2">
      <div className={`disp text-[20px] ${tone === 'ok' ? 'text-ok' : 'text-cream'}`}>{value}</div>
      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-mute-2">{label}</div>
    </div>
  )
}

// ------------------------------------------------------------------ stop row

function StopRow({
  item,
  leg,
  index,
  firstLeg,
  last,
  isNow,
  onEdit,
  onDelete,
}: {
  item: ItineraryItem
  leg?: Leg
  index: number
  firstLeg: boolean
  last: boolean
  isNow: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ ...spring.soft, delay: Math.min(index * 0.03, 0.2) }}
      className="relative"
    >
      {leg && <LegRow leg={leg} first={firstLeg} />}

      <div className="relative flex gap-3">
        {/* rail */}
        <div className="relative flex w-11 shrink-0 flex-col items-center">
          <div
            className={`flap text-[11px] leading-[1.5] ${
              item.locked ? 'text-danger' : isNow ? 'text-gold' : 'text-cream'
            }`}
          >
            {item.start}
          </div>
          {!last && (
            <div className="mt-1 w-px flex-1 border-l border-dashed border-line-2" />
          )}
        </div>

        {/* card */}
        <div className="min-w-0 flex-1 pb-4">
          <motion.button
            layout
            onClick={() => setOpen((v) => !v)}
            className={`card w-full overflow-hidden p-3.5 text-left ${
              isNow ? 'border-gold/60 shadow-[0_0_0_1px_rgba(232,180,92,0.25)]' : ''
            }`}
            whileTap={{ scale: 0.99 }}
            transition={spring.snap}
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {item.locked && <Lock size={11} className="shrink-0 text-danger" />}
                  {item.arrivedAt && <CheckCircle2 size={11} className="shrink-0 text-ok" />}
                  <h3 className="truncate text-[15px] font-semibold text-cream">{item.name}</h3>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Chip tone={isNow ? 'gold' : 'mute'}>
                    {formatTime12(item.start)}–{formatTime12(endOf(item))}
                  </Chip>
                  <Chip>{formatDuration(item.durationMin)}</Chip>
                  {isNow && <Chip tone="gold">now</Chip>}
                  {item.locked && <Chip tone="danger">fixed</Chip>}
                </div>
              </div>
              <motion.span
                animate={{ rotate: open ? 180 : 0 }}
                transition={spring.snap}
                className="mt-1 shrink-0 text-mute-2"
              >
                <ChevronDown size={15} />
              </motion.span>
            </div>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={spring.soft}
                  className="overflow-hidden"
                >
                  <div className="mt-3 border-t border-line pt-3">
                    {item.notes && (
                      <p className="text-[12.5px] leading-relaxed text-mute">{item.notes}</p>
                    )}
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {item.coords && (
                        <a
                          href={directionsUrl(leg?.from?.coords ?? null, item.coords, leg?.mode ?? 'transit')}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Btn>
                            <Navigation size={13} /> Directions
                          </Btn>
                        </a>
                      )}
                      {!item.locked && (
                        <>
                          <Btn
                            onClick={() => {
                              onEdit()
                            }}
                          >
                            <Pencil size={13} /> Reschedule
                          </Btn>
                          <Btn variant="danger" onClick={onDelete}>
                            <Trash2 size={13} />
                          </Btn>
                        </>
                      )}
                      {item.locked && (
                        <span className="flex items-center gap-1.5 self-center text-[11.5px] text-mute-2">
                          <Info size={12} /> Fixed block — flights, Universal and the concert stay put.
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

// ------------------------------------------------------------------ leg row

const MODE_WORD: Record<string, string> = { walk: 'on foot', transit: 'by MRT/bus', taxi: 'by taxi' }

function LegRow({ leg, first }: { leg: Leg; first: boolean }) {
  if (leg.hidden || !leg.estimate || !leg.from) return null

  const Icon = leg.mode === 'walk' ? Footprints : leg.mode === 'taxi' ? Car : Bus
  const colour =
    leg.mode === 'walk' ? 'text-walk' : leg.mode === 'taxi' ? 'text-taxi' : 'text-transit'

  return (
    <div className="relative flex gap-3">
      <div className="flex w-11 shrink-0 justify-center">
        <div className="w-px border-l border-dashed border-line-2" />
      </div>
      <div className="min-w-0 flex-1 pb-3 pt-0.5">
        <div className="flex items-center gap-2">
          <Icon size={12} className={`shrink-0 ${colour}`} />
          {/* Only the first leg needs to name where you are coming from — after
              that it is obviously the stop directly above. */}
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-mute">
            <span className={colour}>{leg.minutes}m</span> {MODE_WORD[leg.mode]} ·{' '}
            {leg.estimate.km} km
            {first && (
              <>
                {' from '}
                <span className="text-mute-2">{leg.from.name}</span>
              </>
            )}
          </span>
          {leg.to.coords && (
            <a
              href={directionsUrl(leg.from.coords, leg.to.coords, leg.mode)}
              target="_blank"
              rel="noreferrer"
              className={`shrink-0 font-mono text-[9.5px] uppercase tracking-[0.12em] ${colour}`}
            >
              live ↗
            </a>
          )}
        </div>
        {(leg.overlaps || leg.tight || leg.lateNight) && (
          <div className="mt-1 flex flex-wrap gap-1.5 pl-[20px]">
            {leg.overlaps && <Chip tone="danger">overlaps the stop before</Chip>}
            {!leg.overlaps && leg.tight && (
              <Chip tone="alert">
                tight · only {leg.gapMin}m, needs {leg.estimate.transitMin}m
              </Chip>
            )}
            {leg.lateNight && <Chip tone="taxi">trains have stopped — taxi</Chip>}
          </div>
        )}
      </div>
    </div>
  )
}
