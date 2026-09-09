import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowUp, Eraser, MessageCircle, Sparkles } from 'lucide-react'
import { Btn, Chip, Empty, spring, Spinner } from '../components/ui'
import { ProposalCard } from '../components/ProposalCard'
import { useTrip } from '../lib/store'
import { useAi, useAllItems, useTripContext } from '../lib/hooks'
import {
  applyActions,
  BudgetDeclined,
  extractActions,
  systemPrompt,
  TIER_LABEL,
  validateActions,
  windowedHistory,
} from '../lib/ai'

const SUGGESTIONS = [
  'What should we do on day 3?',
  'Cheapest way from the stay to the stadium?',
  'Move dinner an hour later on day 2',
  'Best hawker stalls near tonight’s plan?',
  'What do we do if it rains all day tomorrow?',
]

export function Ask({
  prefill,
  onPrefillUsed,
  toast,
  goSettings,
}: {
  prefill: string | null
  onPrefillUsed: () => void
  toast: (t: string, action?: { label: string; run: () => void }) => void
  goSettings: () => void
}) {
  const chat = useTrip((s) => s.chat)
  const pushChat = useTrip((s) => s.pushChat)
  const patchChat = useTrip((s) => s.patchChat)
  const clearChat = useTrip((s) => s.clearChat)
  const setProposalState = useTrip((s) => s.setProposalState)
  const rawItems = useTrip((s) => s.items)
  const customPlaces = useTrip((s) => s.customPlaces)
  const setup = useTrip((s) => s.setup)
  const replaceItems = useTrip((s) => s.replaceItems)
  const undo = useTrip((s) => s.undo)
  const all = useAllItems()
  const ctx = useTripContext()
  const { call, hasKey } = useAi()

  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chat.length, busy])

  useEffect(() => {
    if (prefill) {
      setDraft(prefill)
      onPrefillUsed()
    }
  }, [prefill, onPrefillUsed])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    if (!hasKey) {
      goSettings()
      return
    }
    setDraft('')
    pushChat({ role: 'user', content: q })
    setBusy(true)

    const history = windowedHistory(
      [...chat.map((m) => ({ role: m.role, content: m.content })), { role: 'user' as const, content: q }],
    )

    try {
      const r = await call({
        tier: 'text',
        maxTokens: 1600,
        system: systemPrompt(ctx),
        messages: history,
      })
      const { prose, raw } = extractActions(r.text)
      const actions = raw.length ? validateActions(raw, { setup, all, customPlaces }) : []
      const id = pushChat({
        role: 'assistant',
        content: prose || '(no reply)',
        proposal: actions.length
          ? { id: `p-${Date.now()}`, actions, applied: false, source: 'chat' }
          : undefined,
      })
      void id
    } catch (e) {
      if (e instanceof BudgetDeclined) {
        pushChat({ role: 'assistant', content: 'Cancelled — no call was made.', error: true })
      } else {
        pushChat({
          role: 'assistant',
          content: e instanceof Error ? e.message : 'Something went wrong.',
          error: true,
        })
      }
    } finally {
      setBusy(false)
    }
  }

  const apply = (msgId: string) => {
    const msg = chat.find((m) => m.id === msgId)
    if (!msg?.proposal) return
    const next = applyActions(rawItems, msg.proposal.actions, customPlaces)
    replaceItems(next, 'chat edit')
    setProposalState(msgId, { applied: true })
    const n = msg.proposal.actions.filter((a) => a.ok).length
    toast(`Applied ${n} change${n === 1 ? '' : 's'} to the plan.`, {
      label: 'Undo',
      run: () => {
        undo()
        setProposalState(msgId, { applied: false })
      },
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 px-4 pb-3">
        {chat.length === 0 && (
          <>
            <Empty
              icon={<MessageCircle size={22} />}
              title="Ask about the trip"
              body="It knows your dates, what is already scheduled and where you are staying — and it can move things around when you ask it to."
            />
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] text-mute active:scale-95 transition-transform"
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        <AnimatePresence initial={false}>
          {chat.map((m) => (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring.soft}
              className={m.role === 'user' ? 'flex justify-end' : 'space-y-2'}
            >
              {m.role === 'user' ? (
                <div className="max-w-[85%] rounded-2xl rounded-br-md border border-gold/35 bg-gold/10 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-cream">
                  {m.content}
                </div>
              ) : (
                <>
                  <div
                    className={`md max-w-[92%] rounded-2xl rounded-bl-md border px-3.5 py-3 text-[13.5px] leading-relaxed ${
                      m.error
                        ? 'border-danger/40 bg-danger/8 text-danger'
                        : 'border-line bg-ink-2/60 text-cream/95'
                    }`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                  </div>
                  {m.proposal && (
                    <ProposalCard
                      proposal={m.proposal}
                      onApply={() => apply(m.id)}
                      onDismiss={() => setProposalState(m.id, { dismissed: true })}
                    />
                  )}
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {busy && (
          <div className="flex items-center gap-2 text-[12px] text-mute">
            <Spinner /> thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 border-t border-line bg-ink/85 px-4 pb-3 pt-2.5 backdrop-blur-xl">
        <div className="mb-2 flex items-center gap-2">
          <Chip tone="gold">
            <Sparkles size={9} /> {TIER_LABEL.text.name} · {TIER_LABEL.text.rough} per message
          </Chip>
          {chat.length > 0 && (
            <button
              onClick={() => clearChat()}
              className="ml-auto flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-mute-2"
            >
              <Eraser size={11} /> clear
            </button>
          )}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(draft)
              }
            }}
            rows={1}
            placeholder={hasKey ? 'Ask, or tell it to change the plan…' : 'Add an API key in Settings first'}
            className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl border border-line bg-ink-2/70 px-3.5 py-3 text-[14px] text-cream placeholder:text-mute-2 focus:border-gold/60 transition-colors"
          />
          <Btn
            variant="gold"
            onClick={() => send(draft)}
            disabled={busy || !draft.trim()}
            className="h-[44px] w-[44px] !px-0"
          >
            <ArrowUp size={17} />
          </Btn>
        </div>
        <p className="mt-1.5 text-[10.5px] leading-snug text-mute-2">
          Remembers the last few turns only. Any edit it proposes is checked against the real plan
          and needs your tap before it lands.
        </p>
      </div>
    </div>
  )
}
