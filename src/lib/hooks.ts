import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTrip } from './store'
import { allItems } from './trip'
import { aiCall, type AiCallOptions, type AiReply } from './ai'
import { fetchForecast, fetchRate, wikiSummary, type DayWeather } from './free'
import type { Place } from './types'

/** The itinerary as it actually is: fixed blocks merged with user stops. */
export function useAllItems() {
  const items = useTrip((s) => s.items)
  const setup = useTrip((s) => s.setup)
  const anchors = useTrip((s) => s.anchors)
  const stay = useTrip((s) => s.stay)
  return useMemo(() => allItems(items, setup, anchors, stay), [items, setup, anchors, stay])
}

export function useTripContext() {
  const setup = useTrip((s) => s.setup)
  const stay = useTrip((s) => s.stay)
  const customPlaces = useTrip((s) => s.customPlaces)
  const all = useAllItems()
  return useMemo(() => ({ setup, stay, all, customPlaces }), [setup, stay, all, customPlaces])
}

/** Every AI call in the app goes through here, so the counter cannot be dodged. */
export function useAi() {
  const apiKey = useTrip((s) => s.apiKey)
  const aiCalls = useTrip((s) => s.aiCalls)
  const aiBudget = useTrip((s) => s.aiBudget)
  const noteAiCall = useTrip((s) => s.noteAiCall)

  const call = useCallback(
    (opts: AiCallOptions): Promise<AiReply> =>
      aiCall(
        {
          apiKey,
          calls: aiCalls,
          budget: aiBudget,
          onSpend: (usd) => noteAiCall(usd),
        },
        opts,
      ),
    [apiKey, aiCalls, aiBudget, noteAiCall],
  )

  return { call, hasKey: Boolean(apiKey), aiCalls, aiBudget }
}

/** Wikipedia photo + summary, cached on device so it is fetched once. */
export function usePlaceInfo(place: Place | null) {
  const cache = useTrip((s) => s.placeInfo)
  const cachePlaceInfo = useTrip((s) => s.cachePlaceInfo)
  const key = place?.wiki ?? ''
  const hit = key ? cache[key] : undefined
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!key || hit) return
    let cancelled = false
    setLoading(true)
    wikiSummary(key)
      .then((r) => {
        if (cancelled) return
        cachePlaceInfo(key, {
          extract: r?.extract ?? '',
          photo: r?.photo ?? null,
          fetchedAt: Date.now(),
        })
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [key, hit, cachePlaceInfo])

  return { info: hit ?? null, loading }
}

const FX_TTL = 1000 * 60 * 60 * 12

/** SGD → home currency, refreshed at most twice a day. */
export function useFx() {
  const fx = useTrip((s) => s.fx)
  const setFx = useTrip((s) => s.setFx)
  const home = useTrip((s) => s.setup.homeCurrency)
  const [loading, setLoading] = useState(false)

  const stale =
    !fx || fx.quote !== home || fx.base !== 'SGD' || Date.now() - fx.fetchedAt > FX_TTL

  const refresh = useCallback(async () => {
    setLoading(true)
    const r = await fetchRate('SGD', home)
    if (r) setFx({ base: 'SGD', quote: home, rate: r.rate, asOf: r.asOf, fetchedAt: Date.now() })
    setLoading(false)
  }, [home, setFx])

  useEffect(() => {
    if (stale) void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale])

  return { fx: fx && fx.quote === home ? fx : null, loading, refresh }
}

const WEATHER_KEY = 'sg-trip-weather-v1'

/** Free forecast, cached in localStorage for three hours. */
export function useWeather() {
  const [days, setDays] = useState<DayWeather[] | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WEATHER_KEY)
      if (raw) {
        const j = JSON.parse(raw)
        if (Date.now() - j.at < 1000 * 60 * 60 * 3) {
          setDays(j.days)
          return
        }
      }
    } catch {
      /* ignore */
    }
    let cancelled = false
    fetchForecast({ lat: 1.3, lng: 103.85 }).then((d) => {
      if (cancelled || !d) return
      setDays(d)
      try {
        localStorage.setItem(WEATHER_KEY, JSON.stringify({ at: Date.now(), days: d }))
      } catch {
        /* quota, private mode — not important */
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  return days
}

export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

/** Ticks once a minute — enough for "now" markers without burning battery. */
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
