import { useState } from 'react'
import { Check, Link2, Search, Sparkles, TriangleAlert } from 'lucide-react'
import { Btn, Chip, Field, inputCls, Sheet, Spinner } from './ui'
import { MapView } from './LazyMap'
import { areaFor } from '../data/places'
import { useAi } from '../lib/hooks'
import { useTrip } from '../lib/store'
import { geocode, nameFromMapsUrl, resolveShortLink, type GeocodeHit } from '../lib/free'
import {
  isNearSingapore,
  isShortenedMapsLink,
  looksLikeUrl,
  parseCoordsFromUrl,
} from '../lib/geo'
import { BudgetDeclined, FIND_PLACE_SYSTEM, parseFindPlaceReply, TIER_LABEL } from '../lib/ai'
import type { LatLng, Place, PlaceCategory } from '../lib/types'

type Step = { line: string; state: 'ok' | 'fail' | 'skip' }

const CATEGORIES: { value: PlaceCategory; label: string }[] = [
  { value: 'sights', label: 'Sight' },
  { value: 'nature', label: 'Nature' },
  { value: 'hawker', label: 'Hawker' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'nightlife', label: 'After dark' },
]

export function AddPlaceSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  onAdded: (p: Place, msg: string) => void
}) {
  const addCustomPlace = useTrip((s) => s.addCustomPlace)
  const { call, hasKey } = useAi()

  const [name, setName] = useState('')
  const [link, setLink] = useState('')
  const [category, setCategory] = useState<PlaceCategory>('sights')
  const [busy, setBusy] = useState(false)
  const [steps, setSteps] = useState<Step[]>([])
  const [hits, setHits] = useState<GeocodeHit[]>([])
  const [found, setFound] = useState<{ coords: LatLng; label: string; source: Place['source'] } | null>(null)
  const [error, setError] = useState('')
  const [aiOffered, setAiOffered] = useState(false)

  const reset = () => {
    setSteps([])
    setHits([])
    setFound(null)
    setError('')
    setAiOffered(false)
  }

  const closeAll = () => {
    setName('')
    setLink('')
    reset()
    onClose()
  }

  const accept = (coords: LatLng, label: string, source: Place['source']) => {
    setFound({ coords, label, source })
    setHits([])
  }

  /** Free paths only, in order of reliability. AI is never reached from here. */
  const resolve = async () => {
    reset()
    setBusy(true)
    const log: Step[] = []
    const push = (line: string, state: Step['state']) => {
      log.push({ line, state })
      setSteps([...log])
    }

    try {
      const raw = link.trim()

      if (raw) {
        const direct = parseCoordsFromUrl(raw)
        if (direct) {
          push('Coordinates read straight out of the link', 'ok')
          accept(direct, name.trim() || 'Pinned location', 'url')
          return
        }
        push('No coordinates in the link itself', 'skip')

        if (isShortenedMapsLink(raw) || looksLikeUrl(raw)) {
          push('Short link — asking a public proxy to follow the redirect…', 'skip')
          const viaProxy = await resolveShortLink(raw)
          if (viaProxy) {
            push('Redirect resolved', 'ok')
            accept(viaProxy, name.trim() || 'Pinned location', 'proxy')
            return
          }
          push('Proxy could not resolve it', 'fail')
        }

        const fromUrl = nameFromMapsUrl(raw)
        if (fromUrl) {
          push(`Place name in the link: "${fromUrl}"`, 'ok')
          const g = await geocode(fromUrl)
          if (g.length) {
            push(`${g.length} match${g.length > 1 ? 'es' : ''} from OpenStreetMap`, 'ok')
            setHits(g)
            setAiOffered(true)
            return
          }
          push('OpenStreetMap had nothing for it', 'fail')
        }
      }

      const q = name.trim()
      if (q) {
        push(`Searching OpenStreetMap for "${q}"`, 'skip')
        const g = await geocode(`${q}, Singapore`)
        if (g.length) {
          push(`${g.length} match${g.length > 1 ? 'es' : ''}`, 'ok')
          setHits(g)
          setAiOffered(true)
          return
        }
        push('No free match found', 'fail')
      }

      if (!raw && !q) {
        setError('Give it a name, a Google Maps link, or both.')
      }
      setAiOffered(true)
    } catch {
      setError('Something went wrong looking that up.')
      setAiOffered(true)
    } finally {
      setBusy(false)
    }
  }

  /** Explicitly opt-in, explicitly the most expensive tier in the app. */
  const askAi = async () => {
    setBusy(true)
    setError('')
    try {
      const q = [name.trim(), link.trim()].filter(Boolean).join(' — ')
      const r = await call({
        tier: 'search',
        webSearch: true,
        maxTokens: 500,
        system: FIND_PLACE_SYSTEM,
        messages: [{ role: 'user', content: `Find this place in Singapore: ${q}` }],
      })
      const parsed = parseFindPlaceReply(r.text)
      if (parsed) {
        setSteps((s) => [...s, { line: `Found by AI web search (${r.searches} search${r.searches === 1 ? '' : 'es'})`, state: 'ok' }])
        accept({ lat: parsed.lat, lng: parsed.lng }, parsed.name || name.trim() || 'Pinned location', 'ai')
      } else {
        setError('The AI could not place it confidently either. Try a full Google Maps link.')
      }
    } catch (e) {
      if (!(e instanceof BudgetDeclined)) {
        setError(e instanceof Error ? e.message : 'AI lookup failed.')
      }
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    if (!found) return
    const area = areaFor(found.coords)
    const place: Place = {
      id: `custom-${Math.random().toString(36).slice(2, 9)}`,
      name: name.trim() || found.label,
      area,
      category,
      coords: found.coords,
      blurb: 'Added by you.',
      typicalMin: 90,
      custom: true,
      source: found.source,
    }
    addCustomPlace(place)
    onAdded(place, `${place.name} saved under ${area}.`)
    closeAll()
  }

  const offshore = found && !isNearSingapore(found.coords)

  return (
    <Sheet open={open} onClose={closeAll} title="Add your own spot" subtitle="Name it, paste a maps link, or both" full>
      <div className="space-y-4">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ah Kow Mushroom Minced Pork Mee"
            className={inputCls}
          />
        </Field>

        <Field
          label="Google Maps link"
          hint="A full maps.google.com link has the coordinates in it. A shortened maps.app.goo.gl link does not — only the redirect knows, so that path is best-effort."
        >
          <div className="relative">
            <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute-2" />
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://maps.app.goo.gl/…"
              className={inputCls + ' pl-9'}
              inputMode="url"
            />
          </div>
        </Field>

        <Btn full onClick={resolve} disabled={busy || (!name.trim() && !link.trim())}>
          {busy ? <Spinner /> : <Search size={14} />} Find it — free lookups
        </Btn>

        {steps.length > 0 && (
          <div className="card space-y-1.5 p-3">
            {steps.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-[11.5px] leading-snug">
                <span
                  className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                    s.state === 'ok' ? 'bg-ok' : s.state === 'fail' ? 'bg-danger' : 'bg-mute-2'
                  }`}
                />
                <span className={s.state === 'fail' ? 'text-mute-2' : 'text-mute'}>{s.line}</span>
              </div>
            ))}
          </div>
        )}

        {hits.length > 0 && (
          <div className="space-y-2">
            <div className="lbl">Pick the right one</div>
            {hits.map((h, i) => (
              <button
                key={i}
                onClick={() => accept(h.coords, h.name, 'geocode')}
                className="card w-full p-3 text-left active:scale-[0.99] transition-transform"
              >
                <div className="text-[13px] text-cream line-clamp-2">{h.name}</div>
                <div className="lbl mt-1">{h.kind}</div>
              </button>
            ))}
          </div>
        )}

        {found && (
          <div className="space-y-2">
            <div className="lbl">Confirm the pin</div>
            <MapView
              points={[{ id: 'p', name: found.label, coords: found.coords, badge: '★' }]}
              height={200}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="ok">
                <Check size={10} /> {areaFor(found.coords)}
              </Chip>
              <Chip>{found.coords.lat.toFixed(5)}, {found.coords.lng.toFixed(5)}</Chip>
              <Chip tone="mute">via {found.source}</Chip>
            </div>
            {offshore && (
              <div className="flex items-start gap-2 rounded-xl border border-alert/40 bg-alert/8 p-3 text-[12px] leading-snug text-alert">
                <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                That pin is outside Singapore. Check it before saving.
              </div>
            )}
          </div>
        )}

        {found && (
          <Field label="What kind of place">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[12px] ${
                    category === c.value ? 'border-gold bg-gold/12 text-gold' : 'border-line text-mute'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </Field>
        )}

        {aiOffered && !found && (
          <div className="card space-y-2 p-3">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-gold" />
              <span className="text-[13px] text-cream">Still stuck?</span>
              <Chip tone="alert" className="ml-auto">
                {TIER_LABEL.search.name} · {TIER_LABEL.search.rough}
              </Chip>
            </div>
            <p className="text-[11.5px] leading-snug text-mute">
              Ask Claude to search the web for it. This is the priciest call in the app — it is billed
              per search on top of tokens, so it only runs when you tap it.
            </p>
            <Btn full onClick={askAi} disabled={busy || !hasKey}>
              {busy ? <Spinner /> : <Sparkles size={14} />}{' '}
              {hasKey ? 'Ask AI to find it' : 'Add an API key in Settings first'}
            </Btn>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/8 p-3 text-[12px] text-danger">
            {error}
          </div>
        )}

        {found && (
          <Btn variant="gold" full onClick={save}>
            Save this spot
          </Btn>
        )}
      </div>
    </Sheet>
  )
}
