import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, DownloadCloud, RotateCcw } from 'lucide-react'
import { BUILD_ID } from '../lib/pwa'

interface Props {
  children: ReactNode
  /** Changing this resets the boundary — used to recover by leaving the tab. */
  resetKey?: string
  /** Shown instead of the full-page treatment when only one screen died. */
  compact?: boolean
  label?: string
}

interface State {
  error: Error | null
  info: string | null
}

/**
 * A render crash on a phone halfway through a trip is the worst possible time
 * for a white screen. This catches it, keeps the trip data reachable, and
 * always offers a backup export before anything drastic.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: info.componentStack?.slice(0, 800) ?? null })
    console.error('[sg-trip] render crash', error, info)
  }

  componentDidUpdate(prev: Props) {
    // Navigating to another tab clears the error for that subtree.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null, info: null })
    }
  }

  private reset = () => this.setState({ error: null, info: null })

  private exportBackup = () => {
    try {
      const blob = new Blob([localStorage.getItem('sg-trip-v1') ?? '{}'], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sg-trip-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      /* nothing more we can do from in here */
    }
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    const { compact, label } = this.props

    return (
      <div className={compact ? 'px-4 py-6' : 'grid min-h-[100dvh] place-items-center bg-ink px-5'}>
        <div className="card w-full max-w-[420px] p-5">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={18} className="shrink-0 text-danger" />
            <h2 className="disp text-[24px] text-cream">
              {compact ? `${label ?? 'This screen'} broke` : 'Something broke'}
            </h2>
          </div>

          <p className="mt-2 text-[13px] leading-relaxed text-mute">
            {compact
              ? 'The rest of the app is still fine — switch tabs and come back, or try again here.'
              : 'Your trip and expenses are safe on this device. Nothing was lost.'}
          </p>

          <div className="mt-3 rounded-xl border border-line bg-ink-2/50 p-3">
            <div className="lbl mb-1">what happened</div>
            <p className="break-words font-mono text-[11px] leading-snug text-danger/90">
              {error.message || String(error)}
            </p>
            <p className="mt-2 font-mono text-[10px] text-mute-2">build {BUILD_ID}</p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={this.reset}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gold bg-gold px-4 py-2.5 text-[13px] font-semibold leading-none text-ink"
            >
              <RotateCcw size={14} /> Try again
            </button>
            <button
              onClick={this.exportBackup}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line-2 px-4 py-2.5 text-[13px] leading-none text-cream"
            >
              <DownloadCloud size={14} /> Back up
            </button>
          </div>

          {!compact && (
            <button
              onClick={() => window.location.reload()}
              className="mt-2 w-full rounded-xl border border-transparent px-4 py-2.5 text-[13px] leading-none text-mute"
            >
              Reload the app
            </button>
          )}

          {info && (
            <details className="mt-3">
              <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.12em] text-mute-2">
                technical detail
              </summary>
              <pre className="no-scrollbar mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-snug text-mute-2">
                {info}
              </pre>
            </details>
          )}
        </div>
      </div>
    )
  }
}
