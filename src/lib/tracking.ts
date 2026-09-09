import { useEffect, useRef, useState } from 'react'
import { useTrip } from './store'
import { useAllItems } from './hooks'
import { dayForDate, endOf, itemsForDay, ymd } from './trip'
import { haversineKm, toMinutes } from './geo'
import type { ItineraryItem, LatLng } from './types'

const ARRIVED_KM = 0.25
const NUDGE_BEFORE_MIN = 10

export interface TrackingState {
  position: LatLng | null
  accuracy: number | null
  error: string | null
  /** The stop you appear to be standing in right now. */
  atStop: ItineraryItem | null
  /** What is next today, once the current stop is nearly up. */
  nextStop: ItineraryItem | null
}

/**
 * Opt-in day-of mode. Watches position, notices when you have actually
 * reached the next stop, and nudges when the time you set aside for it is
 * nearly gone. Nothing here runs unless the user turns tracking on.
 */
export function useLiveTracking(notify: (text: string) => void): TrackingState {
  const tracking = useTrip((s) => s.tracking)
  const setup = useTrip((s) => s.setup)
  const updateItem = useTrip((s) => s.updateItem)
  const items = useTrip((s) => s.items)
  const all = useAllItems()

  const [position, setPosition] = useState<LatLng | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const nudged = useRef<Set<string>>(new Set())
  const arrived = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!tracking) {
      setPosition(null)
      setError(null)
      return
    }
    if (!('geolocation' in navigator)) {
      setError('This device has no geolocation.')
      return
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude })
        setAccuracy(p.coords.accuracy)
        setError(null)
      },
      (e) => setError(e.code === e.PERMISSION_DENIED ? 'Location permission denied.' : e.message),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [tracking])

  useEffect(() => {
    if (!tracking) return
    const t = setInterval(() => setTick((n) => n + 1), 45000)
    return () => clearInterval(t)
  }, [tracking])

  const today = dayForDate(setup, ymd(new Date()))
  const todayItems = today ? itemsForDay(all, today) : []

  let atStop: ItineraryItem | null = null
  let nextStop: ItineraryItem | null = null

  if (tracking && today) {
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
    for (let i = 0; i < todayItems.length; i++) {
      const it = todayItems[i]
      const s = toMinutes(it.start)
      const e = toMinutes(endOf(it))
      if (nowMin >= s - 30 && nowMin <= e + 30) {
        atStop = it
        nextStop = todayItems[i + 1] ?? null
        break
      }
      if (nowMin < s && !nextStop) nextStop = it
    }
    if (position && atStop?.coords) {
      const km = haversineKm(position, atStop.coords)
      if (km > ARRIVED_KM) atStop = null
    }
  }

  // Record arrival, once, when you are genuinely there.
  useEffect(() => {
    if (!tracking || !position || !today) return
    for (const it of todayItems) {
      if (!it.coords || it.locked) continue
      if (arrived.current.has(it.id)) continue
      if (haversineKm(position, it.coords) <= ARRIVED_KM) {
        arrived.current.add(it.id)
        if (!items.find((x) => x.id === it.id)?.arrivedAt) {
          updateItem(it.id, { arrivedAt: Date.now() })
          notify(`Marked you as arrived at ${it.name}.`)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, tracking, today, tick])

  // Nudge when the slot you gave a stop is nearly gone.
  useEffect(() => {
    if (!tracking || !today) return
    const now = new Date()
    const nowMin = now.getHours() * 60 + now.getMinutes()
    for (let i = 0; i < todayItems.length; i++) {
      const it = todayItems[i]
      const endMin = toMinutes(endOf(it))
      const next = todayItems[i + 1]
      if (nudged.current.has(it.id)) continue
      const near = endMin - nowMin
      if (near > 0 && near <= NUDGE_BEFORE_MIN) {
        const wasHere = it.arrivedAt || (position && it.coords && haversineKm(position, it.coords) <= ARRIVED_KM)
        if (!wasHere) continue
        nudged.current.add(it.id)
        const msg = next
          ? `${near}m left at ${it.name} — ${next.name} is next at ${next.start}.`
          : `${near}m left at ${it.name}, last stop of the day.`
        notify(msg)
        pushNotification(msg)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, tracking, today, position])

  return { position, accuracy, error, atStop, nextStop }
}

function pushNotification(body: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('SG Trip', { body, tag: 'sg-trip-nudge' })
    }
  } catch {
    /* notifications are a bonus, never a requirement */
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    const r = await Notification.requestPermission()
    return r === 'granted'
  } catch {
    return false
  }
}
