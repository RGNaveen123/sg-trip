# SG Trip — working notes for Claude

A personal, offline-first PWA trip planner for **three siblings in Singapore,
15–21 Dec 2026**. Not a product. One device, no backend, no accounts.

Read this before changing anything. Most of what follows is *why*, not *what* —
the what is in the code.

---

## Commands

```bash
npm run dev        # vite dev server
npm run build      # tsc --noEmit, then vite build  (CI runs this)
npm run selftest   # 94 assertions over the trip, MRT routing, settlement and AI-validation logic
npm run icons      # regenerate PWA icons (pure-node PNG writer, no image deps)
```

`npm run selftest` is the real test suite. It bundles `scripts/selftest.ts` with
esbuild and runs it in node. **Add to it whenever you touch trip maths, the
settlement ledger, or the AI validation gate.** CI runs build + selftest before
every deploy.

---

## Trip facts that must stay true

| | |
|---|---|
| Route | Kochi → Singapore, round trip, Singapore Airlines |
| Out | leaves Kochi night of 14 Dec, lands Singapore **06:00, 15 Dec** |
| Back | leaves Singapore **20:20, 21 Dec** |
| Stay | a relative's flat, Blk 205 Yishun Street 21, postal 760205. **A guest house — never call it a hotel, anywhere, including in prompts** |
| Universal Studios | 18 Dec, full day |
| Concert | 20 Dec, National Stadium, ~19:00, arrive 3 h early for Express entry |
| Night Safari | wants an evening slot somewhere |
| Money | budget-conscious. MRT/bus is the default; taxi is a flagged fallback for genuinely tight transitions, not a default |

---

## Non-negotiable rules

### AI spend

The user pays for every call from their own key and has raised this repeatedly.

- Cheapest model only — `claude-haiku-4-5-20251001`. **Never quietly upgrade it.**
- **Nothing calls the API automatically.** Every AI feature is a deliberate tap.
- Each is labelled with its cost tier before it runs: text (cheapest), vision,
  web search (billed per search, priciest).
- Visible call count, approximate dollar spend, and a soft budget that prompts
  once then raises itself.
- Route every call through `useAi()` in `src/lib/hooks.ts` so the counter, spend
  and gate all apply. Label with `TIER_LABEL` from `src/lib/ai.ts`.

A staleness- or background-triggered refresh is exactly the automatic call these
rules forbid. This is why place prices are curated and date-stamped, not fetched.

### Free APIs by default

Only reach for a paid one when there is genuinely no free equivalent, and say so
first. Everything in `src/lib/free.ts` is keyless: Wikipedia (photos + summaries),
**OneMap** (Singapore's official address register — building names, HDB blocks,
six-digit postal codes), Photon, Nominatim, open-meteo, open.er-api.com.

### Offline-first

The service worker precaches the whole shell. Trip data, expenses and ticket
images are all local. Never add a runtime network dependency to something that
has to work at a gate or in a park.

### Never trust model output

Model-proposed itinerary edits arrive in a fenced ```trip-actions``` block and are
**parsed, validated against the live plan, and shown as a diff the user taps to
apply**. Validation lives in `validateActions()` in `src/lib/ai.ts`; it rejects
out-of-range days, bad times, impossible durations, unknown place ids, and any
attempt to touch a locked block. Rejections are shown with reasons, never
swallowed.

---

## Layout

```
src/
  App.tsx            shell: header, 5 bottom tabs, lazy screens, error boundaries,
                     AI budget gate, dynamic document.title
  screens/           Itinerary · Places · Tickets · Money · Ask · Map · Kit · Settings
  components/
    ui.tsx           Sheet, Btn, Chip, Segmented, Field, Toasts, Ticker, spring
    TicketViewer     full-screen pass display (see below)
    LocationFinder   search / drop-a-pin / link — shared by places and the stay
    MapView+LazyMap  Leaflet, loaded as its own chunk
  lib/
    trip.ts          dates, fixed blocks, travel legs, free slots, warnings
    settle.ts        who-owes-whom ledger, in integer cents
    ai.ts            the model call, the prompt, the validation gate
    geo.ts           distance, travel estimates, maps links, URL coordinate parsing
    mrt.ts           offline MRT routing (Dijkstra over the line graph, plus the
                     Mandai Khatib and Sentosa Express shuttles) — every transit
                     estimate goes through estimateJourney()
    free.ts          every keyless public API
    tickets.ts       IndexedDB blob store for ticket images
    tracking.ts      opt-in day-of geolocation
    store.ts         zustand + persist (localStorage)
    storageKey.ts    namespaces storage so the preview build can't eat live data
  data/places.ts     ~65 curated Singapore places, incl. a Yishun set near the stay
  data/mrt.ts        137 MRT stations (OneMap positions, frozen) and line order
scripts/
  selftest.ts        the test suite
  make-icons.mjs     PNG icon generator, no image dependencies
```

---

## Decisions that look odd but are deliberate

**Fixed blocks are derived, not stored.** `fixedBlocks()` in `src/lib/trip.ts`
generates arrival, transfer, Universal, concert and departure from trip setup on
every read. Change a flight time and they move, instead of a stale copy lingering.
Nothing — user or model — can edit or delete them.

**Anchors are absolute dates, and strand loudly.** Universal and the concert are
pinned to real calendar dates because the bookings are. If the flights move so an
anchor falls outside the trip, `strandedAnchors()` reports it at danger level and
Settings offers a one-tap fix. It does **not** silently shift them — a real
booking doesn't move when a flight does.

**Settlement maths is in integer cents.** Splitting S$10 three ways in floating
point gives shares that don't add back to S$10, and the error compounds into a
settlement that won't balance. Odd cents go to real people. The selftest asserts
the ledger always nets to zero.

**Ticket QRs are never decoded.** The viewer shows the original image. The scanner
at the gate reads the same pixels it would read off the airline's own page;
re-rendering would add a failure mode for no gain. The viewer also forces a
**light background** regardless of theme (scanners struggle on dark) and takes a
`navigator.wakeLock` so the screen doesn't sleep in a queue.

**A ticket is a folder of labelled passes**, not one image — one booking usually
covers three people. Labels are free text with the roster offered as chips,
because the label is a person for a concert, a leg for a flight, a seat for a coach.

**Ticket images live in IndexedDB, not localStorage.** localStorage is a ~5 MB
*string* store; a few screenshots would blow it and take the whole trip's data
down with it. Measured: 3 passes ≈ 120 KB against a 2.7 GB quota.

**Prices are curated and date-stamped, never fetched.** Official sites 404 any
fetcher (Resorts World Sentosa, Gardens by the Bay — they open fine in a phone
browser, so *linking* works). Aggregators contradict each other: Universal Express
Pass is quoted as both "from S$291" and "~S$80". That spread is the answer, not a
failure — Express is date-tiered and 18 Dec is in the December school holidays, at
the top end.

**Short Google Maps links contain no coordinates.** Only the server that issued a
`maps.app.goo.gl` link knows where it points, and a browser can't read a
cross-origin redirect. That path is last and honest about failing; search by
name or postal code, or tapping the map, are the reliable routes.

**Text wraps, it does not truncate.** A deliberate reversal. The one structural
exception is the header title. Don't reintroduce `truncate` / `line-clamp` on
content.

---

## Traps that bite silently

- **The AI budget gate must stay mounted in `App.tsx`.** `setBudgetConfirmer`
  registers in an effect and nulls on cleanup; `ai.ts` checks
  `if (calls >= budget && confirmer)`. Move that Sheet into a screen and it
  unmounts on every tab switch — the gate stops firing with no error, no visible
  change, and calls sail through.
- **No nested `<button>`s.** The itinerary stop card was a button containing
  buttons; it was invalid HTML, bad for screen readers, and silently ate clicks.
  Cards are divs with only the summary row clickable. Check
  `document.querySelectorAll('button button').length === 0` after touching cards.
- **Leaflet's stylesheet loads after ours** now that the map is a lazy chunk, and
  it sets `.leaflet-tile { filter: inherit }`. Our dark-tile filter is qualified
  as `.leaflet-container .leaflet-tile` to outrank it whatever the load order.
- **Browser storage is per-origin, not per-path.** The preview build at
  `/preview/` shares an origin with live, so `src/lib/storageKey.ts` namespaces
  both the persist key and the IndexedDB name. Don't hardcode `'sg-trip-v1'`.
- **Hard-coded chrome offsets.** `Toasts` is `bottom-[86px]`; `MapScreen` is
  `calc(100dvh - 290px)`. Both are tuned to the current nav and header heights.
- **Nothing dated may be baked into `index.html` or the manifest.** The title is
  written at runtime from trip setup; the manifest name is undated on purpose
  because a manifest can't follow the data and is the home-screen label.
- **Writing source via shell heredocs mangles backslash escapes.** A `\b` in a
  regex became a literal backspace byte once and silently broke title-casing. Use
  the file tools for source, or avoid escapes.
- **GitHub Pages serves one deployment per repo.** Hence the `gh-pages` branch
  with live at the root and preview in `/preview`, both with `keep_files: true`.

---

## Branches and deploy

- `main` — live at `https://rgnaveen123.github.io/sg-trip/`
- `v2` — in progress, publishes to `/sg-trip/preview/`
- `gh-pages` — the published output of both. Pages source must be
  **Deploy from a branch → `gh-pages` → `/ (root)`**.

Workflows build, typecheck and run the selftest before publishing.

### v2 status

Done: the ticket wallet, the no-truncation sweep, stranded-anchor warnings.
Planned next, in order: light/dark themes → new Home screen and restyle →
arrival alerts with a countdown → curated place costs and tips.

The full plan lives at
`C:\Users\navee\.claude\plans\so-we-gonna-change-validated-puddle.md`.

---

## Future, explicitly parked

Generalising beyond Singapore, shared user-added places, community reviews and
ratings. **Not to be built yet.** Knowing it's coming is a reason to keep
Singapore-specific things (the place catalogue, OneMap, the Basics tab) in
separable modules — not a reason to abstract early.
