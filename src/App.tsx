import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  CalendarRange,
  Compass,
  DownloadCloud,
  LocateFixed,
  Map as MapIcon,
  MessageCircle,
  Package,
  Settings as SettingsIcon,
  Ticket as TicketIcon,
  Wallet,
  WifiOff,
} from 'lucide-react'
import { Btn, Chip, Sheet, spring, Toasts, useToasts } from './components/ui'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Itinerary } from './screens/Itinerary'
import { Places } from './screens/Places'

// The two tabs the app opens on ship in the main bundle. The rest — and the
// Markdown renderer and Leaflet they drag in — arrive when first opened.
const MapScreen = lazy(() => import('./screens/MapScreen').then((m) => ({ default: m.MapScreen })))
const Money = lazy(() => import('./screens/Money').then((m) => ({ default: m.Money })))
const Ask = lazy(() => import('./screens/Ask').then((m) => ({ default: m.Ask })))
const Settings = lazy(() => import('./screens/Settings').then((m) => ({ default: m.Settings })))
const Kit = lazy(() => import('./screens/Kit').then((m) => ({ default: m.Kit })))
const Tickets = lazy(() => import('./screens/Tickets').then((m) => ({ default: m.Tickets })))
import { useTrip } from './lib/store'
import { useOnline, useNow } from './lib/hooks'
import { useLiveTracking } from './lib/tracking'
import { setBudgetConfirmer, TIER_LABEL } from './lib/ai'
import type { CostTier } from './lib/types'
import { dateForDay, dayCount, dayForDate, formatDayLabel, parseLocal, ymd } from './lib/trip'
import { applyUpdate, initPwa, usePwa } from './lib/pwa'

type Tab = 'plan' | 'places' | 'tickets' | 'money' | 'ask'
type View = Tab | 'settings' | 'kit' | 'map'

const TABS: { id: Tab; label: string; icon: typeof CalendarRange }[] = [
  { id: 'plan', label: 'Plan', icon: CalendarRange },
  { id: 'places', label: 'Places', icon: Compass },
  { id: 'tickets', label: 'Tickets', icon: TicketIcon },
  { id: 'money', label: 'Spend', icon: Wallet },
  { id: 'ask', label: 'Ask AI', icon: MessageCircle },
]

const TITLES: Record<View, string> = {
  plan: 'Itinerary',
  places: 'Places',
  tickets: 'Tickets',
  map: 'Map',
  money: 'Spend',
  ask: 'Ask AI',
  settings: 'Settings',
  kit: 'Trip kit',
}

function ScreenSkeleton() {
  return (
    <div className="space-y-3 px-4 pt-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-[18px] border border-line bg-ink-2/40"
          style={{ animationDelay: `${i * 90}ms` }}
        />
      ))}
    </div>
  )
}

export default function App() {
  const [view, setView] = useState<View>('plan')
  const [askPrefill, setAskPrefill] = useState<string | null>(null)
  const { list, push, dismiss } = useToasts()
  const online = useOnline()
  const pwa = usePwa()
  const now = useNow(60000)
  const setup = useTrip((s) => s.setup)
  const tracking = useTrip((s) => s.tracking)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    initPwa()
  }, [])

  const toast = useCallback(
    (text: string, action?: { label: string; run: () => void }) => push(text, { action }),
    [push],
  )

  const live = useLiveTracking(useCallback((t: string) => push(t, { tone: 'ok', ms: 9000 }), [push]))

  // ---- AI budget gate ----
  const [gate, setGate] = useState<{
    calls: number
    budget: number
    tier: CostTier
    resolve: (ok: boolean) => void
  } | null>(null)

  useEffect(() => {
    setBudgetConfirmer(
      (info) => new Promise<boolean>((resolve) => setGate({ ...info, resolve })),
    )
    return () => setBudgetConfirmer(null)
  }, [])

  const acknowledgeBudget = useTrip((s) => s.acknowledgeBudget)

  // ---- trip status line ----
  const status = useMemo(() => {
    const today = ymd(now)
    const day = dayForDate(setup, today)
    const days = dayCount(setup)
    if (day) return { text: `Day ${day} of ${days}`, tone: 'gold' as const }
    const start = parseLocal(setup.arriveISO)
    const diff = Math.ceil((start.getTime() - now.getTime()) / 86400000)
    if (diff > 0) return { text: `${diff} day${diff === 1 ? '' : 's'} to go`, tone: 'mute' as const }
    return { text: 'Trip complete', tone: 'mute' as const }
  }, [now, setup])

  const range = useMemo(() => {
    const a = formatDayLabel(dateForDay(setup, 1))
    const b = formatDayLabel(dateForDay(setup, dayCount(setup)))
    return `${a.dm} – ${b.dm}`
  }, [setup])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [view])

  const goAsk = useCallback((prompt: string) => {
    setAskPrefill(prompt)
    setView('ask')
  }, [])

  const isOverlay = view === 'settings' || view === 'kit' || view === 'map'

  return (
    <div className="grain relative flex h-[100dvh] flex-col overflow-hidden bg-ink">
      {/* ---------------- header ---------------- */}
      <header className="glass safe-t z-30 shrink-0 border-b border-line">
        <div className="flex items-center gap-3 px-4 py-3">
          {isOverlay ? (
            <button
              onClick={() => setView('plan')}
              aria-label="Back"
              className="grid h-9 w-9 place-items-center rounded-full border border-line text-mute"
            >
              <ArrowLeft size={16} />
            </button>
          ) : (
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold/40 bg-gold/10">
              <span className="disp text-[15px] leading-none text-gold">SG</span>
            </div>
          )}

          <div className="min-w-0 flex-1">
            {/* The date range moved down a line. With three icons on the right
                it was squeezing the title into an ellipsis, which is the exact
                thing this release is meant to stop doing. */}
            <h1 className="disp text-[23px] leading-tight text-cream">{TITLES[view]}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span className="flap px-1.5 py-0 text-[9.5px] text-gold">SIN</span>
              {!isOverlay && (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mute-2">
                  {range}
                </span>
              )}
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.12em] ${
                  status.tone === 'gold' ? 'text-gold' : 'text-mute-2'
                }`}
              >
                {status.text}
              </span>
              {!online && (
                <span className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-alert">
                  <WifiOff size={9} /> offline
                </span>
              )}
              {tracking && live.position && (
                <span className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-ok">
                  <LocateFixed size={9} /> live
                </span>
              )}
            </div>
          </div>

          {!isOverlay && (
            <div className="flex shrink-0 gap-1.5">
              <button
                onClick={() => setView('map')}
                aria-label="Map"
                className="grid h-9 w-9 place-items-center rounded-full border border-line text-mute"
              >
                <MapIcon size={16} />
              </button>
              <button
                onClick={() => setView('kit')}
                aria-label="Trip kit"
                className="grid h-9 w-9 place-items-center rounded-full border border-line text-mute"
              >
                <Package size={16} />
              </button>
              <button
                onClick={() => setView('settings')}
                aria-label="Settings"
                className="grid h-9 w-9 place-items-center rounded-full border border-line text-mute"
              >
                <SettingsIcon size={16} />
              </button>
            </div>
          )}
        </div>

        {/* update banner — because a stale shell should never be silent */}
        <AnimatePresence>
          {pwa.needRefresh && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring.soft}
              className="overflow-hidden border-t border-gold/25 bg-gold/10"
            >
              <div className="flex items-center gap-3 px-4 py-2.5">
                <DownloadCloud size={14} className="shrink-0 text-gold" />
                <span className="flex-1 text-[12px] text-cream">
                  A newer build is ready on this phone.
                </span>
                <button
                  onClick={() => applyUpdate()}
                  className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-gold"
                >
                  Update now
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* live tracking strip */}
        <AnimatePresence>
          {tracking && (live.atStop || live.error) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring.soft}
              className="overflow-hidden border-t border-line"
            >
              <div className="flex items-center gap-2.5 px-4 py-2">
                {live.error ? (
                  <span className="text-[11.5px] text-alert">{live.error}</span>
                ) : (
                  <>
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
                    </span>
                    <span className="min-w-0 flex-1 text-[11.5px] leading-snug text-mute">
                      At <span className="text-cream">{live.atStop!.name}</span>
                      {live.nextStop && ` · next: ${live.nextStop.name} at ${live.nextStop.start}`}
                    </span>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ---------------- body ---------------- */}
      <main ref={scrollRef} className="no-scrollbar relative flex-1 overflow-y-auto overscroll-contain">
        {/* No exit animation and no AnimatePresence here on purpose: waiting for
            the old tab to fade out puts a delay on every single tab tap. The new
            screen mounts immediately and eases in under your thumb. */}
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
          className={view === 'ask' ? 'flex min-h-full flex-col pt-3' : 'pt-3'}
        >
          {/* Keyed by view, so a crash in one tab does not take the others
              with it — switching tabs clears it and the app keeps working. */}
          <ErrorBoundary resetKey={view} compact label={TITLES[view]}>
            <Suspense fallback={<ScreenSkeleton />}>
              {view === 'plan' && <Itinerary toast={toast} goSettings={() => setView('settings')} />}
              {view === 'places' && <Places toast={toast} onAsk={goAsk} />}
              {view === 'map' && <MapScreen position={live.position} />}
              {view === 'money' && <Money toast={toast} goSettings={() => setView('settings')} />}
              {view === 'ask' && (
                <Ask
                  prefill={askPrefill}
                  onPrefillUsed={() => setAskPrefill(null)}
                  toast={toast}
                  goSettings={() => setView('settings')}
                />
              )}
                {view === 'tickets' && <Tickets toast={toast} />}
              {view === 'settings' && <Settings toast={toast} />}
              {view === 'kit' && <Kit toast={toast} />}
            </Suspense>
          </ErrorBoundary>
        </motion.div>
      </main>

      {/* ---------------- bottom nav ---------------- */}
      <nav className="glass safe-b z-30 shrink-0 border-t border-line">
        <div className="flex items-stretch justify-around px-2 pb-1 pt-1.5">
          {TABS.map((t) => {
            const on = view === t.id
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className="relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2"
                aria-current={on ? 'page' : undefined}
              >
                {on && (
                  <motion.span
                    layoutId="tab-glow"
                    className="absolute inset-x-2 inset-y-0 rounded-xl bg-gold/10"
                    transition={spring.snap}
                  />
                )}
                <motion.span
                  animate={{ y: on ? -1 : 0, scale: on ? 1.06 : 1 }}
                  transition={spring.snap}
                  className={`relative ${on ? 'text-gold' : 'text-mute-2'}`}
                >
                  <Icon size={19} strokeWidth={on ? 2.2 : 1.8} />
                </motion.span>
                <span
                  className={`relative font-mono text-[9px] uppercase tracking-[0.1em] ${
                    on ? 'text-gold' : 'text-mute-2'
                  }`}
                >
                  {t.label}
                </span>
                {on && (
                  <motion.span
                    layoutId="tab-bar"
                    className="absolute -top-[1px] h-[2px] w-8 rounded-full bg-gold"
                    transition={spring.snap}
                  />
                )}
              </button>
            )
          })}
        </div>
      </nav>

      <Toasts list={list} dismiss={dismiss} />

      {/* ---------------- budget gate ---------------- */}
      <Sheet
        open={Boolean(gate)}
        onClose={() => {
          gate?.resolve(false)
          setGate(null)
        }}
        title="Check in on AI spend"
        subtitle="You asked to be asked"
      >
        {gate && (
          <div className="space-y-4">
            <div className="card p-4 text-center">
              <div className="lbl">calls so far</div>
              <div className="disp text-[46px] leading-none text-gold">{gate.calls}</div>
              <div className="mt-1 font-mono text-[10.5px] text-mute-2">
                your check-in threshold was {gate.budget}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Chip tone={gate.tier === 'text' ? 'gold' : gate.tier === 'vision' ? 'alert' : 'danger'}>
                next call · {TIER_LABEL[gate.tier].name}
              </Chip>
              <span className="text-[11.5px] text-mute">{TIER_LABEL[gate.tier].rough}</span>
            </div>
            <p className="text-[12.5px] leading-relaxed text-mute">
              Nothing has been sent yet. Continue and the threshold moves up, so you will not be
              asked again on the next call — you can change it any time in Settings.
            </p>
            <div className="flex gap-2">
              <Btn
                variant="quiet"
                className="flex-1"
                onClick={() => {
                  gate.resolve(false)
                  setGate(null)
                }}
              >
                Not now
              </Btn>
              <Btn
                variant="gold"
                className="flex-1"
                onClick={() => {
                  acknowledgeBudget()
                  gate.resolve(true)
                  setGate(null)
                }}
              >
                Go ahead
              </Btn>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}
