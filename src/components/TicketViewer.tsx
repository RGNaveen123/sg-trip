import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Sun, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useAssetUrl } from '../lib/hooks'
import type { Ticket } from '../lib/types'

/**
 * The screen you hold up at a gate.
 *
 * Three decisions that matter more than anything cosmetic:
 *
 * 1. **Light background, always.** The rest of the app is near-black, and gate
 *    scanners struggle badly with a dark ground. This ignores the app theme.
 * 2. **The original image, undecoded.** We never parse the QR and re-render it —
 *    the scanner reads the same pixels it would read off the airline's own page,
 *    so decoding would add a failure mode for no benefit.
 * 3. **Wake lock.** Queues are long and a screen that sleeps mid-queue is the
 *    whole point of this feature failing.
 */
export function TicketViewer({
  ticket,
  startIndex = 0,
  onClose,
}: {
  ticket: Ticket | null
  startIndex?: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(startIndex)
  const [zoomed, setZoomed] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const pass = ticket?.passes[index] ?? null
  const { url, error } = useAssetUrl(pass?.assetId)

  useEffect(() => {
    setIndex(startIndex)
    setZoomed(false)
  }, [ticket?.id, startIndex])

  useEffect(() => setZoomed(false), [index])

  // ---- keep the screen awake while a pass is on show ----
  useEffect(() => {
    if (!ticket) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      try {
        lock = await navigator.wakeLock?.request('screen')
      } catch {
        /* denied, unsupported, or battery saver — nothing we can do */
      }
    }
    void acquire()

    // Android drops the lock when you switch away; take it back on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !cancelled) void acquire()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => {})
    }
  }, [ticket])

  useEffect(() => {
    if (!ticket) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, ticket.passes.length - 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [ticket, onClose])

  const many = (ticket?.passes.length ?? 0) > 1

  return createPortal(
    <AnimatePresence>
      {ticket && pass && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          /* Deliberately not a theme token: this is always light. */
          className="fixed inset-0 z-[70] flex flex-col bg-[#FAFAF7]"
        >
          {/* ---- who this one belongs to, large ---- */}
          <div className="flex items-center gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                {ticket.title}
              </div>
              <div className="text-[22px] font-semibold leading-tight text-neutral-900">
                {pass.label || 'Pass'}
              </div>
            </div>
            {many && (
              <span className="shrink-0 rounded-full bg-neutral-900/8 px-2.5 py-1 font-mono text-[11px] text-neutral-600">
                {index + 1} / {ticket.passes.length}
              </span>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-900/8 text-neutral-700 active:scale-90 transition-transform"
            >
              <X size={18} />
            </button>
          </div>

          {/* ---- the pass itself ---- */}
          <motion.div
            ref={scrollRef}
            className={`no-scrollbar relative flex-1 ${
              zoomed ? 'overflow-auto' : 'overflow-hidden'
            } grid place-items-center px-3`}
            /* Swipe between passes, but only when not zoomed — otherwise the
               drag fights panning around a magnified ticket. */
            drag={many && !zoomed ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.14}
            onDragEnd={(_, info) => {
              if (info.offset.x < -70 || info.velocity.x < -450) {
                setIndex((i) => Math.min(i + 1, ticket.passes.length - 1))
              } else if (info.offset.x > 70 || info.velocity.x > 450) {
                setIndex((i) => Math.max(i - 1, 0))
              }
            }}
          >
            {error ? (
              <div className="max-w-[280px] text-center">
                <p className="text-[14px] leading-relaxed text-neutral-700">{error}</p>
                <p className="mt-2 text-[12px] text-neutral-500">
                  The booking details are still on the ticket card — the image itself did not
                  survive. Add it again from your gallery.
                </p>
              </div>
            ) : url ? (
              <img
                src={url}
                alt={`${ticket.title} — ${pass.label}`}
                onClick={() => setZoomed((z) => !z)}
                className={
                  zoomed
                    ? 'max-w-none cursor-zoom-out'
                    : 'max-h-full max-w-full cursor-zoom-in object-contain'
                }
                style={zoomed ? { width: '250%' } : undefined}
              />
            ) : (
              <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-300" />
            )}
          </motion.div>

          {/* ---- controls ---- */}
          <div className="flex items-center gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
            {many && (
              <button
                onClick={() => setIndex((i) => Math.max(i - 1, 0))}
                disabled={index === 0}
                aria-label="Previous pass"
                className="grid h-11 w-11 place-items-center rounded-full bg-neutral-900/8 text-neutral-700 disabled:opacity-30"
              >
                <ChevronLeft size={20} />
              </button>
            )}

            <div className="flex flex-1 items-center justify-center gap-1.5 text-[11px] text-neutral-500">
              <Sun size={12} />
              <span>Turn your brightness up</span>
            </div>

            <button
              onClick={() => setZoomed((z) => !z)}
              aria-label={zoomed ? 'Fit to screen' : 'Zoom in'}
              className="grid h-11 w-11 place-items-center rounded-full bg-neutral-900/8 text-neutral-700"
            >
              {zoomed ? <ZoomOut size={18} /> : <ZoomIn size={18} />}
            </button>

            {many && (
              <button
                onClick={() => setIndex((i) => Math.min(i + 1, ticket.passes.length - 1))}
                disabled={index === ticket.passes.length - 1}
                aria-label="Next pass"
                className="grid h-11 w-11 place-items-center rounded-full bg-neutral-900/8 text-neutral-700 disabled:opacity-30"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>

        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
