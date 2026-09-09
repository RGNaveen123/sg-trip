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
| `npm run selftest` | 75 assertions over the trip logic, the settlement maths and the AI validation gate |
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

## Splitting the bill

Every expense records **who paid** and **who it was for**, so the Spend tab can
answer the question a group trip actually has: not "what did we spend" but "who
hands what to whom at the end".

- Roster of people lives in Settings. Renaming someone rewrites every expense
  they appear in, so the ledger never breaks.
- An expense is *just me*, an *equal split* between any subset of the party, a
  *custom split* with per-person amounts, or *paid on behalf of* others (the
  payer consumes none of it).
- **Settle up** shows each person's paid / used / net, then the fewest payments
  that clear every balance — at most one fewer than the number of people.

All settlement arithmetic is in integer cents. Splitting S$10 three ways in
floating point gives three shares that do not add back to S$10, and those
fractions of a cent compound into a settlement that does not balance; the odd
cents are handed to real people instead. `splitCents`, the ledger and the
transfer solver are covered by the selftest, including the invariant that the
ledger always nets to zero.

Expenses logged before the roster existed still work — they are read as "you
paid, split across the group" and the settle-up panel says how many entries it
had to assume that about.

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

## Pinning a location

Three independent ways, offered in the order they actually work. The same
component does custom places and the stay location.

**Search** is the default and handles almost everything. It queries
[OneMap](https://www.onemap.gov.sg) — the Singapore Land Authority's own
gazetteer — before anything else, so building names, hawker centres, HDB blocks
and **six-digit postal codes** all resolve exactly, with the full address shown.
A postal code is the surest input there is: it identifies one building. If
OneMap has nothing it falls back to Photon, then Nominatim.

**Drop a pin** shows a map and takes a tap. No lookup, no network, nothing to
fail — the option that always works. There is a "use where I am now" button too.

**Link** is last on purpose. A full `google.com/maps/@1.28,103.86` URL has the
coordinates in it, but a `maps.app.goo.gl` short link does not — only the server
that issued it knows where it points, and a browser cannot read a cross-origin
redirect. The app tries a public CORS proxy and then the place name embedded in
the URL, showing you which step succeeded, but this path genuinely fails often.
Pasting raw coordinates works reliably: long-press the spot in Google Maps and
copy the numbers it shows.

An AI web search is offered only after the free routes come up empty, only when
you tap it, and is labelled as the most expensive call in the app.

Every path ends at a map pin you confirm before saving.

## Layout

```
src/
  App.tsx            shell: header, tabs, budget gate, update banner
  screens/           Itinerary · Places · Map · Money · Ask · Settings · Kit
  components/        Sheet/Btn/Chip primitives, map, schedule & place sheets
  lib/
    trip.ts          dates, fixed blocks, travel legs, free slots, warnings
    settle.ts        the who-owes-whom ledger, in integer cents
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

- There are two error boundaries. The outer one in `main.tsx` catches anything;
  the inner one in `App.tsx` is keyed by tab, so a crash on one screen leaves
  the header, the nav and every other tab working — switching away and back
  clears it. Both offer a backup export before you do anything drastic.

- Bottom sheets render through a portal on purpose. An animated `transform`
  anywhere up the tree becomes the containing block for `position: fixed`
  descendants, and the sheet stops being pinned to the viewport.
- Tab switching has an enter animation but no exit animation. Waiting for the
  old screen to fade out puts a visible delay on every single tab tap.
