declare const __BUILD_ID__: string
declare module 'virtual:pwa-register' {
  export function registerSW(options?: {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegisteredSW?: (url: string, r: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (e: unknown) => void
  }): (reloadPage?: boolean) => Promise<void>
}
