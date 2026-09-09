/**
 * Browser storage is scoped to the **origin**, not the path.
 *
 * The preview build is served from `/sg-trip/preview/` on the same origin as the
 * live app at `/sg-trip/`, so without namespacing, opening the preview would read
 * and write the real trip's data — and a half-finished feature could corrupt
 * tickets and expenses you actually depend on.
 *
 * `import.meta.env.BASE_URL` is no help here because the build uses a relative
 * base (`'./'`), so the variant is decided from where the app is actually served,
 * with a build-time override for anyone who wants to force it.
 */
const isPreview =
  import.meta.env.VITE_VARIANT === 'preview' ||
  (typeof location !== 'undefined' && location.pathname.includes('/preview/'))

export const IS_PREVIEW = isPreview

/** zustand-persist key. */
export const STORE_KEY = isPreview ? 'sg-trip-preview-v1' : 'sg-trip-v1'

/** IndexedDB database holding ticket images. */
export const DB_NAME = isPreview ? 'sg-trip-preview-assets' : 'sg-trip-assets'
