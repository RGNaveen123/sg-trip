import { TrainFront } from 'lucide-react'
import { routeSummary, type MrtRoute } from '../lib/mrt'
import { citymapperUrl, directionsUrl } from '../lib/geo'
import type { LatLng } from '../lib/types'

/** Coloured line badges plus the one-line summary of an MRT journey. */
export function MrtRouteLine({ route }: { route: MrtRoute }) {
  return (
    <div className="flex items-start gap-1.5">
      <TrainFront size={12} className="mt-[3px] shrink-0 text-transit" />
      <div className="min-w-0 flex-1 text-[11.5px] leading-snug text-mute">
        <span className="mr-1 inline-flex gap-0.5 align-[1px]">
          {route.steps.map((s, i) => (
            <span
              key={i}
              title={`${s.lineName} Line`}
              className="rounded px-1 font-mono text-[9px] font-semibold leading-[14px] text-white"
              style={{ background: s.colour }}
            >
              {s.line === 'CG' ? 'EW' : s.line === 'CE' ? 'CC' : s.line}
            </span>
          ))}
        </span>
        {routeSummary(route)}
      </div>
    </div>
  )
}

/** Hand the journey to a real transit app for live trains and exits. */
export function TransitLinks({
  from,
  to,
  toName,
  className = '',
}: {
  from: LatLng | null
  to: LatLng
  toName?: string
  className?: string
}) {
  const link = 'font-mono text-[9.5px] uppercase tracking-[0.12em] text-transit'
  return (
    <span className={`flex shrink-0 gap-3 ${className}`}>
      <a href={directionsUrl(from, to, 'transit')} target="_blank" rel="noreferrer" className={link}>
        maps ↗
      </a>
      <a href={citymapperUrl(from, to, toName)} target="_blank" rel="noreferrer" className={link}>
        citymapper ↗
      </a>
    </span>
  )
}
