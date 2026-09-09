import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Luggage, Plus, ShieldQuestion, Trash2, X } from 'lucide-react'
import { Btn, Chip, inputCls, Segmented, spring } from '../components/ui'
import { DEFAULT_PACKING, useTrip } from '../lib/store'
import { useAllItems, useWeather } from '../lib/hooks'
import { dateForDay, dayCount, ymd } from '../lib/trip'

const CUSTODY_DEFAULTS = [
  'Passports',
  'Concert tickets',
  'USS tickets',
  'SIM / eSIM QR codes',
  'Cash float (SGD)',
  'Power bank',
  'Guest house keys',
]

export function Kit({ toast }: { toast: (t: string) => void }) {
  const [tab, setTab] = useState<'packing' | 'custody' | 'basics'>('packing')

  return (
    <div className="px-4 pb-6">
      <Segmented
        id="kit"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'packing', label: 'Packing' },
          { value: 'custody', label: "Who's got it" },
          { value: 'basics', label: 'Basics' },
        ]}
      />
      <div className="mt-4">
        {tab === 'packing' && <Packing toast={toast} />}
        {tab === 'custody' && <Custody toast={toast} />}
        {tab === 'basics' && <Basics />}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ packing

function Packing({ toast }: { toast: (t: string) => void }) {
  const packing = useTrip((s) => s.packing)
  const togglePacking = useTrip((s) => s.togglePacking)
  const addPacking = useTrip((s) => s.addPacking)
  const removePacking = useTrip((s) => s.removePacking)
  const seedPacking = useTrip((s) => s.seedPacking)
  const setup = useTrip((s) => s.setup)
  const all = useAllItems()
  const weather = useWeather()
  const [draft, setDraft] = useState('')

  /** Which activity-linked reasons are actually on the plan. */
  const active = useMemo(() => {
    const ids = new Set(all.map((i) => i.placeId).filter(Boolean) as string[])
    const s = new Set<string>(['entry', 'daily', 'money'])
    if (ids.has('uss')) s.add('uss')
    if (ids.has('night-safari') || ids.has('singapore-zoo')) s.add('night-safari')
    if (all.some((i) => i.id === 'fx-concert')) s.add('concert')
    if (
      ids.has('siloso') ||
      ids.has('palawan') ||
      ids.has('east-coast-park') ||
      ids.has('uss')
    )
      s.add('swim')
    return s
  }, [all])

  const rainyDays = useMemo(() => {
    if (!weather) return 0
    const days = dayCount(setup)
    let n = 0
    for (let d = 1; d <= days; d++) {
      const w = weather.find((x) => x.date === ymd(dateForDay(setup, d)))
      if (w && w.rainChance >= 60) n++
    }
    return n
  }, [weather, setup])

  const done = packing.filter((p) => p.packed).length

  if (packing.length === 0) {
    return (
      <div className="card p-5 text-center">
        <Luggage size={22} className="mx-auto mb-3 text-mute-2" />
        <p className="text-[13px] leading-relaxed text-mute">
          A starter list, tuned to what is actually on your plan — water rides at Universal,
          mosquitoes at Night Safari, UK plug sockets.
        </p>
        <Btn
          variant="gold"
          full
          className="mt-3"
          onClick={() => {
            seedPacking(DEFAULT_PACKING)
            toast('Packing list ready.')
          }}
        >
          Build my list
        </Btn>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="card p-3.5">
        <div className="flex items-end justify-between">
          <div>
            <div className="lbl">Packed</div>
            <div className="disp text-[30px] leading-none text-gold">
              {done}
              <span className="text-[16px] text-mute">/{packing.length}</span>
            </div>
          </div>
          {rainyDays > 0 && <Chip tone="transit">{rainyDays} wet day{rainyDays === 1 ? '' : 's'} forecast</Chip>}
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
          <motion.div
            className="h-full rounded-full bg-gold"
            initial={{ width: 0 }}
            animate={{ width: `${(done / packing.length) * 100}%` }}
            transition={spring.soft}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              addPacking(draft.trim())
              setDraft('')
            }
          }}
          placeholder="Add something…"
          className={inputCls + ' flex-1'}
        />
        <Btn
          onClick={() => {
            if (draft.trim()) {
              addPacking(draft.trim())
              setDraft('')
            }
          }}
        >
          <Plus size={14} />
        </Btn>
      </div>

      <div className="space-y-1.5">
        <AnimatePresence initial={false}>
          {packing.map((p) => {
            const relevant = !p.reason || active.has(p.reason)
            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={spring.soft}
                className="card flex items-center gap-3 p-3"
              >
                <button
                  onClick={() => togglePacking(p.id)}
                  aria-label={p.packed ? 'Unpack' : 'Pack'}
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors ${
                    p.packed ? 'border-ok bg-ok/20 text-ok' : 'border-line-2 text-transparent'
                  }`}
                >
                  <Check size={13} />
                </button>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-[13.5px] leading-snug ${
                      p.packed ? 'text-mute-2 line-through' : 'text-cream'
                    }`}
                  >
                    {p.text}
                  </div>
                  {p.reason && relevant && p.reason !== 'daily' && (
                    <Chip tone="gold" className="mt-1">
                      for {p.reason.replace(/-/g, ' ')}
                    </Chip>
                  )}
                  {p.reason && !relevant && (
                    <Chip className="mt-1">not on the plan — {p.reason.replace(/-/g, ' ')}</Chip>
                  )}
                </div>
                <button onClick={() => removePacking(p.id)} aria-label="Remove" className="shrink-0 text-mute-2">
                  <X size={14} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ custody

function Custody({ toast }: { toast: (t: string) => void }) {
  const custody = useTrip((s) => s.custody)
  const setCustody = useTrip((s) => s.setCustody)
  const removeCustody = useTrip((s) => s.removeCustody)
  const [what, setWhat] = useState('')
  const [who, setWho] = useState('')

  const missing = CUSTODY_DEFAULTS.filter(
    (d) => !custody.some((c) => c.what.toLowerCase() === d.toLowerCase()),
  )

  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-snug text-mute">
        Three people, one set of tickets. Say out loud who is carrying what, then put it here — it
        settles the argument at the stadium gate.
      </p>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {custody.map((c) => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={spring.soft}
              className="card flex items-center gap-3 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] text-cream">{c.what}</div>
                <div className="lbl mt-0.5">
                  {new Date(c.updatedAt).toLocaleString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              <Chip tone="gold">{c.who}</Chip>
              <button onClick={() => removeCustody(c.id)} aria-label="Remove" className="text-mute-2">
                <Trash2 size={13} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="card space-y-2 p-3.5">
        <div className="lbl">Hand something over</div>
        <div className="flex gap-2">
          <input
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            placeholder="What"
            className={inputCls + ' flex-1'}
          />
          <input
            value={who}
            onChange={(e) => setWho(e.target.value)}
            placeholder="Who"
            className={inputCls + ' w-28'}
          />
        </div>
        {missing.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {missing.map((m) => (
              <button
                key={m}
                onClick={() => setWhat(m)}
                className="rounded-lg border border-line px-2 py-1 text-[11px] text-mute"
              >
                {m}
              </button>
            ))}
          </div>
        )}
        <Btn
          full
          variant="gold"
          disabled={!what.trim() || !who.trim()}
          onClick={() => {
            setCustody(what.trim(), who.trim())
            toast(`${what.trim()} → ${who.trim()}.`)
            setWhat('')
            setWho('')
          }}
        >
          Record it
        </Btn>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ basics

const FACTS: { title: string; lines: string[] }[] = [
  {
    title: 'Getting around',
    lines: [
      'Tap in and out with any contactless Visa/Mastercard — no card to buy, same fare as EZ-Link.',
      'Each person needs their own card. One card cannot tap two people through.',
      'Trains run roughly 05:30 to just past midnight. After that it is night buses or a taxi.',
      'Grab is the ride-hail everyone uses; street taxis take cards too.',
    ],
  },
  {
    title: 'Hawker centres',
    lines: [
      'A packet of tissues on a seat means it is taken. That is "choping", and it is binding.',
      'Return your tray — it is enforced with fines.',
      'Many stalls are cash-only or have a minimum for PayNow. Keep small notes.',
      'A meal runs about S$4–8. A drink about S$2.',
    ],
  },
  {
    title: 'Money',
    lines: [
      'Tipping is not expected anywhere. Restaurants already add 10% service and 9% GST.',
      'GST refund at the airport applies from S$100 at participating shops — keep receipts.',
      'Tap water is safe to drink. Refill bottles instead of buying them.',
    ],
  },
  {
    title: 'Rules worth knowing',
    lines: [
      'No eating or drinking on the MRT, including water.',
      'Chewing gum is not sold. Bringing personal amounts in is fine.',
      'Smoking is banned nearly everywhere outdoors except marked yellow boxes.',
      'Jaywalking is fined. Use the crossings.',
    ],
  },
  {
    title: 'If something goes wrong',
    lines: [
      'Police 999 · Ambulance and fire 995 · Non-emergency ambulance 1777.',
      'Indian High Commission, Singapore: +65 6737 6777.',
      'Changi lost and found is per-terminal — ask at any information counter.',
    ],
  },
  {
    title: 'A few words',
    lines: [
      'Makan — to eat. "Go makan?"',
      'Can / cannot — yes that works / no it does not. A complete sentence on its own.',
      'Kopi — coffee with condensed milk. Kopi-O is black with sugar. Kopi-C uses evaporated milk. Add "kosong" for no sugar.',
      'Da bao (dah-bao) — takeaway.',
      'Terima kasih (Malay) / Xie xie (Mandarin) / Nandri (Tamil) — thank you.',
    ],
  },
]

function Basics() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[12px] text-mute">
        <ShieldQuestion size={14} /> Works with no signal — all of this is stored on the device.
      </div>
      {FACTS.map((f) => (
        <div key={f.title} className="card p-4">
          <h3 className="disp text-[20px] text-cream">{f.title}</h3>
          <ul className="mt-2 space-y-1.5">
            {f.lines.map((l, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-gold/70" />
                <span className="text-[12.5px] leading-relaxed text-mute">{l}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
