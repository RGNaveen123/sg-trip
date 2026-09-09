import { lazy, Suspense } from 'react'
import type { ComponentProps } from 'react'
// Type-only — erased at build, so it does not pull Leaflet into this chunk.
import type { MapView as RealMapView } from './MapView'
export type { MapPoint } from './MapView'

/**
 * Leaflet plus its CSS is the single biggest thing in the bundle, and most
 * sessions open on the itinerary and never touch a map. Everything reaches the
 * map through here so it stays in its own chunk, fetched on first use.
 */
const Inner = lazy(() =>
  import('./MapView').then((m) => ({ default: m.MapView })),
)

export function MapView(props: ComponentProps<typeof RealMapView>) {
  return (
    <Suspense
      fallback={
        <div
          className="grid animate-pulse place-items-center rounded-2xl border border-line bg-ink-2/60 font-mono text-[10px] uppercase tracking-[0.14em] text-mute-2"
          style={{ height: props.height ?? 300 }}
        >
          loading map…
        </div>
      }
    >
      <Inner {...props} />
    </Suspense>
  )
}
