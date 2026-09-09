import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Crosshair, Link2, MapPin, Search, Sparkles, TriangleAlert } from 'lucide-react'
import { Btn, Chip, Field, inputCls, Segmented, spring, Spinner } from './ui'
import { MapView } from './LazyMap'
import { areaFor } from '../data/places'
import { useAi } from '../lib/hooks'
import {
  findPlace,
  isPostalCode,
  nameFromMapsUrl,
  resolveShortLink,
  type GeocodeHit,
} from '../lib/free'
import {
  isNearSingapore,
  isShortenedMapsLink,
  looksLikeUrl,
  parseCoordsFromUrl,
} from '../lib/geo'
import { BudgetDeclined, FIND_PLACE_SYSTEM, parseFindPlaceReply, TIER_LABEL } from '../lib/ai'
import type { LatLng, Place } from '../lib/types'

export interface Resolved {
  coords: LatLng
  label: string
  source: NonNullable<Place['source']>
}

type Mode = 'search' | 'map' | 'link'

/**
 * Three independent ways to pin a location, in order of how well they
 * actually work. Search covers almost everything, the map always works, and
 * pasting a link is last because a shortened Google Maps link contains no
 * coordinates at all — only the server that issued it knows where it points.
 */
export function LocationFinder({
  value,
  onChange,
  placeholder = 'Name, address, or 6-digit postal code',
}: {
  value: Resolved | null
  onChange: (r: Resolved | null) => void
  placeholder?: string
}) {
  const [mode, setMode] = useState<Mode>('search')
  const { call, hasKey } = useAi()

  // search
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<GeocodeHit[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const seq = useRef(0)

  // map
  const [locating, setLocating] = useState(false)

  // link
  const [link, setLink] = useState('')
  const [steps, setSteps] = useState<{ line: string; state: 'ok' | 'fail' | 'skip' }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [aiOffered, setAiOffered] = useState(false)

  // Debounced live search — every source here is free, so typing is cheap.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3 && !isPostalCode(q)) {
      setHits([])
      setSearched(false)
      return
    }
    const mine = ++seq.current
    setSearching(true)
    const t = setTimeout(async () => {
      const r = await findPlace(q)
      if (seq.current !== mine) return
      setHits(r)
      setSearched(true)
      setSearching(false)
    }, 350)
    return () => {
      clearTimeout(t)
      if (seq.current === mine) setSearching(false)
    }
  }, [query])

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setError('This device has no geolocation.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onChange({
          coords: { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) },
          label: 'Where I am now',
          source: 'manual',
        })
        setLocating(false)
      },
      (e) => {
        setError(
          e.code === e.PERMISSION_DENIED
            ? 'Location permission denied — tap the map instead.'
            : 'Could not get a fix. Tap the map instead.',
        )
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  const resolveLink = async () => {
    setSteps([])
    setError('')
    setAiOffered(false)
    setBusy(true)
    const log: typeof steps = []
    const push = (line: string, state: 'ok' | 'fail' | 'skip') => {
      log.push({ line, state })
      setSteps([...log])
    }
    try {
      const raw = link.trim()
      if (!raw) {
        setError('Paste a link, or some coordinates.')
        return
      }

      const direct = parseCoordsFromUrl(raw)
      if (direct) {
        push('Coordinates read straight out of what you pasted', 'ok')
        onChange({ coords: direct, label: 'Pinned location', source: 'url' })
        return
      }
      push('No coordinates in the text itself', 'skip')

      if (isShortenedMapsLink(raw) || looksLikeUrl(raw)) {
        push('Short link — asking a public proxy to follow the redirect…', 'skip')
        const viaProxy = await resolveShortLink(raw)
        if (viaProxy) {
          push('Redirect resolved', 'ok')
          onChange({ coords: viaProxy, label: 'Pinned location', source: 'proxy' })
          return
        }
        push('The proxy could not resolve it — this often fails', 'fail')
      }

      const named = nameFromMapsUrl(raw)
      if (named) {
        push(`Place name found in the link: "${named}"`, 'ok')
        const g = await findPlace(named)
        if (g.length) {
          push(`Matched "${g[0].name}"`, 'ok')
          onChange({ coords: g[0].coords, label: g[0].name, source: 'geocode' })
          return
        }
        push('No match for that name', 'fail')
      }

      setAiOffered(true)
      setError('Could not get a location out of that link. Try Search or Drop a pin instead.')
    } finally {
      setBusy(false)
    }
  }

  const askAi = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await call({
        tier: 'search',
        webSearch: true,
        maxTokens: 500,
        system: FIND_PLACE_SYSTEM,
        messages: [
          { role: 'user', content: `Find this place in Singapore: ${query || link}` },
        ],
      })
      const parsed = parseFindPlaceReply(r.text)
      if (parsed) {
        onChange({
          coords: { lat: parsed.lat, lng: parsed.lng },
          label: parsed.name || 'Pinned location',
          source: 'ai',
        })
      } else {
        setError('The AI could not place it confidently either.')
      }
    } catch (e) {
      if (!(e instanceof BudgetDeclined)) {
        setError(e instanceof Error ? e.message : 'AI lookup failed.')
      }
    } finally {
      setBusy(false)
    }
  }

  const offshore = value && !isNearSingapore(value.coords)

  return (
    <div className="space-y-3">
      <Segmented
        id="locmode"
        value={mode}
        onChange={(m) => {
          setMode(m)
          setError('')
        }}
        options={[
          { value: 'search', label: 'Search' },
          { value: 'map', label: 'Drop a pin' },
          { value: 'link', label: 'Link' },
        ]}
      />

      {/* ------------------------------------------------ search */}
      {mode === 'search' && (
        <div className="space-y-2">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mute-2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className={inputCls + ' pl-10'}
              autoComplete="off"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <Spinner size={13} />
              </span>
            )}
          </div>
          <p className="text-[11px] leading-snug text-mute-2">
            Searches Singapore&apos;s official address register first, so building names, HDB
            blocks and postal codes all resolve exactly. A postal code is the surest thing to use.
          </p>

          <AnimatePresence initial={false}>
            {hits.map((h, i) => (
              <motion.button
                key={`${h.name}-${i}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring.soft, delay: Math.min(i * 0.03, 0.15) }}
                onClick={() =>
                  onChange({ coords: h.coords, label: h.name, source: 'geocode' })
                }
                className={`card w-full p-3 text-left ${
                  value?.label === h.name ? 'border-gold/60' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <MapPin size={13} className="mt-0.5 shrink-0 text-mute-2" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-cream">{h.name}</div>
                    {h.address && (
                      <div className="mt-0.5 text-[11.5px] leading-snug text-mute">
                        {h.address}
                      </div>
                    )}
                  </div>
                  {h.postal && <Chip tone="mute">{h.postal}</Chip>}
                </div>
              </motion.button>
            ))}
          </AnimatePresence>

          {searched && !searching && hits.length === 0 && (
            <div className="space-y-2">
              <p className="text-[12px] text-mute">
                Nothing found. Try the building name, or switch to <b>Drop a pin</b>.
              </p>
              <AiFallback
                hasKey={hasKey}
                busy={busy}
                onAsk={askAi}
              />
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------ map */}
      {mode === 'map' && (
        <div className="space-y-2">
          <p className="text-[11.5px] leading-snug text-mute">
            Tap anywhere on the map to drop the pin. No lookups, nothing to fail — this always
            works, even with no signal.
          </p>
          <MapView
            points={
              value
                ? [{ id: 'picked', name: value.label, coords: value.coords, badge: '★' }]
                : []
            }
            height={280}
            fit={!value}
            onPick={(c) =>
              onChange({ coords: c, label: value?.label || 'Dropped pin', source: 'manual' })
            }
          />
          <Btn full onClick={useMyLocation} disabled={locating}>
            {locating ? <Spinner size={14} /> : <Crosshair size={14} />} Use where I am now
          </Btn>
        </div>
      )}

      {/* ------------------------------------------------ link */}
      {mode === 'link' && (
        <div className="space-y-2">
          <Field
            label="Google Maps link or coordinates"
            hint="A maps.app.goo.gl short link holds no coordinates — only Google's server knows where it points, so this is best-effort. In Google Maps you can long-press the spot and copy the numbers it shows; pasting those always works."
          >
            <div className="relative">
              <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute-2" />
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…  or  1.2834, 103.8607"
                className={inputCls + ' pl-9'}
                inputMode="url"
              />
            </div>
          </Field>
          <Btn full onClick={resolveLink} disabled={busy || !link.trim()}>
            {busy ? <Spinner size={14} /> : <Search size={14} />} Try to resolve it
          </Btn>

          {steps.length > 0 && (
            <div className="card space-y-1.5 p-3">
              {steps.map((st, i) => (
                <div key={i} className="flex items-start gap-2 text-[11.5px] leading-snug">
                  <span
                    className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                      st.state === 'ok' ? 'bg-ok' : st.state === 'fail' ? 'bg-danger' : 'bg-mute-2'
                    }`}
                  />
                  <span className={st.state === 'fail' ? 'text-mute-2' : 'text-mute'}>{st.line}</span>
                </div>
              ))}
            </div>
          )}

          {aiOffered && <AiFallback hasKey={hasKey} busy={busy} onAsk={askAi} />}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/8 p-3 text-[12px] leading-snug text-danger">
          {error}
        </div>
      )}

      {/* ------------------------------------------------ confirm */}
      {value && (
        <div className="space-y-2">
          <div className="lbl">Confirm the pin</div>
          {mode !== 'map' && (
            <MapView
              points={[{ id: 'p', name: value.label, coords: value.coords, badge: '★' }]}
              height={170}
            />
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone="ok">
              <Check size={10} /> {areaFor(value.coords)}
            </Chip>
            <Chip>
              {value.coords.lat.toFixed(5)}, {value.coords.lng.toFixed(5)}
            </Chip>
            <Chip tone="mute">via {value.source}</Chip>
          </div>
          {offshore && (
            <div className="flex items-start gap-2 rounded-xl border border-alert/40 bg-alert/8 p-3 text-[12px] leading-snug text-alert">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" />
              That pin is outside Singapore. Check it before saving.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AiFallback({
  hasKey,
  busy,
  onAsk,
}: {
  hasKey: boolean
  busy: boolean
  onAsk: () => void
}) {
  return (
    <div className="card space-y-2 p-3">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-gold" />
        <span className="text-[13px] text-cream">Still stuck?</span>
        <Chip tone="alert" className="ml-auto">
          {TIER_LABEL.search.name} · {TIER_LABEL.search.rough}
        </Chip>
      </div>
      <p className="text-[11.5px] leading-snug text-mute">
        The priciest call in the app — billed per search on top of tokens. It only runs when you
        tap it.
      </p>
      <Btn full onClick={onAsk} disabled={busy || !hasKey}>
        {busy ? <Spinner size={14} /> : <Sparkles size={14} />}{' '}
        {hasKey ? 'Ask AI to find it' : 'Add an API key in Settings first'}
      </Btn>
    </div>
  )
}
