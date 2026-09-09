import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bus,
  CalendarClock,
  ChevronDown,
  FileText,
  ImagePlus,
  Link2,
  Music,
  Plane,
  Plus,
  Ticket as TicketIcon,
  Trash2,
  X,
} from 'lucide-react'
import { Btn, Chip, Empty, Field, inputCls, Sheet, spring, Spinner } from '../components/ui'
import { TicketViewer } from '../components/TicketViewer'
import { useTrip } from '../lib/store'
import { useAllItems, useAssetUrl } from '../lib/hooks'
import { dateForDay, dayCount, formatDayLabel, formatTime12, ymd } from '../lib/trip'
import { deletePassAssets, savePassImage, storageEstimate, TicketStoreError } from '../lib/tickets'
import type { Pass, Ticket, TicketKind } from '../lib/types'

const KINDS: { value: TicketKind; label: string; icon: typeof Plane }[] = [
  { value: 'flight', label: 'Flight', icon: Plane },
  { value: 'attraction', label: 'Attraction', icon: TicketIcon },
  { value: 'concert', label: 'Concert', icon: Music },
  { value: 'transport', label: 'Transport', icon: Bus },
  { value: 'other', label: 'Other', icon: FileText },
]
const KIND = Object.fromEntries(KINDS.map((k) => [k.value, k])) as Record<
  TicketKind,
  (typeof KINDS)[number]
>
/** An unrecognised kind from an old backup must not take the screen down. */
const kindOf = (k: TicketKind | string) => KIND[k as TicketKind] ?? KIND.other

export function Tickets({ toast }: { toast: (t: string) => void }) {
  const tickets = useTrip((s) => s.tickets)
  const removeTicket = useTrip((s) => s.removeTicket)
  const [adding, setAdding] = useState(false)
  const [addingTo, setAddingTo] = useState<Ticket | null>(null)
  const [viewing, setViewing] = useState<{ ticket: Ticket; index: number } | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  // Soonest first — at a gate you want today's ticket at the top.
  const sorted = useMemo(
    () => [...tickets].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)),
    [tickets],
  )

  const del = async (t: Ticket) => {
    removeTicket(t.id)
    await deletePassAssets(t.passes.map((p) => p.assetId))
    toast(`${t.title} deleted.`)
  }

  return (
    <div className="px-4 pb-6">
      <Btn full variant="gold" onClick={() => setAdding(true)}>
        <Plus size={15} /> Add tickets
      </Btn>

      {sorted.length === 0 ? (
        <Empty
          icon={<TicketIcon size={22} />}
          title="No tickets yet"
          body="Screenshot each booking and add it here — flights, Universal, the concert. They open with no signal, so the stadium wifi being useless stops mattering."
        />
      ) : (
        <div className="mt-4 space-y-2">
          <AnimatePresence initial={false}>
            {sorted.map((t) => {
              const K = kindOf(t.kind)
              const isOpen = open === t.id
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={spring.soft}
                  className="card overflow-hidden"
                >
                  <button
                    onClick={() => setOpen(isOpen ? null : t.id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left"
                  >
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gold/40 bg-gold/10 text-gold">
                      <K.icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      {/* wraps rather than truncating — a ticket you can't read
                          the name of is a ticket you can't find at a gate */}
                      <div className="text-[14px] font-semibold leading-snug text-cream">
                        {t.title}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Chip tone="mute">{t.date}</Chip>
                        <Chip tone={t.passes.length ? 'ok' : 'alert'}>
                          {t.passes.length || 'no'} pass{t.passes.length === 1 ? '' : 'es'}
                        </Chip>
                        {t.ref && <Chip tone="mute">{t.ref}</Chip>}
                      </div>
                    </div>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={spring.snap}
                      className="mt-1 shrink-0 text-mute-2"
                    >
                      <ChevronDown size={16} />
                    </motion.span>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={spring.soft}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-line px-4 py-3">
                          {t.notes && (
                            <p className="mb-3 text-[12.5px] leading-relaxed text-mute">{t.notes}</p>
                          )}

                          {t.passes.length > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                              {t.passes.map((p, i) => (
                                <PassThumb
                                  key={p.id}
                                  pass={p}
                                  onOpen={() => setViewing({ ticket: t, index: i })}
                                />
                              ))}
                            </div>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Btn onClick={() => setAddingTo(t)}>
                              <ImagePlus size={13} /> Add a pass
                            </Btn>
                            <Btn variant="danger" onClick={() => void del(t)}>
                              <Trash2 size={13} />
                            </Btn>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      <p className="mt-4 text-[11.5px] leading-snug text-mute-2">
        Images are stored on this phone only, and open with no signal. They are a convenience
        copy — the originals stay in your email.
      </p>

      <TicketSheet
        open={adding || Boolean(addingTo)}
        existing={addingTo}
        onClose={() => {
          setAdding(false)
          setAddingTo(null)
        }}
        toast={toast}
      />

      <TicketViewer
        ticket={viewing?.ticket ?? null}
        startIndex={viewing?.index ?? 0}
        onClose={() => setViewing(null)}
      />
    </div>
  )
}

function PassThumb({ pass, onOpen }: { pass: Pass; onOpen: () => void }) {
  const { url, error } = useAssetUrl(pass.assetId)
  return (
    <button
      onClick={onOpen}
      className="overflow-hidden rounded-xl border border-line bg-ink-2/50 text-left active:scale-[0.98] transition-transform"
    >
      <div className="grid h-20 place-items-center bg-white/90">
        {url ? (
          <img src={url} alt={pass.label} className="h-full w-full object-cover" />
        ) : error ? (
          <X size={16} className="text-danger" />
        ) : (
          <Spinner size={14} />
        )}
      </div>
      <div className="px-2 py-1.5 text-[11.5px] leading-snug text-cream">{pass.label || 'Pass'}</div>
    </button>
  )
}

// ---------------------------------------------------------------- add / edit

interface Draft {
  assetId: string
  mime: string
  label: string
  preview: string
}

function TicketSheet({
  open,
  existing,
  onClose,
  toast,
}: {
  open: boolean
  existing: Ticket | null
  onClose: () => void
  toast: (t: string) => void
}) {
  const addTicket = useTrip((s) => s.addTicket)
  const addPasses = useTrip((s) => s.addPasses)
  const people = useTrip((s) => s.people)
  const setup = useTrip((s) => s.setup)
  const all = useAllItems()
  const fileRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TicketKind>('attraction')
  const [date, setDate] = useState(ymd(dateForDay(setup, 1)))
  const [ref, setRef] = useState('')
  const [notes, setNotes] = useState('')
  const [itemId, setItemId] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  /** Clear the form. Revokes preview URLs but leaves stored assets alone. */
  const reset = () => {
    drafts.forEach((d) => URL.revokeObjectURL(d.preview))
    setTitle('')
    setKind('attraction')
    setDate(ymd(dateForDay(setup, 1)))
    setRef('')
    setNotes('')
    setItemId('')
    setDrafts([])
    setError('')
  }

  /**
   * Cancelling has to clean up after itself: images are written to IndexedDB the
   * moment they are picked, so abandoning the sheet would otherwise leave orphan
   * blobs on the device that nothing references and nothing ever deletes.
   */
  const close = () => {
    const orphans = drafts.map((d) => d.assetId)
    reset()
    onClose()
    if (orphans.length) void deletePassAssets(orphans)
  }

  const pick = async (files: FileList) => {
    setBusy(true)
    setError('')
    const added: Draft[] = []
    for (const file of Array.from(files)) {
      try {
        const { assetId, mime } = await savePassImage(file)
        added.push({
          assetId,
          mime,
          // Suggest a person for each new pass, in roster order.
          label: people[drafts.length + added.length] ?? '',
          preview: URL.createObjectURL(file),
        })
      } catch (e) {
        setError(
          e instanceof TicketStoreError ? e.message : 'Something went wrong saving that image.',
        )
      }
    }
    setDrafts((d) => [...d, ...added])
    setBusy(false)

    const est = await storageEstimate()
    if (est && est.usedMb / est.quotaMb > 0.85) {
      setError(`Storage is nearly full — ${est.usedMb} MB of ${est.quotaMb} MB used.`)
    }
  }

  const dropDraft = async (assetId: string) => {
    const d = drafts.find((x) => x.assetId === assetId)
    if (d) URL.revokeObjectURL(d.preview)
    setDrafts((list) => list.filter((x) => x.assetId !== assetId))
    await deletePassAssets([assetId])
  }

  const save = () => {
    const passes = drafts.map((d) => ({ assetId: d.assetId, mime: d.mime, label: d.label.trim() }))
    if (existing) {
      addPasses(existing.id, passes)
      toast(`${passes.length} pass${passes.length === 1 ? '' : 'es'} added to ${existing.title}.`)
    } else {
      const id = addTicket({
        title: title.trim() || 'Untitled booking',
        kind,
        date,
        ref: ref.trim() || undefined,
        notes: notes.trim() || undefined,
        itemId: itemId || undefined,
      })
      addPasses(id, passes)
      toast(`${title.trim() || 'Booking'} saved.`)
    }
    // The assets now belong to the store — reset only revokes the preview URLs.
    reset()
    onClose()
  }

  const days = dayCount(setup)
  const canSave = existing ? drafts.length > 0 : title.trim().length > 0 && drafts.length > 0

  return (
    <Sheet
      open={open}
      onClose={close}
      title={existing ? 'Add a pass' : 'Add tickets'}
      subtitle={existing ? existing.title : 'Screenshot the booking, then describe it'}
      full
    >
      <div className="space-y-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void pick(e.target.files)
            e.target.value = ''
          }}
        />

        <Btn full variant={drafts.length ? 'ghost' : 'gold'} onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Spinner size={14} /> : <ImagePlus size={15} />}
          {drafts.length ? 'Add another image' : 'Choose photo or screenshot'}
        </Btn>
        <p className="-mt-2 text-[11px] leading-snug text-mute-2">
          Camera, screenshots and gallery all appear in the same picker. Pick several at once if
          the booking covers more than one of you. PDFs from email: open it, screenshot it, add
          the picture.
        </p>

        {drafts.length > 0 && (
          <div className="space-y-2">
            <div className="lbl">Label each one</div>
            {drafts.map((d) => (
              <div key={d.assetId} className="card flex items-start gap-3 p-2.5">
                <img
                  src={d.preview}
                  alt=""
                  className="h-16 w-14 shrink-0 rounded-lg bg-white object-cover"
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    value={d.label}
                    onChange={(e) =>
                      setDrafts((list) =>
                        list.map((x) => (x.assetId === d.assetId ? { ...x, label: e.target.value } : x)),
                      )
                    }
                    placeholder="Whose is it? or Outbound / Seat 24A"
                    className={inputCls + ' py-1.5 text-[13px]'}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {people.map((p) => (
                      <button
                        key={p}
                        onClick={() =>
                          setDrafts((list) =>
                            list.map((x) => (x.assetId === d.assetId ? { ...x, label: p } : x)),
                          )
                        }
                        className={`rounded-lg border px-2 py-1 text-[11px] ${
                          d.label === p ? 'border-gold bg-gold/12 text-gold' : 'border-line text-mute'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => void dropDraft(d.assetId)}
                  aria-label="Remove"
                  className="shrink-0 px-1 text-mute-2"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {!existing && (
          <>
            <Field label="What is it">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. BTS — National Stadium"
                className={inputCls}
              />
            </Field>

            <div>
              <div className="lbl mb-2">Kind</div>
              <div className="flex flex-wrap gap-1.5">
                {KINDS.map((k) => (
                  <button
                    key={k.value}
                    onClick={() => setKind(k.value)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] ${
                      kind === k.value ? 'border-gold bg-gold/12 text-gold' : 'border-line text-mute'
                    }`}
                  >
                    <k.icon size={12} /> {k.label}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Date it's used">
              <div className="space-y-2">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputCls}
                />
                <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                  {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
                    const v = ymd(dateForDay(setup, d))
                    const { dm } = formatDayLabel(dateForDay(setup, d))
                    return (
                      <button
                        key={d}
                        onClick={() => setDate(v)}
                        className={`shrink-0 rounded-lg border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] ${
                          date === v ? 'border-gold bg-gold/12 text-gold' : 'border-line text-mute-2'
                        }`}
                      >
                        D{d} {dm}
                      </button>
                    )
                  })}
                </div>
              </div>
            </Field>

            <Field label="Booking reference">
              <input
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                placeholder="PNR / order number"
                className={inputCls + ' font-mono'}
              />
            </Field>

            <Field
              label="Attach to a stop"
              hint="Then the itinerary shows a tickets chip, and one tap from there puts the QR on screen."
            >
              <div className="relative">
                <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute-2" />
                <select
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  className={inputCls + ' pl-9'}
                >
                  <option value="" className="bg-ink-2">
                    Not attached
                  </option>
                  {all
                    .filter((i) => i.day)
                    .map((i) => (
                      <option key={i.id} value={i.id} className="bg-ink-2">
                        Day {i.day} · {formatTime12(i.start)} · {i.name}
                      </option>
                    ))}
                </select>
              </div>
            </Field>

            <Field label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Gate, entry time, what to bring…"
                className={inputCls}
              />
            </Field>
          </>
        )}

        {error && (
          <div className="rounded-xl border border-danger/40 bg-danger/8 p-3 text-[12px] leading-snug text-danger">
            {error}
          </div>
        )}

        <Btn variant="gold" full onClick={save} disabled={!canSave || busy}>
          <CalendarClock size={15} />
          {existing
            ? `Add ${drafts.length} pass${drafts.length === 1 ? '' : 'es'}`
            : 'Save booking'}
        </Btn>
      </div>
    </Sheet>
  )
}
