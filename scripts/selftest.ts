/**
 * Checks the parts that must not be wrong: the fixed blocks, travel legs, and
 * above all the validation gate that stands between the model and the plan.
 * Run with `npm run selftest`.
 */
import { applyActions, extractActions, validateActions } from '../src/lib/ai'
import {
  DEFAULT_ANCHORS,
  DEFAULT_SETUP,
  dayCount,
  fixedBlocks,
  freeSlots,
  legsForDay,
  itemsForDay,
  allItems,
  tripWarnings,
} from '../src/lib/trip'
import { parseCoordsFromUrl, isShortenedMapsLink, estimateTravel } from '../src/lib/geo'
import type { ItineraryItem, Stay } from '../src/lib/types'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass++
  } else {
    fail++
    console.error(`  FAIL  ${name}`, extra ?? '')
    return
  }
  console.log(`   ok   ${name}`)
}

const setup = DEFAULT_SETUP
const anchors = DEFAULT_ANCHORS
const stay: Stay = {
  name: 'Guest house',
  coords: { lat: 1.3236, lng: 103.9273 },
  area: 'Katong & Joo Chiat',
  rawInput: '',
}

console.log('\n— trip shape —')
ok('five days on the ground', dayCount(setup) === 5, dayCount(setup))

const fixed = fixedBlocks(setup, anchors, stay)
const ids = fixed.map((f) => f.id)
ok('arrival block exists', ids.includes('fx-arrival'))
ok('transfer block appears once a stay is set', ids.includes('fx-transfer'))
ok(
  'no transfer block without a stay',
  !fixedBlocks(setup, anchors, null).some((f) => f.id === 'fx-transfer'),
)
ok('Universal lands on day 2', fixed.find((f) => f.id === 'fx-uss')?.day === 2)
ok('concert lands on day 4', fixed.find((f) => f.id === 'fx-concert')?.day === 4)
ok(
  'concert starts three hours before the show',
  fixed.find((f) => f.id === 'fx-concert')?.start === '16:00',
)
ok(
  'concert block runs to 22:00',
  fixed.find((f) => f.id === 'fx-concert')?.durationMin === 360,
)
ok(
  'departure block starts 3h before the 20:20 flight',
  fixed.find((f) => f.id === 'fx-departure')?.start === '17:20',
)
ok('departure sits on the last day', fixed.find((f) => f.id === 'fx-departure')?.day === 5)
ok('every fixed block is locked', fixed.every((f) => f.locked))

console.log('\n— travel legs —')
const userItems: ItineraryItem[] = [
  {
    id: 'u1',
    day: 1,
    start: '12:30',
    durationMin: 60,
    name: 'Maxwell Food Centre',
    placeId: 'maxwell',
    coords: { lat: 1.2803, lng: 103.8449 },
  },
  {
    id: 'u2',
    day: 1,
    start: '13:35',
    durationMin: 45,
    name: 'Gardens by the Bay',
    placeId: 'gardens-bay',
    coords: { lat: 1.2816, lng: 103.8636 },
  },
]
const all = allItems(userItems, setup, anchors, stay)
const day1 = itemsForDay(all, 1)
const legs = legsForDay(day1, stay)

ok('no leg drawn into the arrival block', legs.find((l) => l.to.id === 'fx-arrival')?.hidden === true)
ok('no leg drawn into the transfer block', legs.find((l) => l.to.id === 'fx-transfer')?.hidden === true)
const toMaxwell = legs.find((l) => l.to.id === 'u1')!
ok('leaving the transfer block reads as leaving the guest house', toMaxwell.from?.name === 'Guest house')
ok('that leg has a real estimate', (toMaxwell.estimate?.km ?? 0) > 5)
const tightLeg = legs.find((l) => l.to.id === 'u2')!
ok('a 5-minute gap across town is flagged tight', tightLeg.tight, tightLeg.gapMin)
ok('tight legs fall back to a taxi when it fits', tightLeg.mode === 'taxi' || tightLeg.tight)

const lateNight = legsForDay(
  [
    { id: 'a', day: 2, start: '20:00', durationMin: 60, name: 'A', coords: { lat: 1.28, lng: 103.84 } },
    { id: 'b', day: 2, start: '23:45', durationMin: 45, name: 'B', coords: { lat: 1.4, lng: 103.79 } },
  ],
  stay,
)
ok('after the last train, a taxi is suggested', lateNight[1].mode === 'taxi' && lateNight[1].lateNight)

console.log('\n— free slots —')
const slots = freeSlots(all, setup)
ok('day 2 has no free slot before Universal opens at 09:30', !slots.some((s) => s.day === 2 && s.start < '09:30'))
ok('day 1 never offers a slot before the plane lands', !slots.some((s) => s.day === 1 && s.start < '06:00'))
ok('there are open slots to fill', slots.length > 0, slots.length)

console.log('\n— action extraction —')
const reply = `I moved dinner later so you are not sprinting.

\`\`\`trip-actions
{"actions":[{"op":"add","day":3,"start":"19:15","durationMin":210,"name":"Night Safari","placeId":"night-safari"}]}
\`\`\``
const parsed = extractActions(reply)
ok('prose is separated from the action block', !parsed.prose.includes('trip-actions'))
ok('one action parsed', parsed.raw.length === 1)
ok('a reply with no block yields no actions', extractActions('Just chatting.').raw.length === 0)
ok('malformed JSON is survivable', extractActions('```trip-actions\n{oops\n```').raw.length === 0)

console.log('\n— validation gate —')
const ctx = { setup, all, customPlaces: [] }
const results = validateActions(
  [
    { op: 'add', day: 3, start: '19:15', durationMin: 210, name: 'Night Safari', placeId: 'night-safari' },
    { op: 'add', day: 9, start: '10:00', durationMin: 60, name: 'Off the end of the trip' },
    { op: 'add', day: 2, start: '25:00', durationMin: 60, name: 'Bad time' },
    { op: 'add', day: 2, start: '10:00', durationMin: 5, name: 'Too short' },
    { op: 'add', day: 2, start: '23:30', durationMin: 120, name: 'Runs past midnight' },
    { op: 'add', day: 2, start: '10:00', durationMin: 60, name: 'Ghost', placeId: 'not-a-real-place' },
    { op: 'move', id: 'fx-uss', day: 3 },
    { op: 'remove', id: 'fx-concert' },
    { op: 'move', id: 'nope-not-here', day: 2 },
    { op: 'move', id: 'u1', day: 2, start: '11:00' },
    { op: 'remove', id: 'u2' },
  ],
  ctx,
)

const byName = (frag: string) => results.find((r) => r.summary.includes(frag))!
ok('a good add passes', byName('Night Safari').ok)
ok('a day outside the trip is rejected', !byName('Off the end of the trip').ok)
ok('an invalid time is rejected', !byName('Bad time').ok)
ok('a 5-minute stop is rejected', !byName('Too short').ok)
ok('a stop running past midnight is rejected', !byName('Runs past midnight').ok)
ok('an unknown placeId is rejected', !byName('Ghost').ok)
ok('moving Universal is refused', !results.find((r) => r.action.op === 'move' && (r.action as { id: string }).id === 'fx-uss')!.ok)
ok('removing the concert is refused', !results.find((r) => r.action.op === 'remove' && (r.action as { id: string }).id === 'fx-concert')!.ok)
ok('an unknown id is refused', !results.find((r) => r.action.op === 'move' && (r.action as { id: string }).id === 'nope-not-here')!.ok)
ok('a legitimate move passes', results.find((r) => r.action.op === 'move' && (r.action as { id: string }).id === 'u1')!.ok)
ok('a legitimate remove passes', results.find((r) => r.action.op === 'remove' && (r.action as { id: string }).id === 'u2')!.ok)
ok('every rejection carries a reason', results.filter((r) => !r.ok).every((r) => Boolean(r.reason)))
ok('garbage input does not throw', validateActions([null, 'x', 42, { op: 'nonsense' }], ctx).length === 0)

console.log('\n— applying —')
const applied = applyActions(userItems, results, [])
ok('rejected actions changed nothing they touched', applied.some((i) => i.id === 'u1'))
ok('the accepted remove happened', !applied.some((i) => i.id === 'u2'))
ok('the accepted move happened', applied.find((i) => i.id === 'u1')?.day === 2)
ok('the accepted add happened', applied.some((i) => i.placeId === 'night-safari'))
ok(
  'the added stop got coordinates from the catalogue',
  Boolean(applied.find((i) => i.placeId === 'night-safari')?.coords),
)
ok(
  'locked blocks are untouched because they are never in the editable list',
  !applied.some((i) => i.id.startsWith('fx-')),
)

console.log('\n— map links —')
ok(
  'coordinates come out of a full maps URL',
  parseCoordsFromUrl('https://www.google.com/maps/@1.2834,103.8607,17z')?.lat === 1.2834,
)
ok(
  'coordinates come out of a place blob',
  parseCoordsFromUrl('https://maps.google.com/x!3d1.2868!4d103.8545')?.lng === 103.8545,
)
ok('bare coordinates parse', parseCoordsFromUrl(' 1.3048, 103.8742 ')?.lat === 1.3048)
ok(
  'a shortened link has no coordinates in it',
  parseCoordsFromUrl('https://maps.app.goo.gl/abc123') === null,
)
ok('shortened links are recognised as needing a redirect', isShortenedMapsLink('https://maps.app.goo.gl/abc123'))

console.log('\n— estimates —')
const e = estimateTravel({ lat: 1.3236, lng: 103.9273 }, { lat: 1.402, lng: 103.788 })
ok('Mandai from the east coast is not a short hop', e.transitMin > 45, e)
ok('taxi beats transit over distance', e.taxiMin < e.transitMin)
const near = estimateTravel({ lat: 1.2803, lng: 103.8449 }, { lat: 1.2815, lng: 103.8443 })
ok('next door is a walk', near.suggested === 'walk', near)

console.log('\n— warnings —')
const warns = tripWarnings(all, setup, stay)
ok('the tight transition is surfaced', warns.some((w) => w.id.startsWith('tight-')))
ok('a missing Night Safari is surfaced', warns.some((w) => w.id === 'no-night-safari'))
ok(
  'no stay produces an informational note, not an error',
  tripWarnings(allItems(userItems, setup, anchors, null), setup, null).find((w) => w.id === 'no-stay')
    ?.level === 'info',
)

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
