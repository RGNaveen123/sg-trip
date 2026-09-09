import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  HandCoins,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { Btn, Chip, Empty, Field, inputCls, Segmented, Sheet, spring, Spinner, Ticker } from '../components/ui'
import { useTrip } from '../lib/store'
import { useAi, useFx } from '../lib/hooks'
import { dateForDay, dayCount, formatDayLabel, ymd } from '../lib/trip'
import { BudgetDeclined, parseReceiptReply, RECEIPT_SYSTEM, TIER_LABEL } from '../lib/ai'
import { buildLedger, formatSgd, settle, toMoney } from '../lib/settle'
import type { Expense, ExpenseCategory, ExpenseFor } from '../lib/types'

const CATS: { value: ExpenseCategory; label: string; color: string }[] = [
  { value: 'transport', label: 'Transport', color: '#63B3E0' },
  { value: 'food', label: 'Food', color: '#EE9A45' },
  { value: 'shopping', label: 'Shopping', color: '#C98BD4' },
  { value: 'attractions', label: 'Attractions', color: '#5CC9A0' },
  { value: 'misc', label: 'Misc', color: '#8FA3B8' },
]
const CAT = Object.fromEntries(CATS.map((c) => [c.value, c])) as Record<
  ExpenseCategory,
  (typeof CATS)[number]
>

/**
 * An expense restored from an older build — or from a hand-edited backup —
 * can carry a category this build has never heard of. Fall back to Misc
 * rather than letting an undefined lookup take the whole screen down.
 */
const catOf = (c: ExpenseCategory | string) => CAT[c as ExpenseCategory] ?? CAT.misc

export function Money({ toast, goSettings }: { toast: (t: string) => void; goSettings: () => void }) {
  const expenses = useTrip((s) => s.expenses)
  const removeExpense = useTrip((s) => s.removeExpense)
  const people = useTrip((s) => s.people)
  const setup = useTrip((s) => s.setup)
  const { fx, loading: fxLoading, refresh } = useFx()

  const [filter, setFilter] = useState<ExpenseCategory | null>(null)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [adding, setAdding] = useState(false)

  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const byCat = useMemo(() => {
    const m = new Map<ExpenseCategory, number>()
    for (const e of expenses) m.set(e.category, (m.get(e.category) ?? 0) + e.amount)
    return CATS.map((c) => ({ ...c, amount: m.get(c.value) ?? 0 })).filter((c) => c.amount > 0)
  }, [expenses])

  const shown = filter ? expenses.filter((e) => e.category === filter) : expenses

  // One pass over every expense gives both "what did this cost me" and the
  // list of payments that squares the group up.
  const ledger = useMemo(() => buildLedger(expenses, people), [expenses, people])
  const transfers = useMemo(() => settle(ledger.net), [ledger])
  const me = people[0] ?? 'Me'
  const myShare = toMoney(ledger.owed[me] ?? 0)

  return (
    <div className="px-4 pb-6">
      {/* ---- headline ---- */}
      <div className="card p-4">
        <div className="lbl">Spent so far</div>
        <div className="mt-1 flex items-end gap-2">
          <span className="disp text-[15px] text-mute">S$</span>
          <Ticker value={total.toFixed(2)} className="disp text-[44px] leading-[0.85] text-gold" />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {fx ? (
            <Chip tone="mute">
              ≈ {fx.quote} {(total * fx.rate).toLocaleString(undefined, { maximumFractionDigits: 0 })} · rate{' '}
              {fx.rate.toFixed(2)} · {fx.asOf}
            </Chip>
          ) : (
            <Chip tone="mute">{fxLoading ? 'fetching rate…' : 'rate unavailable'}</Chip>
          )}
          <button onClick={() => refresh()} aria-label="Refresh rate" className="text-mute-2">
            <RefreshCw size={12} className={fxLoading ? 'animate-spin' : ''} />
          </button>
          <Chip tone="gold" className="ml-auto">
            your share S${myShare.toFixed(2)}
          </Chip>
        </div>
      </div>

      {/* ---- breakdown ---- */}
      {byCat.length > 0 && (
        <div className="card mt-3 flex items-center gap-4 p-4">
          <Donut data={byCat} total={total} active={filter} onPick={(c) => setFilter(filter === c ? null : c)} />
          <div className="min-w-0 flex-1 space-y-1.5">
            {byCat.map((c) => {
              const on = filter === c.value
              return (
                <button
                  key={c.value}
                  onClick={() => setFilter(on ? null : c.value)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors ${
                    on ? 'bg-white/6' : ''
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: c.color, opacity: filter && !on ? 0.35 : 1 }}
                  />
                  <span className={`flex-1 text-[12.5px] leading-snug ${on ? 'text-cream' : 'text-mute'}`}>
                    {c.label}
                  </span>
                  <span className="font-mono text-[11px] text-cream">S${c.amount.toFixed(0)}</span>
                  <span className="w-9 text-right font-mono text-[10px] text-mute-2">
                    {Math.round((c.amount / total) * 100)}%
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {expenses.length > 0 && (
        <SettleUp ledger={ledger} transfers={transfers} goSettings={goSettings} />
      )}

      <Btn full variant="gold" className="mt-3" onClick={() => setAdding(true)}>
        <Plus size={15} /> Log an expense
      </Btn>

      {/* ---- list ---- */}
      <div className="mt-4">
        {filter && (
          <button
            onClick={() => setFilter(null)}
            className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-gold"
          >
            <X size={11} /> clear {catOf(filter).label} filter
          </button>
        )}

        {shown.length === 0 ? (
          <Empty
            icon={<Wallet size={22} />}
            title={filter ? 'Nothing in that category' : 'No expenses yet'}
            body="Log as you go — a hawker lunch, an EZ-Link top-up, the luge tickets. Splits and per-person shares are handled here too."
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {shown.map((e) => (
                <motion.div
                  key={e.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={spring.soft}
                  className="card flex items-center gap-3 p-3"
                >
                  <span
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ background: catOf(e.category).color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] leading-snug text-cream">
                      {e.label || catOf(e.category).label}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[10px] text-mute-2">{e.date}</span>
                      {e.forWhom === 'split' && (
                        <Chip tone="transit">
                          <Users size={9} />
                          {e.shares?.length
                            ? `custom ×${e.shares.length}`
                            : `÷${e.splitCount ?? 3} = S$${(e.amount / (e.splitCount ?? 3)).toFixed(2)}`}
                        </Chip>
                      )}
                      {e.forWhom === 'onbehalf' && <Chip tone="alert">paid for others</Chip>}
                      {e.paidBy && <Chip tone="mute">{e.paidBy} paid</Chip>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="disp text-[19px] text-cream">S${e.amount.toFixed(2)}</div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button onClick={() => setEditing(e)} aria-label="Edit" className="text-mute-2">
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => {
                        removeExpense(e.id)
                        toast('Expense deleted.')
                      }}
                      aria-label="Delete"
                      className="text-mute-2"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <ExpenseSheet
        open={adding || Boolean(editing)}
        editing={editing}
        onClose={() => {
          setAdding(false)
          setEditing(null)
        }}
        toast={toast}
        goSettings={goSettings}
        days={dayCount(setup)}
        dateForDayFn={(d) => ymd(dateForDay(setup, d))}
        dayLabel={(d) => formatDayLabel(dateForDay(setup, d)).dm}
      />
    </div>
  )
}

// ---------------------------------------------------------------- settle up

/**
 * The question a group trip actually needs answered: not "what did we spend"
 * but "who hands what to whom at the end". Everything here is derived — there
 * is no separate settlement state to keep in sync.
 */
function SettleUp({
  ledger,
  transfers,
  goSettings,
}: {
  ledger: ReturnType<typeof buildLedger>
  transfers: ReturnType<typeof settle>
  goSettings: () => void
}) {
  const [open, setOpen] = useState(true)
  const square = transfers.length === 0

  return (
    <div className="card mt-3 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3"
      >
        <HandCoins size={15} className={square ? 'shrink-0 text-ok' : 'shrink-0 text-gold'} />
        <span className="min-w-0 flex-1 text-left text-[13.5px] text-cream">Settle up</span>
        <Chip tone={square ? 'ok' : 'gold'}>
          {square ? 'all square' : `${transfers.length} payment${transfers.length === 1 ? '' : 's'}`}
        </Chip>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring.snap} className="text-mute-2">
          <ChevronDown size={15} />
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
            <div className="space-y-3 border-t border-line px-4 py-3">
              {/* per-person balance */}
              <div className="space-y-1.5">
                {ledger.people.map((p) => {
                  const net = ledger.net[p] ?? 0
                  const owed = net < 0
                  return (
                    <div key={p} className="flex items-center gap-2.5">
                      <span className="min-w-0 flex-1 text-[13px] leading-snug text-cream">{p}</span>
                      <span className="font-mono text-[10px] text-mute-2">
                        paid {formatSgd(ledger.paid[p] ?? 0)} · used {formatSgd(ledger.owed[p] ?? 0)}
                      </span>
                      <span
                        className={`w-20 shrink-0 text-right font-mono text-[12px] ${
                          net === 0 ? 'text-mute-2' : owed ? 'text-danger' : 'text-ok'
                        }`}
                      >
                        {net === 0 ? '—' : `${owed ? '−' : '+'}${formatSgd(net)}`}
                      </span>
                    </div>
                  )
                })}
              </div>

              {/* the actual payments */}
              {square ? (
                <p className="rounded-xl border border-ok/30 bg-ok/8 px-3 py-2.5 text-[12.5px] leading-snug text-ok">
                  Nobody owes anybody. Everything logged so far balances out.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <div className="lbl">to square up</div>
                  {transfers.map((t, i) => (
                    <motion.div
                      key={`${t.from}-${t.to}-${i}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...spring.soft, delay: i * 0.05 }}
                      className="flex items-center gap-2 rounded-xl border border-line bg-ink-2/40 px-3 py-2.5"
                    >
                      <span className="text-[13px] leading-snug text-cream">{t.from}</span>
                      <ArrowRight size={13} className="shrink-0 text-gold" />
                      <span className="min-w-0 flex-1 text-[13px] leading-snug text-cream">{t.to}</span>
                      <span className="shrink-0 disp text-[19px] text-gold">{formatSgd(t.cents)}</span>
                    </motion.div>
                  ))}
                </div>
              )}

              {ledger.assumed > 0 && (
                <p className="text-[11.5px] leading-snug text-alert">
                  {ledger.assumed} entr{ledger.assumed === 1 ? 'y was' : 'ies were'} logged before
                  names were tracked, so this assumes {ledger.people[0]} paid and the split covered
                  the whole group. Edit them to be exact.
                </p>
              )}

              <button
                onClick={goSettings}
                className="font-mono text-[10px] uppercase tracking-[0.12em] text-mute-2"
              >
                rename people in settings →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Toggle chips over the trip roster. */
function PersonPicker({
  people,
  selected,
  onChange,
  exclude,
}: {
  people: string[]
  selected: string[]
  onChange: (next: string[]) => void
  exclude?: string
}) {
  const list = people.filter((p) => p !== exclude)
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((p) => {
        const on = selected.includes(p)
        return (
          <button
            key={p}
            onClick={() => onChange(on ? selected.filter((x) => x !== p) : [...selected, p])}
            className={`rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors ${
              on ? 'border-gold bg-gold/12 text-gold' : 'border-line text-mute'
            }`}
          >
            {on && <Check size={10} className="mr-1 inline" />}
            {p}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- donut

function Donut({
  data,
  total,
  active,
  onPick,
}: {
  data: { value: ExpenseCategory; color: string; amount: number }[]
  total: number
  active: ExpenseCategory | null
  onPick: (c: ExpenseCategory) => void
}) {
  const R = 34
  const C = 2 * Math.PI * R
  let offset = 0
  return (
    <motion.svg
      width="86"
      height="86"
      viewBox="0 0 86 86"
      className="shrink-0"
      initial={{ rotate: -135, scale: 0.85, opacity: 0 }}
      animate={{ rotate: -90, scale: 1, opacity: 1 }}
      transition={spring.soft}
    >
      <circle cx="43" cy="43" r={R} fill="none" stroke="#1D3830" strokeWidth="13" />
      {data.map((d) => {
        const frac = d.amount / total
        const len = C * frac
        const start = offset
        offset += len
        return (
          <circle
            key={d.value}
            cx="43"
            cy="43"
            r={R}
            fill="none"
            stroke={d.color}
            strokeWidth={active === d.value ? 15 : 13}
            strokeLinecap="butt"
            opacity={active && active !== d.value ? 0.3 : 1}
            strokeDasharray={`${len} ${C - len}`}
            strokeDashoffset={-start}
            onClick={() => onPick(d.value)}
            className="cursor-pointer transition-[stroke-width,opacity] duration-200"
          />
        )
      })}
    </motion.svg>
  )
}

// ---------------------------------------------------------------- add/edit

function ExpenseSheet({
  open,
  editing,
  onClose,
  toast,
  goSettings,
  days,
  dateForDayFn,
  dayLabel,
}: {
  open: boolean
  editing: Expense | null
  onClose: () => void
  toast: (t: string) => void
  goSettings: () => void
  days: number
  dateForDayFn: (d: number) => string
  dayLabel: (d: number) => string
}) {
  const addExpense = useTrip((s) => s.addExpense)
  const updateExpense = useTrip((s) => s.updateExpense)
  const people = useTrip((s) => s.people)
  const { call, hasKey } = useAi()
  const fileRef = useRef<HTMLInputElement>(null)

  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('food')
  const [label, setLabel] = useState('')
  const [date, setDate] = useState(dateForDayFn(1))
  const [forWhom, setForWhom] = useState<ExpenseFor>('personal')
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal')
  const [paidBy, setPaidBy] = useState(people[0] ?? 'Me')
  const [splitWith, setSplitWith] = useState<string[]>(people)
  const [onBehalfOf, setOnBehalfOf] = useState<string[]>(people.slice(1))
  const [shares, setShares] = useState<{ name: string; amount: string }[]>([
    { name: 'Me', amount: '' },
    { name: '', amount: '' },
    { name: '', amount: '' },
  ])
  const [reading, setReading] = useState(false)
  const [readNote, setReadNote] = useState('')

  const seeded = useRef<string | null>(null)
  if (open && editing && seeded.current !== editing.id) {
    seeded.current = editing.id
    setAmount(String(editing.amount))
    setCategory(editing.category)
    setLabel(editing.label)
    setDate(editing.date)
    setForWhom(editing.forWhom)
    setSplitMode(editing.shares?.length ? 'custom' : 'equal')
    setPaidBy(editing.paidBy ?? people[0] ?? 'Me')
    setSplitWith(editing.splitWith ?? people.slice(0, editing.splitCount ?? people.length))
    setOnBehalfOf(editing.onBehalfOf ?? people.filter((x) => x !== (editing.paidBy ?? people[0])))
    if (editing.shares?.length) {
      setShares(editing.shares.map((s) => ({ name: s.name, amount: String(s.amount) })))
    }
  }
  if (!open && seeded.current !== null) seeded.current = null

  const amountNum = parseFloat(amount) || 0
  const sharesTotal = shares.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0)
  const sharesOff = Math.abs(sharesTotal - amountNum) > 0.009

  const readReceipt = async (file: File) => {
    setReading(true)
    setReadNote('')
    try {
      const b64 = await toBase64(file)
      const r = await call({
        tier: 'vision',
        maxTokens: 400,
        system: RECEIPT_SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: file.type || 'image/jpeg', data: b64 },
              },
              { type: 'text', text: 'Read this receipt.' },
            ],
          },
        ],
      })
      const draft = parseReceiptReply(r.text)
      if (!draft) {
        setReadNote('Could not read that one. Type it in instead.')
        return
      }
      if (draft.amount != null) setAmount(String(draft.amount))
      if (draft.vendor) setLabel(draft.vendor)
      setCategory(draft.category as ExpenseCategory)
      if (draft.date) setDate(draft.date)
      setReadNote(
        `Pre-filled from the photo${draft.currency && draft.currency !== 'SGD' ? ` — note it read ${draft.currency}` : ''}. Check it before saving.`,
      )
    } catch (e) {
      if (!(e instanceof BudgetDeclined)) {
        setReadNote(e instanceof Error ? e.message : 'Reading the receipt failed.')
      }
    } finally {
      setReading(false)
    }
  }

  const save = () => {
    if (!amountNum) return
    const payload = {
      amount: amountNum,
      category,
      label: label.trim(),
      date,
      forWhom,
      paidBy,
      splitWith: forWhom === 'split' && splitMode === 'equal' ? splitWith : undefined,
      onBehalfOf: forWhom === 'onbehalf' ? onBehalfOf : undefined,
      // Kept in step so anything still reading the old field stays correct.
      splitCount:
        forWhom === 'split' && splitMode === 'equal' ? splitWith.length : undefined,
      shares:
        forWhom === 'split' && splitMode === 'custom'
          ? shares
              .filter((s) => parseFloat(s.amount) > 0)
              .map((s, i) => ({ name: s.name.trim() || `Person ${i + 1}`, amount: parseFloat(s.amount) }))
          : undefined,
    }
    if (editing) {
      updateExpense(editing.id, payload)
      toast('Expense updated.')
    } else {
      addExpense(payload)
      toast(`S$${amountNum.toFixed(2)} logged.`)
    }
    reset()
    onClose()
  }

  const reset = () => {
    setAmount('')
    setLabel('')
    setForWhom('personal')
    setSplitMode('equal')
    setPaidBy(people[0] ?? 'Me')
    setSplitWith(people)
    setOnBehalfOf(people.slice(1))
    setReadNote('')
    setShares([
      { name: 'Me', amount: '' },
      { name: '', amount: '' },
      { name: '', amount: '' },
    ])
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title={editing ? 'Edit expense' : 'Log an expense'}
      full
    >
      <div className="space-y-4">
        <Field label="Amount (SGD)">
          <div className="flex items-center gap-2">
            <span className="disp text-[26px] text-mute">S$</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              placeholder="0.00"
              className="w-full border-b border-line bg-transparent pb-1 disp text-[34px] text-gold placeholder:text-mute-2 focus:border-gold/60 transition-colors"
            />
          </div>
        </Field>

        <div>
          <div className="lbl mb-2">Category</div>
          <div className="flex flex-wrap gap-1.5">
            {CATS.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className="rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors"
                style={{
                  borderColor: category === c.value ? c.color : '#1D3830',
                  color: category === c.value ? c.color : '#7FA096',
                  background: category === c.value ? `${c.color}1A` : 'transparent',
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <Field label="What was it">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Chicken rice at Maxwell"
            className={inputCls}
          />
        </Field>

        <Field label="Date">
          <div className="space-y-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
                const v = dateForDayFn(d)
                return (
                  <button
                    key={d}
                    onClick={() => setDate(v)}
                    className={`shrink-0 rounded-lg border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] ${
                      date === v ? 'border-gold bg-gold/12 text-gold' : 'border-line text-mute-2'
                    }`}
                  >
                    D{d} {dayLabel(d)}
                  </button>
                )
              })}
            </div>
          </div>
        </Field>

        <Field label="Paid by" hint="Whoever actually handed over the money or tapped the card.">
          <div className="flex flex-wrap gap-1.5">
            {people.map((p) => (
              <button
                key={p}
                onClick={() => setPaidBy(p)}
                className={`rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors ${
                  paidBy === p ? 'border-gold bg-gold/12 text-gold' : 'border-line text-mute'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Who is it for">
          <Segmented
            id="forwhom"
            value={forWhom}
            onChange={setForWhom}
            options={[
              { value: 'personal', label: 'Just me' },
              { value: 'split', label: 'Split' },
              { value: 'onbehalf', label: 'For others' },
            ]}
          />
        </Field>

        <AnimatePresence initial={false}>
          {forWhom === 'split' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring.soft}
              className="overflow-hidden"
            >
              <div className="card space-y-3 p-3.5">
                <Segmented
                  id="splitmode"
                  value={splitMode}
                  onChange={setSplitMode}
                  options={[
                    { value: 'equal', label: 'Equal split' },
                    { value: 'custom', label: 'Custom shares' },
                  ]}
                />

                {splitMode === 'equal' ? (
                  <div>
                    <div className="lbl mb-2">Shared between</div>
                    <PersonPicker people={people} selected={splitWith} onChange={setSplitWith} />
                    <div className="mt-2.5 rounded-lg border border-line bg-ink-2/40 px-3 py-2 text-center">
                      <div className="lbl">each of {splitWith.length || '—'} pays</div>
                      <div className="disp text-[24px] text-gold">
                        S${(amountNum / Math.max(1, splitWith.length)).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {shares.map((s, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          value={s.name}
                          onChange={(e) =>
                            setShares((arr) =>
                              arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                            )
                          }
                          placeholder={`Person ${i + 1}`}
                          className={inputCls + ' flex-1'}
                        />
                        <input
                          value={s.amount}
                          onChange={(e) =>
                            setShares((arr) =>
                              arr.map((x, j) =>
                                j === i ? { ...x, amount: e.target.value.replace(/[^0-9.]/g, '') } : x,
                              ),
                            )
                          }
                          inputMode="decimal"
                          placeholder="0.00"
                          className={inputCls + ' w-24 text-right font-mono'}
                        />
                        {shares.length > 1 && (
                          <button
                            onClick={() => setShares((arr) => arr.filter((_, j) => j !== i))}
                            aria-label="Remove"
                            className="shrink-0 px-1 text-mute-2"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => setShares((arr) => [...arr, { name: '', amount: '' }])}
                      className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold"
                    >
                      + another person
                    </button>
                    <div
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-[12px] ${
                        sharesOff ? 'border-alert/40 bg-alert/8 text-alert' : 'border-ok/40 bg-ok/8 text-ok'
                      }`}
                    >
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em]">
                        shares total
                      </span>
                      <span className="font-mono">
                        S${sharesTotal.toFixed(2)} / S${amountNum.toFixed(2)}
                        {sharesOff && ` · off by ${(sharesTotal - amountNum).toFixed(2)}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {forWhom === 'onbehalf' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring.soft}
              className="overflow-hidden"
            >
              <div className="card space-y-2 p-3.5">
                <div className="lbl">Paid for</div>
                <PersonPicker
                  people={people}
                  selected={onBehalfOf}
                  onChange={setOnBehalfOf}
                  exclude={paidBy}
                />
                <p className="text-[11.5px] leading-snug text-mute">
                  {paidBy} covers this and owes nothing towards it —{' '}
                  {onBehalfOf.length
                    ? `split ${onBehalfOf.length} way${onBehalfOf.length === 1 ? '' : 's'} at S$${(
                        amountNum / Math.max(1, onBehalfOf.length)
                      ).toFixed(2)} each.`
                    : 'pick who it was for.'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---- receipt vision ---- */}
        <div className="card p-3.5">
          <div className="flex items-center gap-2">
            <Camera size={15} className="text-gold" />
            <span className="text-[13px] text-cream">Read a bill photo</span>
            <Chip tone="alert" className="ml-auto">
              {TIER_LABEL.vision.name} · {TIER_LABEL.vision.rough}
            </Chip>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-snug text-mute">
            Optional. Sends one photo to Claude and pre-fills the form above — it never saves
            anything by itself.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void readReceipt(f)
              e.target.value = ''
            }}
          />
          <Btn
            full
            className="mt-2.5"
            disabled={reading}
            onClick={() => (hasKey ? fileRef.current?.click() : goSettings())}
          >
            {reading ? <Spinner size={14} /> : <Camera size={14} />}
            {reading ? 'Reading…' : hasKey ? 'Choose or take a photo' : 'Add an API key first'}
          </Btn>
          {readNote && <p className="mt-2 text-[11.5px] leading-snug text-mute">{readNote}</p>}
        </div>

        <Btn
          variant="gold"
          full
          onClick={save}
          disabled={
            !amountNum ||
            (forWhom === 'split' && splitMode === 'equal' && splitWith.length === 0) ||
            (forWhom === 'onbehalf' && onBehalfOf.length === 0)
          }
        >
          {editing ? 'Save changes' : `Log S$${amountNum.toFixed(2)}`}
        </Btn>
      </div>
    </Sheet>
  )
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = reject
    r.readAsDataURL(file)
  })
}
