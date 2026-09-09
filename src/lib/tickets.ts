import { DB_NAME } from './storageKey'

/**
 * Ticket images live in IndexedDB, not localStorage.
 *
 * localStorage is a ~5 MB *string* store. A handful of ticket screenshots
 * base64-encoded would blow past that, and the failure mode is the worst
 * available: the whole persisted trip — itinerary, expenses, packing — fails to
 * write. IndexedDB stores Blobs natively, has orders of magnitude more room, and
 * keeps ticket images off the hot path of everything else.
 *
 * No dependency: this is the ~4 methods of the IDB API the app actually needs.
 */

const STORE = 'assets'
const VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('This browser has no IndexedDB, so tickets cannot be stored.'))
      return
    }
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open the ticket store.'))
    // Another tab holding an old version open would block us forever otherwise.
    req.onblocked = () => reject(new Error('Close the app’s other tabs and try again.'))
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const req = run(t.objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('Ticket store operation failed.'))
      }),
  )
}

export const putAsset = (id: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, id))
export const getAsset = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id))
export const deleteAsset = (id: string) => tx('readwrite', (s) => s.delete(id))
export const allAssetIds = () => tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys())

/** Roughly how much room is left, when the browser will say. */
export async function storageEstimate(): Promise<{ usedMb: number; quotaMb: number } | null> {
  try {
    const e = await navigator.storage?.estimate?.()
    if (!e?.quota) return null
    return {
      usedMb: Math.round(((e.usage ?? 0) / 1048576) * 10) / 10,
      quotaMb: Math.round((e.quota / 1048576) * 10) / 10,
    }
  } catch {
    return null
  }
}

/** Anything bigger than this is a photo of a wall, not a ticket. */
export const MAX_PASS_BYTES = 12 * 1024 * 1024

export class TicketStoreError extends Error {}

/**
 * Store one image and return its asset id. Downscales large camera photos —
 * a 12 MP shot of a screen is ~4 MB of no extra scannable detail, and keeping
 * them raw is what eventually hits the quota.
 */
export async function savePassImage(file: File): Promise<{ assetId: string; mime: string }> {
  if (!file.type.startsWith('image/')) {
    throw new TicketStoreError('That is not an image. Screenshot the ticket and add the picture.')
  }
  if (file.size > MAX_PASS_BYTES) {
    throw new TicketStoreError('That image is enormous — try a screenshot rather than a photo.')
  }

  const blob = await downscale(file)
  const assetId = `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  try {
    await putAsset(assetId, blob)
  } catch (e) {
    const name = (e as { name?: string })?.name
    if (name === 'QuotaExceededError') {
      throw new TicketStoreError('This device is out of storage. Delete a ticket you no longer need.')
    }
    throw new TicketStoreError(
      e instanceof Error ? e.message : 'Could not save that image on this device.',
    )
  }
  return { assetId, mime: blob.type || file.type }
}

/**
 * Cap the long edge at 2000px. Comfortably above what any gate scanner needs off
 * a phone screen, and well under what a modern camera produces.
 */
const MAX_EDGE = 2000

async function downscale(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap
    const longest = Math.max(width, height)
    if (longest <= MAX_EDGE) {
      bitmap.close()
      return file
    }
    const scale = MAX_EDGE / longest
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    // A QR survives resampling fine, but keep it crisp rather than smooth.
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    )
    return out && out.size < file.size ? out : file
  } catch {
    // Any failure here is cosmetic — store the original.
    return file
  }
}

/** Delete every asset belonging to a ticket. Best-effort; never throws. */
export async function deletePassAssets(assetIds: string[]): Promise<void> {
  await Promise.allSettled(assetIds.map((id) => deleteAsset(id)))
}

/**
 * Drop assets no ticket references any more — the cleanup for an interrupted
 * add, or a ticket deleted while offline.
 */
export async function pruneOrphans(keep: Set<string>): Promise<number> {
  try {
    const ids = await allAssetIds()
    const orphans = ids.map(String).filter((id) => !keep.has(id))
    await Promise.allSettled(orphans.map((id) => deleteAsset(id)))
    return orphans.length
  } catch {
    return 0
  }
}
