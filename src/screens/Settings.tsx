import { useState } from 'react'
import {
  Check,
  DownloadCloud,
  Eye,
  EyeOff,
  Home,
  KeyRound,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { Btn, Chip, Field, inputCls, Segmented, Sheet, Spinner } from '../components/ui'
import { MapView } from '../components/LazyMap'
import { useTrip } from '../lib/store'
import { DEFAULT_PACKING } from '../lib/store'
import { areaFor } from '../data/places'
import { geocode, nameFromMapsUrl, resolveShortLink } from '../lib/free'
import { isShortenedMapsLink, looksLikeUrl, parseCoordsFromUrl } from '../lib/geo'
import { applyUpdate, BUILD_ID, checkForUpdate, usePwa } from '../lib/pwa'
import { MODEL, TIER_LABEL } from '../lib/ai'
import { dateOf, timeOf } from '../lib/trip'
import { requestNotificationPermission } from '../lib/tracking'
import type { LatLng } from '../lib/types'

export function Settings({ toast }: { toast: (t: string) => void }) {
  const setup = useTrip((s) => s.setup)
  const setSetup = useTrip((s) => s.setSetup)
  const anchors = useTrip((s) => s.anchors)
  const setAnchors = useTrip((s) => s.setAnchors)
  const apiKey = useTrip((s) => s.apiKey)
  const setApiKey = useTrip((s) => s.setApiKey)
  const aiCalls = useTrip((s) => s.aiCalls)
  const aiBudget = useTrip((s) => s.aiBudget)
  const aiSpendUsd = useTrip((s) => s.aiSpendUsd)
  const setAiBudget = useTrip((s) => s.setAiBudget)
  const resetAiCounter = useTrip((s) => s.resetAiCounter)
  const tracking = useTrip((s) => s.tracking)
  const setTracking = useTrip((s) => s.setTracking)
  const seedPacking = useTrip((s) => s.seedPacking)

  const pwa = usePwa()
  const [showKey, setShowKey] = useState(false)
  const [stayOpen, setStayOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const setDateTime = (
    field: 'outboundISO' | 'arriveISO' | 'departISO',
    part: 'date' | 'time',
    value: string,
  ) => {
    const cur = setup[field]
    const next = part === 'date' ? `${value}T${timeOf(cur)}` : `${dateOf(cur)}T${value}`
    setSetup({ [field]: next } as never)
  }

  return (
    <div className="space-y-4 px-4 pb-6">
      {/* ---- update state ---- */}
      <Section title="This build" hint="So you always know what your phone is actually running.">
        <div className="flex items-center gap-2">
          <Chip tone={pwa.error ? 'danger' : pwa.needRefresh ? 'alert' : 'ok'}>
            {pwa.error
              ? 'no offline cache'
              : pwa.needRefresh
                ? 'update waiting'
                : pwa.offlineReady
                  ? 'offline ready'
                  : 'live'}
          </Chip>
          <span className="font-mono text-[10.5px] text-mute-2">build {BUILD_ID}</span>
        </div>
        {pwa.error && (
          <p className="mt-1.5 text-[11.5px] leading-snug text-danger">
            The service worker did not register, so this copy will not work offline. Serve the app
            over HTTPS (or localhost) and reinstall it to the home screen.
          </p>
        )}
        {pwa.lastChecked && (
          <p className="mt-1.5 font-mono text-[10px] text-mute-2">
            last checked {new Date(pwa.lastChecked).toLocaleTimeString()}
          </p>
        )}
        <div className="mt-2.5 flex gap-2">
          <Btn
            className="flex-1"
            disabled={checking}
            onClick={async () => {
              setChecking(true)
              const found = await checkForUpdate()
              setChecking(false)
              toast(found ? 'New build found — tap update.' : 'You are on the latest build.')
            }}
          >
            {checking ? <Spinner size={13} /> : <RefreshCw size={13} />} Check
          </Btn>
          <Btn
            variant={pwa.needRefresh ? 'gold' : 'ghost'}
            className="flex-1"
            onClick={() => applyUpdate()}
          >
            <DownloadCloud size={13} /> Update & reload
          </Btn>
        </div>
      </Section>

      {/* ---- flights ---- */}
      <Section title="Flights" hint="Everything else — day count, fixed blocks, the airport run — comes off these.">
        <div className="space-y-3">
          <Field label="Leave Kochi">
            <div className="flex gap-2">
              <input
                type="date"
                value={dateOf(setup.outboundISO)}
                onChange={(e) => setDateTime('outboundISO', 'date', e.target.value)}
                className={inputCls}
              />
              <input
                type="time"
                value={timeOf(setup.outboundISO)}
                onChange={(e) => setDateTime('outboundISO', 'time', e.target.value)}
                className={inputCls + ' w-28'}
              />
            </div>
          </Field>
          <Field label="Land in Singapore">
            <div className="flex gap-2">
              <input
                type="date"
                value={dateOf(setup.arriveISO)}
                onChange={(e) => setDateTime('arriveISO', 'date', e.target.value)}
                className={inputCls}
              />
              <input
                type="time"
                value={timeOf(setup.arriveISO)}
                onChange={(e) => setDateTime('arriveISO', 'time', e.target.value)}
                className={inputCls + ' w-28'}
              />
            </div>
          </Field>
          <Field label="Fly home from Singapore">
            <div className="flex gap-2">
              <input
                type="date"
                value={dateOf(setup.departISO)}
                onChange={(e) => setDateTime('departISO', 'date', e.target.value)}
                className={inputCls}
              />
              <input
                type="time"
                value={timeOf(setup.departISO)}
                onChange={(e) => setDateTime('departISO', 'time', e.target.value)}
                className={inputCls + ' w-28'}
              />
            </div>
          </Field>
        </div>
      </Section>

      {/* ---- fixed blocks ---- */}
      <Section title="The fixed points" hint="These generate the locked blocks nothing can move.">
        <div className="space-y-3">
          <Field label="Universal Studios day">
            <input
              type="date"
              value={anchors.ussDate}
              onChange={(e) => setAnchors({ ussDate: e.target.value })}
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Concert date">
              <input
                type="date"
                value={anchors.concertDate}
                onChange={(e) => setAnchors({ concertDate: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Show starts">
              <input
                type="time"
                value={anchors.concertStart}
                onChange={(e) => setAnchors({ concertStart: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
          <Field
            label="Get there this early (minutes)"
            hint="Express entry wants three hours. The block runs from that point until the show ends."
          >
            <input
              type="number"
              value={anchors.concertArriveEarlyMin}
              min={0}
              max={360}
              step={15}
              onChange={(e) => setAnchors({ concertArriveEarlyMin: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="Airport buffer before the flight home (minutes)">
            <input
              type="number"
              value={anchors.departureBufferMin}
              min={60}
              max={360}
              step={15}
              onChange={(e) => setAnchors({ departureBufferMin: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {/* ---- stay ---- */}
      <StaySection onOpen={() => setStayOpen(true)} />

      {/* ---- pace + currency ---- */}
      <Section title="How you like to travel">
        <div className="space-y-3">
          <Field label="Pace" hint="Sets the hours auto-plan is allowed to fill.">
            <Segmented
              id="pace"
              value={setup.pace}
              onChange={(pace) => setSetup({ pace })}
              options={[
                { value: 'relaxed', label: 'Relaxed' },
                { value: 'balanced', label: 'Balanced' },
                { value: 'packed', label: 'Packed' },
              ]}
            />
          </Field>
          <Field label="Home currency" hint="Used for the approximate conversion on the Spend tab.">
            <select
              value={setup.homeCurrency}
              onChange={(e) => setSetup({ homeCurrency: e.target.value })}
              className={inputCls}
            >
              {['INR', 'USD', 'EUR', 'GBP', 'AED', 'AUD', 'MYR'].map((c) => (
                <option key={c} value={c} className="bg-ink-2">
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      {/* ---- live tracking ---- */}
      <Section
        title="Day-of tracking"
        hint="Uses your phone's location to notice when you have arrived, and nudges you when a stop's time is nearly up. Off by default; nothing leaves the device."
      >
        <Btn
          full
          variant={tracking ? 'gold' : 'ghost'}
          onClick={async () => {
            const next = !tracking
            setTracking(next)
            if (next) {
              await requestNotificationPermission()
              toast('Live tracking on. It will ask for location when you open the app.')
            } else toast('Live tracking off.')
          }}
        >
          {tracking ? <Check size={14} /> : null} {tracking ? 'Tracking is on' : 'Turn tracking on'}
        </Btn>
      </Section>

      {/* ---- AI ---- */}
      <Section
        title="AI"
        hint={`Every call uses ${MODEL} — the cheapest model available. Nothing calls the API on its own.`}
      >
        <div className="space-y-3">
          <Field
            label="Anthropic API key"
            hint="Stored in this browser only. It never goes anywhere but api.anthropic.com."
          >
            <div className="relative">
              <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute-2" />
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value.trim())}
                placeholder="sk-ant-…"
                autoComplete="off"
                className={inputCls + ' pl-9 pr-10 font-mono text-[12px]'}
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? 'Hide key' : 'Show key'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-mute-2"
              >
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>

          <div className="card p-3.5">
            <div className="flex items-end justify-between">
              <div>
                <div className="lbl">Calls made</div>
                <div className="disp text-[32px] leading-none text-gold">{aiCalls}</div>
              </div>
              <div className="text-right">
                <div className="lbl">approx spend</div>
                <div className="disp text-[22px] leading-none text-cream">
                  ${aiSpendUsd.toFixed(3)}
                </div>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-gold transition-[width] duration-500"
                style={{ width: `${Math.min(100, (aiCalls / Math.max(1, aiBudget)) * 100)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10px] text-mute-2">
              <span>0</span>
              <span>check-in at {aiBudget}</span>
            </div>
          </div>

          <Field
            label="Check in with me after this many calls"
            hint="When you cross it you get one confirmation before the next call. Agree once and the bar moves up — you will not be asked again straight away."
          >
            <input
              type="number"
              min={1}
              max={9999}
              value={aiBudget}
              onChange={(e) => setAiBudget(Math.max(1, Number(e.target.value) || 1))}
              className={inputCls}
            />
          </Field>

          <div className="space-y-1.5">
            {(['text', 'vision', 'search'] as const).map((t) => (
              <div key={t} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
                <Chip tone={t === 'text' ? 'gold' : t === 'vision' ? 'alert' : 'danger'}>
                  {TIER_LABEL[t].name}
                </Chip>
                <span className="flex-1 text-[11.5px] text-mute">{TIER_LABEL[t].note}</span>
                <span className="font-mono text-[10px] text-mute-2">{TIER_LABEL[t].rough}</span>
              </div>
            ))}
          </div>

          <Btn variant="quiet" full onClick={() => { resetAiCounter(); toast('Counter reset.') }}>
            Reset the counter
          </Btn>
        </div>
      </Section>

      {/* ---- data ---- */}
      <Section title="Data" hint="Everything lives on this device. No account, no server.">
        <div className="space-y-2">
          <Btn
            full
            onClick={() => {
              seedPacking(DEFAULT_PACKING)
              toast('Packing list restored.')
            }}
          >
            Restore the default packing list
          </Btn>
          <Btn
            full
            onClick={() => {
              const blob = new Blob([localStorage.getItem('sg-trip-v1') ?? '{}'], {
                type: 'application/json',
              })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `sg-trip-backup-${new Date().toISOString().slice(0, 10)}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}
          >
            Export a backup
          </Btn>
          {confirmReset ? (
            <div className="flex gap-2">
              <Btn variant="quiet" className="flex-1" onClick={() => setConfirmReset(false)}>
                Keep it
              </Btn>
              <Btn
                variant="danger"
                className="flex-1"
                onClick={() => {
                  localStorage.removeItem('sg-trip-v1')
                  location.reload()
                }}
              >
                Erase everything
              </Btn>
            </div>
          ) : (
            <Btn variant="danger" full onClick={() => setConfirmReset(true)}>
              <Trash2 size={14} /> Erase all trip data
            </Btn>
          )}
        </div>
      </Section>

      <StaySheet open={stayOpen} onClose={() => setStayOpen(false)} toast={toast} />
    </div>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="card p-4">
      <h2 className="disp text-[22px] text-cream">{title}</h2>
      {hint && <p className="mt-1 mb-3 text-[11.5px] leading-snug text-mute">{hint}</p>}
      <div className={hint ? '' : 'mt-3'}>{children}</div>
    </div>
  )
}

function StaySection({ onOpen }: { onOpen: () => void }) {
  const stay = useTrip((s) => s.stay)
  const setStay = useTrip((s) => s.setStay)
  return (
    <Section
      title="Where you're staying"
      hint="A relative's guest house — free, and not a hotel. Optional: the app works fully without it, you just lose travel times from the door."
    >
      {stay ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Home size={14} className="text-walk" />
            <span className="text-[13.5px] text-cream">{stay.name}</span>
            {stay.area && <Chip tone="walk">{stay.area}</Chip>}
          </div>
          {stay.coords && (
            <MapView
              points={[{ id: 'stay', name: stay.name, coords: stay.coords, badge: '⌂', kind: 'stay' }]}
              height={140}
              interactive={false}
            />
          )}
          <div className="flex gap-2">
            <Btn className="flex-1" onClick={onOpen}>
              Change
            </Btn>
            <Btn variant="danger" onClick={() => setStay(null)}>
              <Trash2 size={13} />
            </Btn>
          </div>
        </div>
      ) : (
        <Btn full onClick={onOpen}>
          <Home size={14} /> Set the stay location
        </Btn>
      )}
    </Section>
  )
}

function StaySheet({
  open,
  onClose,
  toast,
}: {
  open: boolean
  onClose: () => void
  toast: (t: string) => void
}) {
  const setStay = useTrip((s) => s.setStay)
  const [name, setName] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [found, setFound] = useState<LatLng | null>(null)
  const [note, setNote] = useState('')

  const resolve = async () => {
    setBusy(true)
    setNote('')
    setFound(null)
    const raw = link.trim()
    try {
      let c = raw ? parseCoordsFromUrl(raw) : null
      if (c) setNote('Coordinates read from the link.')

      if (!c && raw && (isShortenedMapsLink(raw) || looksLikeUrl(raw))) {
        c = await resolveShortLink(raw)
        if (c) setNote('Short link resolved through a public proxy.')
      }
      if (!c && raw) {
        const n = nameFromMapsUrl(raw)
        if (n) {
          const g = await geocode(n)
          if (g[0]) {
            c = g[0].coords
            setNote(`Matched "${n}" on OpenStreetMap.`)
          }
        }
      }
      if (!c && name.trim()) {
        const g = await geocode(`${name.trim()}, Singapore`)
        if (g[0]) {
          c = g[0].coords
          setNote('Matched by name on OpenStreetMap.')
        }
      }
      if (!c) setNote('Could not place that. You can still save it without a pin.')
      setFound(c)
    } finally {
      setBusy(false)
    }
  }

  const save = (withCoords: boolean) => {
    const coords = withCoords ? found : null
    setStay({
      name: name.trim() || 'The guest house',
      coords,
      area: coords ? areaFor(coords) : null,
      rawInput: link.trim() || name.trim(),
    })
    toast(coords ? 'Stay location saved.' : 'Saved without a pin — travel times stay hidden.')
    setName('')
    setLink('')
    setFound(null)
    setNote('')
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Your stay" subtitle="Guest house — not a hotel" full>
      <div className="space-y-4">
        <Field label="What to call it">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Anil chettan's place, Bedok"
            className={inputCls}
          />
        </Field>
        <Field
          label="Google Maps link (optional)"
          hint="A full link has coordinates in it. A short maps.app.goo.gl link does not — the app will try to follow the redirect, and fall back to a name search."
        >
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://…"
            className={inputCls}
            inputMode="url"
          />
        </Field>
        <Btn full onClick={resolve} disabled={busy || (!name.trim() && !link.trim())}>
          {busy ? <Spinner size={14} /> : <Search size={14} />} Find it
        </Btn>
        {note && <p className="text-[12px] leading-snug text-mute">{note}</p>}
        {found && (
          <>
            <MapView
              points={[{ id: 's', name: name || 'Your stay', coords: found, badge: '⌂', kind: 'stay' }]}
              height={190}
            />
            <Chip tone="walk">{areaFor(found)}</Chip>
          </>
        )}
        <div className="flex gap-2">
          <Btn variant="quiet" className="flex-1" onClick={() => save(false)}>
            Save without a pin
          </Btn>
          <Btn variant="gold" className="flex-1" onClick={() => save(true)} disabled={!found}>
            Save with pin
          </Btn>
        </div>
      </div>
    </Sheet>
  )
}
