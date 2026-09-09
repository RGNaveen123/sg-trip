import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { MouseEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

/** One spring vocabulary for the whole app. */
export const spring = {
  snap: { type: 'spring', stiffness: 620, damping: 38, mass: 0.9 } as const,
  soft: { type: 'spring', stiffness: 320, damping: 32, mass: 1 } as const,
  sheet: { type: 'spring', stiffness: 380, damping: 40, mass: 1.05 } as const,
}

// ---------------------------------------------------------------- Sheet

/**
 * Bottom sheet. Rendered through a portal on purpose: an animated transform
 * anywhere up the tree would become the containing block for anything
 * position:fixed inside it, and the sheet would stop being pinned to the
 * viewport.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  full,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  full?: boolean
}) {
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <motion.div
            className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            className="glass relative rounded-t-[26px] border-t border-x border-line-2 shadow-[0_-24px_60px_rgba(0,0,0,0.6)]"
            style={{ maxHeight: full ? '94dvh' : '86dvh' }}
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={spring.sheet}
            drag="y"
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 700) onClose()
            }}
          >
            <div className="flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing">
              <div className="h-1 w-11 rounded-full bg-line-2" />
            </div>
            {(title || subtitle) && (
              <div className="flex items-start gap-3 px-5 pb-3">
                <div className="min-w-0 flex-1">
                  {title && <h2 className="disp text-[26px] text-cream">{title}</h2>}
                  {subtitle && <div className="lbl mt-1">{subtitle}</div>}
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-mute active:scale-90 transition-transform"
                >
                  <X size={15} />
                </button>
              </div>
            )}
            <div
              className="no-scrollbar overflow-y-auto overscroll-contain px-5 pb-8"
              style={{ maxHeight: full ? '80dvh' : '70dvh' }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// ---------------------------------------------------------------- Buttons

type BtnVariant = 'gold' | 'ghost' | 'quiet' | 'danger'

export function Btn({
  children,
  onClick,
  variant = 'ghost',
  disabled,
  className = '',
  type = 'button',
  full,
}: {
  children: ReactNode
  /** Receives the event so a button inside a tappable card can stop it bubbling. */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  variant?: BtnVariant
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
  full?: boolean
}) {
  const styles: Record<BtnVariant, string> = {
    gold: 'bg-gold text-ink font-semibold border border-gold',
    ghost: 'border border-line-2 text-cream',
    quiet: 'border border-transparent text-mute',
    danger: 'border border-danger/50 text-danger',
  }
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.965 }}
      transition={spring.snap}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] leading-none disabled:opacity-40 ${
        styles[variant]
      } ${full ? 'w-full' : ''} ${className}`}
    >
      {children}
    </motion.button>
  )
}

// ---------------------------------------------------------------- Fields

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: ReactNode
}) {
  return (
    <label className="block">
      <div className="lbl mb-1.5">{label}</div>
      {children}
      {hint && <div className="mt-1.5 text-[11px] leading-snug text-mute-2">{hint}</div>}
    </label>
  )
}

export const inputCls =
  'w-full rounded-xl border border-line bg-ink-2/70 px-3.5 py-2.5 text-[14px] text-cream placeholder:text-mute-2 focus:border-gold/60 transition-colors'

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  id,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  id: string
}) {
  return (
    <div className="flex rounded-xl border border-line bg-ink-2/60 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="relative flex-1 rounded-lg px-2 py-1.5 text-[12px]"
        >
          {value === o.value && (
            <motion.div
              layoutId={`seg-${id}`}
              className="absolute inset-0 rounded-lg bg-gold/15 border border-gold/40"
              transition={spring.snap}
            />
          )}
          <span className={`relative ${value === o.value ? 'text-gold' : 'text-mute'}`}>
            {o.label}
          </span>
        </button>
      ))}
    </div>
  )
}

export function Chip({
  children,
  tone = 'mute',
  className = '',
}: {
  children: ReactNode
  tone?: 'mute' | 'gold' | 'transit' | 'taxi' | 'walk' | 'danger' | 'alert' | 'ok'
  className?: string
}) {
  const tones: Record<string, string> = {
    mute: 'border-line text-mute',
    gold: 'border-gold/45 text-gold bg-gold/10',
    transit: 'border-transit/40 text-transit bg-transit/10',
    taxi: 'border-taxi/45 text-taxi bg-taxi/10',
    walk: 'border-walk/40 text-walk bg-walk/10',
    danger: 'border-danger/45 text-danger bg-danger/10',
    alert: 'border-alert/45 text-alert bg-alert/10',
    ok: 'border-ok/40 text-ok bg-ok/10',
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.09em] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

// ---------------------------------------------------------------- Toast

export interface ToastMsg {
  id: number
  text: string
  action?: { label: string; run: () => void }
  tone?: 'ok' | 'danger' | 'plain'
}

export function Toasts({ list, dismiss }: { list: ToastMsg[]; dismiss: (id: number) => void }) {
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[86px] z-[60] flex flex-col items-center gap-2 px-4">
      <AnimatePresence initial={false}>
        {list.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={spring.soft}
            className="glass pointer-events-auto flex w-full max-w-[440px] items-center gap-3 rounded-2xl border border-line-2 px-4 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                t.tone === 'danger' ? 'bg-danger' : t.tone === 'ok' ? 'bg-ok' : 'bg-gold'
              }`}
            />
            <span className="min-w-0 flex-1 text-[13px] leading-snug text-cream">{t.text}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action!.run()
                  dismiss(t.id)
                }}
                className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-gold"
              >
                {t.action.label}
              </button>
            )}
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="shrink-0 text-mute-2">
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

export function useToasts() {
  const [list, setList] = useState<ToastMsg[]>([])
  const seq = useRef(0)
  const push = (text: string, opts?: Omit<ToastMsg, 'id' | 'text'> & { ms?: number }) => {
    const id = ++seq.current
    setList((l) => [...l.slice(-2), { id, text, action: opts?.action, tone: opts?.tone }])
    const ms = opts?.ms ?? (opts?.action ? 7000 : 3600)
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), ms)
  }
  const dismiss = (id: number) => setList((l) => l.filter((x) => x.id !== id))
  return { list, push, dismiss }
}

// ---------------------------------------------------------------- misc

/** Odometer-ish number, because a total that just swaps looks broken. */
export function Ticker({ value, className = '' }: { value: string; className?: string }) {
  return (
    <span className={`inline-flex overflow-hidden ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: '55%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-55%', opacity: 0, position: 'absolute' }}
          transition={spring.soft}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

export function Empty({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center px-8 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-line text-mute-2">
        {icon}
      </div>
      <div className="disp text-[22px] text-cream">{title}</div>
      <p className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-mute">{body}</p>
    </div>
  )
}

export function Spinner({ size = 15 }: { size?: number }) {
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, ease: 'linear', duration: 0.85 }}
      className="inline-block rounded-full border-2 border-gold/25 border-t-gold"
      style={{ width: size, height: size }}
    />
  )
}
