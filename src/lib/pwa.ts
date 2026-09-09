import { useSyncExternalStore } from 'react'
import { registerSW } from 'virtual:pwa-register'

/**
 * A cached shell silently serving an old build was the single most confusing
 * thing about the previous version of this app. So: the build id is visible in
 * Settings, a new build announces itself instead of waiting, and there is a
 * button that force-checks and hard-reloads.
 */
interface PwaState {
  needRefresh: boolean
  offlineReady: boolean
  lastChecked: number | null
  registration: ServiceWorkerRegistration | null
  /** Registration failed — the app runs, but offline will not work. */
  error: string | null
}

let state: PwaState = {
  needRefresh: false,
  offlineReady: false,
  lastChecked: null,
  registration: null,
  error: null,
}

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const set = (p: Partial<PwaState>) => {
  state = { ...state, ...p }
  emit()
}

let updateSW: ((reload?: boolean) => Promise<void>) | null = null

export function initPwa() {
  if (updateSW) return
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => set({ needRefresh: true }),
    onOfflineReady: () => set({ offlineReady: true }),
    onRegisteredSW: (_url, r) => {
      set({ registration: r ?? null, lastChecked: Date.now() })
      // Look for a new build when the app is brought back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void checkForUpdate()
      })
    },
    onRegisterError: (e) =>
      set({ error: e instanceof Error ? e.message : 'Service worker registration failed.' }),
  })
}

export async function checkForUpdate(): Promise<boolean> {
  try {
    await state.registration?.update()
    set({ lastChecked: Date.now() })
    return state.needRefresh
  } catch {
    set({ lastChecked: Date.now() })
    return false
  }
}

export async function applyUpdate() {
  if (updateSW) await updateSW(true)
  else window.location.reload()
}

export function usePwa(): PwaState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
    () => state,
  )
}

export const BUILD_ID = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'
