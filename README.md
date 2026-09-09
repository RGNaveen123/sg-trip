# SG Trip

An installable, offline-first trip planner for a five-day Singapore trip —
Kochi → Singapore on Singapore Airlines, landing 06:00 on 17 Dec, flying home
20:20 on 21 Dec. Built to be used on a phone, one-handed, outdoors.

No account, no backend. Everything lives in `localStorage` on the device. The
only network calls are to the Anthropic API (with your own key) and a handful of
free, keyless public APIs.

---

## Running it

```bash
npm install
npm run dev
```

| script | what it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | typecheck, then production build into `dist/` |
| `npm run preview` | serve the built `dist/` locally |
| `npm run selftest` | 55 assertions over the trip logic and the AI validation gate |
| `npm run icons` | regenerate the PWA icons from `scripts/make-icons.mjs` |

## Putting it on a phone

`npm run build` produces a fully static `dist/`. Host it anywhere that serves
over **HTTPS** — Netlify, Vercel, GitHub Pages, Cloudflare Pages — then open it
in Chrome on the phone and use *Add to Home Screen*. `base` is `'./'`, so it
works from a subpath without configuration.

HTTPS matters: a service worker will not register over plain HTTP, and without
it there is no offline mode. If registration fails, Settings says so in red
rather than pretending everything is fine.

### Knowing what your phone is actually running

Stale caches silently serving an old build were the most confusing part of the
previous version, so:

- Settings shows the **build id** baked in at compile time.
- A new build announces itself with a banner at the top of every screen.
- The app re-checks for a new build each time it comes back to the foreground.
- **Check** and **Update & reload** in Settings force the issue.

## What is fixed and what is not

Five blocks are generated from trip setup rather than stored, so changing a
flight time moves them instead of leaving a stale copy behind. Nothing — not
you, not the model — can delete or move them:

| block | when |
| --- | --- |
| Land at Changi, immigration & bags | arrival time, 90 min |
| Travel to the guest house, drop bags | after that, 90 min — *only once a stay is set* |
| Universal Studios Singapore | 18 Dec, 09:30–19:00 |
| Concert at the National Stadium | 20 Dec, 16:00–22:00 (3 h early for Express entry) |
| Changi check-in and fly home | 21 Dec, 17:20–20:20 |

Dates for Universal, the concert and the flights are editable in Settings; the
blocks follow.

The accommodation is a relative's guest house. It is never called a hotel,
including in the prompt sent to the model.

## Money and AI

Every call uses `claude-haiku-4-5-20251001`, the cheapest model available. This
is deliberate — do not quietly upgrade it.

- Nothing calls the API on its own. Every AI feature is a button you press.
- Each one is labelled with its cost tier before you press it: **text**
  (cheapest), **vision** (a photo costs more), **web search** (billed per search
  on top of tokens — the priciest thing in the app).
- Settings keeps a running count of calls and an approximate dollar spend
  derived from the token usage the API reports.
- Crossing your check-in threshold prompts **once**, before the call goes out.
  Agree and the threshold moves up, so you are not asked again on the next call.

Free APIs are used wherever one exists, and none of them need a key:

| what | source |
| --- | --- |
| place photos and summaries | Wikipedia REST summary |
| geocoding | Nominatim (OpenStreetMap) |
| map tiles | `tile.openstreetmap.org`, darkened in CSS |
| directions and live traffic | Google Maps deep links |
| exchange rate | open.er-api.com, cached 12 h |
| weather | Open-Meteo, cached 3 h |
| videos | YouTube search links |

## Never trusting the model with the plan

When you ask the assistant to change something it replies with prose plus a
fenced `trip-actions` block. That block is **not** applied. It is parsed, and
every action is checked against the itinerary as it actually is right now:

- day must be inside the trip
- start must be a real `HH:MM`
- duration between 15 minutes and 12 hours, not running past midnight
- `placeId` must exist in the catalogue
- ids for move/remove must exist and must not be a locked block

Whatever survives is shown as a diff card with an **Apply** button. Whatever
does not is shown too, struck through, with the reason. Applying is undoable
from the toast. `npm run selftest` covers all of this.

## Custom places, and why short links are awkward

A full `google.com/maps/@1.28,103.86` link has the coordinates in it. A
`maps.app.goo.gl` link does not — only the server that issued it knows where it
points, and a browser cannot read a cross-origin redirect. So resolution is
layered, and the UI shows you which step succeeded:

1. read coordinates straight out of the URL
2. ask a public CORS proxy to follow the redirect and scrape them out
3. pull a place name out of the URL and geocode that on OpenStreetMap
4. geocode whatever name you typed
5. only then, and only if you tap it, an AI web search — clearly marked as the
   most expensive call in the app

Every path ends at a map pin you confirm before saving.

## Layout

```
src/
  App.tsx            shell: header, tabs, budget gate, update banner
  screens/           Itinerary · Places · Map · Money · Ask · Settings · Kit
  components/        Sheet/Btn/Chip primitives, map, schedule & place sheets
  lib/
    trip.ts          dates, fixed blocks, travel legs, free slots, warnings
    ai.ts            the model call, the prompt, and the validation gate
    geo.ts           distance, travel estimates, maps links, URL parsing
    free.ts          every keyless public API
    tracking.ts      opt-in day-of geolocation
    store.ts         zustand + localStorage
  data/places.ts     the curated Singapore catalogue
scripts/
  selftest.ts        logic tests
  make-icons.mjs     PNG icon generator (no image dependencies)
```

Two notes for whoever touches this next:

- Bottom sheets render through a portal on purpose. An animated `transform`
  anywhere up the tree becomes the containing block for `position: fixed`
  descendants, and the sheet stops being pinned to the viewport.
- Tab switching has an enter animation but no exit animation. Waiting for the
  old screen to fade out puts a visible delay on every single tab tap.
