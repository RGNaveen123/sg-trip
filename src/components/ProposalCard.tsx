import { motion } from 'framer-motion'
import { Check, ShieldCheck, X } from 'lucide-react'
import { Btn, spring } from './ui'
import type { Proposal } from '../lib/types'

/**
 * Nothing the model proposes touches the itinerary until this card is
 * confirmed, and anything that failed validation is shown with its reason
 * rather than quietly dropped.
 */
export function ProposalCard({
  proposal,
  onApply,
  onDismiss,
}: {
  proposal: Proposal
  onApply: () => void
  onDismiss: () => void
}) {
  const ok = proposal.actions.filter((a) => a.ok)
  const bad = proposal.actions.filter((a) => !a.ok)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.soft}
      className="card overflow-hidden"
    >
      <div className="flex items-center gap-2 border-b border-line bg-gold/6 px-3.5 py-2.5">
        <ShieldCheck size={14} className="text-gold" />
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
          {proposal.applied
            ? 'Applied'
            : proposal.dismissed
              ? 'Discarded'
              : proposal.source === 'autoplan'
                ? 'Proposed plan'
                : 'Proposed changes'}
        </span>
        <span className="ml-auto font-mono text-[10px] text-mute-2">
          {ok.length} ok{bad.length ? ` · ${bad.length} rejected` : ''}
        </span>
      </div>

      <div className="divide-y divide-line">
        {ok.map((a, i) => (
          <div key={`ok-${i}`} className="flex items-start gap-2.5 px-3.5 py-2">
            <Check size={13} className="mt-0.5 shrink-0 text-ok" />
            <span className="text-[12.5px] leading-snug text-cream">{a.summary}</span>
          </div>
        ))}
        {bad.map((a, i) => (
          <div key={`bad-${i}`} className="flex items-start gap-2.5 px-3.5 py-2">
            <X size={13} className="mt-0.5 shrink-0 text-danger" />
            <div className="min-w-0">
              <div className="text-[12.5px] leading-snug text-mute line-through decoration-mute-2">
                {a.summary}
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-danger/85">{a.reason}</div>
            </div>
          </div>
        ))}
        {proposal.actions.length === 0 && (
          <div className="px-3.5 py-3 text-[12.5px] text-mute">
            Nothing valid came back to apply.
          </div>
        )}
      </div>

      {!proposal.applied && !proposal.dismissed && ok.length > 0 && (
        <div className="flex gap-2 border-t border-line p-2.5">
          <Btn variant="quiet" onClick={onDismiss} className="flex-1">
            Discard
          </Btn>
          <Btn variant="gold" onClick={onApply} className="flex-[1.4]">
            Apply {ok.length} change{ok.length === 1 ? '' : 's'}
          </Btn>
        </div>
      )}
    </motion.div>
  )
}
