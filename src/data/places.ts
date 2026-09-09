import type { Place, PlaceCategory, LatLng } from '../lib/types'

/** Human-named areas, with a centroid used to label any dropped pin. */
export const AREAS: { name: string; centre: LatLng }[] = [
  { name: 'Marina Bay', centre: { lat: 1.2845, lng: 103.86 } },
  { name: 'Sentosa Island', centre: { lat: 1.254, lng: 103.82 } },
  { name: 'HarbourFront', centre: { lat: 1.265, lng: 103.822 } },
  { name: 'Chinatown & CBD', centre: { lat: 1.2815, lng: 103.845 } },
  { name: 'Civic District', centre: { lat: 1.293, lng: 103.849 } },
  { name: 'Clarke Quay', centre: { lat: 1.29, lng: 103.846 } },
  { name: 'Bugis & Kampong Glam', centre: { lat: 1.301, lng: 103.858 } },
  { name: 'Little India', centre: { lat: 1.307, lng: 103.851 } },
  { name: 'Orchard', centre: { lat: 1.304, lng: 103.833 } },
  { name: 'Botanic Gardens', centre: { lat: 1.3138, lng: 103.8159 } },
  { name: 'Kallang', centre: { lat: 1.3045, lng: 103.8745 } },
  { name: 'Katong & Joo Chiat', centre: { lat: 1.308, lng: 103.902 } },
  { name: 'East Coast', centre: { lat: 1.301, lng: 103.915 } },
  { name: 'Mandai & the North', centre: { lat: 1.402, lng: 103.79 } },
  { name: 'Jurong & the West', centre: { lat: 1.335, lng: 103.732 } },
  { name: 'Changi', centre: { lat: 1.36, lng: 103.989 } },
  { name: 'Woodlands & Far North', centre: { lat: 1.436, lng: 103.786 } },
  { name: 'Punggol & the Northeast', centre: { lat: 1.399, lng: 103.907 } },
]

export const CATEGORY_LABEL: Record<PlaceCategory, string> = {
  sights: 'Sights & landmarks',
  nature: 'Nature & parks',
  hawker: 'Hawker centres',
  restaurant: 'Sit-down restaurants',
  shopping: 'Shopping',
  nightlife: 'After dark',
  transit: 'Transit',
}

/** Terse labels, for the one-line summary under an area heading. */
export const CATEGORY_SHORT: Record<PlaceCategory, string> = {
  sights: 'sights',
  nature: 'nature',
  hawker: 'hawker',
  restaurant: 'dining',
  shopping: 'shopping',
  nightlife: 'nightlife',
  transit: 'transit',
}

export const CATEGORY_ORDER: PlaceCategory[] = [
  'sights',
  'nature',
  'hawker',
  'restaurant',
  'shopping',
  'nightlife',
  'transit',
]

const p = (
  id: string,
  name: string,
  area: string,
  category: PlaceCategory,
  lat: number,
  lng: number,
  typicalMin: number,
  blurb: string,
  wiki?: string,
  extra?: Partial<Place>,
): Place => ({ id, name, area, category, coords: { lat, lng }, typicalMin, blurb, wiki, ...extra })

export const PLACES: Place[] = [
  // ---------------- Marina Bay ----------------
  p('mbs-skypark', 'Marina Bay Sands SkyPark', 'Marina Bay', 'sights', 1.2834, 103.8607, 75,
    'Observation deck 57 floors up, straight down the length of the bay. Ticketed.',
    'Marina Bay Sands', { tags: ['ticketed', 'sunset', 'iconic'] }),
  p('merlion', 'Merlion Park', 'Marina Bay', 'sights', 1.2868, 103.8545, 30,
    'The obligatory photo. Free, open around the clock, busiest at dusk.',
    'Merlion', { tags: ['free', 'photo'] }),
  p('artscience', 'ArtScience Museum', 'Marina Bay', 'sights', 1.2863, 103.8593, 120,
    'Lotus-shaped museum; Future World is the digital-art one everyone posts.',
    'ArtScience Museum', { tags: ['ticketed', 'indoor', 'rain-proof'] }),
  p('sg-flyer', 'Singapore Flyer', 'Marina Bay', 'sights', 1.2893, 103.8631, 60,
    'Giant observation wheel, one 30-minute rotation over the bay.',
    'Singapore Flyer', { tags: ['ticketed'] }),
  p('helix', 'Helix Bridge', 'Marina Bay', 'sights', 1.2896, 103.8615, 25,
    'Double-helix pedestrian bridge, lit at night. Free walk-through.',
    'Helix Bridge', { tags: ['free', 'evening'] }),
  p('spectra', 'Spectra light and water show', 'Marina Bay', 'nightlife', 1.2851, 103.859, 20,
    'Free 15-minute light-and-water show on the MBS event plaza, nightly.',
    undefined, { tags: ['free', 'evening', 'fixed-time'] }),
  p('gardens-bay', 'Gardens by the Bay — Supertree Grove', 'Marina Bay', 'nature', 1.2816, 103.8636, 120,
    'Outdoor gardens are free; the Garden Rhapsody light show runs nightly at 19:45 and 20:45.',
    'Gardens by the Bay', { tags: ['free', 'evening', 'outdoor'], minRecommendedMin: 90 }),
  p('cloud-forest', 'Cloud Forest & Flower Dome', 'Marina Bay', 'nature', 1.2839, 103.8642, 120,
    'Two cooled conservatories with the indoor waterfall. Ticketed, blissfully air-conditioned.',
    'Gardens by the Bay', { tags: ['ticketed', 'indoor', 'rain-proof'] }),
  p('satay-bay', 'Satay by the Bay', 'Marina Bay', 'hawker', 1.281, 103.8697, 60,
    'Hawker centre inside Gardens by the Bay. Late-night satay, cheap, outdoors.',
    undefined, { tags: ['cheap', 'evening'] }),
  p('lau-pa-sat', 'Lau Pa Sat', 'Chinatown & CBD', 'hawker', 1.2807, 103.8504, 60,
    'Victorian cast-iron market hall. Boon Tat Street closes for the satay grills after 19:00.',
    'Lau Pa Sat', { tags: ['cheap', 'evening', 'iconic'] }),
  p('shoppes-mbs', 'The Shoppes at Marina Bay Sands', 'Marina Bay', 'shopping', 1.2836, 103.8591, 90,
    'Luxury mall with the indoor canal and sampan rides. Good rain shelter.',
    undefined, { tags: ['indoor', 'rain-proof'] }),
  p('celavi', 'CE LA VI SkyBar', 'Marina Bay', 'restaurant', 1.2847, 103.861, 90,
    'Rooftop bar and restaurant on top of MBS. A splurge, but the view is the point.',
    undefined, { tags: ['pricey', 'evening', 'booking'] }),

  // ---------------- Sentosa ----------------
  p('uss', 'Universal Studios Singapore', 'Sentosa Island', 'sights', 1.254, 103.8238, 540,
    'Full-day theme park. Buy dated tickets ahead and be there for rope-drop at opening.',
    'Universal Studios Singapore', { tags: ['ticketed', 'full-day', 'water-rides'], minRecommendedMin: 420 }),
  p('sea-aquarium', 'S.E.A. Aquarium', 'Sentosa Island', 'sights', 1.2585, 103.8207, 120,
    'One of the biggest aquariums going. Indoor, cool, works in any weather.',
    'S.E.A. Aquarium', { tags: ['ticketed', 'indoor', 'rain-proof'] }),
  p('luge', 'Skyline Luge Sentosa', 'Sentosa Island', 'sights', 1.2545, 103.818, 90,
    'Gravity go-karts down the hill, chairlift back up. The multi-ride combo is the good value.',
    'Skyline Luge', { tags: ['ticketed', 'active'] }),
  p('sensoryscape', 'Sentosa Sensoryscape', 'Sentosa Island', 'sights', 1.2548, 103.82, 45,
    'Free walkway linking the beaches to Resorts World, lights up after dark.',
    undefined, { tags: ['free', 'evening'] }),
  p('wings-of-time', 'Wings of Time', 'Sentosa Island', 'nightlife', 1.2494, 103.8214, 40,
    'Beachfront water-screen and laser show, two sittings most evenings.',
    'Wings of Time', { tags: ['ticketed', 'evening', 'fixed-time'] }),
  p('palawan', 'Palawan Beach', 'Sentosa Island', 'nature', 1.249, 103.8226, 90,
    'Southernmost point of continental Asia, over the suspension bridge. Free.',
    undefined, { tags: ['free', 'outdoor', 'swim'] }),
  p('siloso', 'Siloso Beach', 'Sentosa Island', 'nature', 1.2564, 103.8106, 90,
    'The lively beach — bars, volleyball, sunset. Free.',
    'Siloso Beach', { tags: ['free', 'outdoor', 'swim', 'sunset'] }),
  p('msf', 'Malaysian Food Street', 'Sentosa Island', 'hawker', 1.2543, 103.8218, 45,
    'Hawker-style food court at Resorts World. Handy if you are on Sentosa all day.',
    undefined, { tags: ['cheap', 'indoor'] }),
  p('vivocity', 'VivoCity', 'HarbourFront', 'shopping', 1.264, 103.8222, 90,
    'The mall you pass through to reach Sentosa. Food court on level 3, rooftop deck.',
    'VivoCity', { tags: ['indoor', 'rain-proof'] }),

  // ---------------- Chinatown & CBD ----------------
  p('buddha-tooth', 'Buddha Tooth Relic Temple', 'Chinatown & CBD', 'sights', 1.2815, 103.8443, 45,
    'Tang-style temple over four floors, free entry. Cover shoulders and knees.',
    'Buddha Tooth Relic Temple and Museum', { tags: ['free', 'dress-code'] }),
  p('sri-mariamman', 'Sri Mariamman Temple', 'Chinatown & CBD', 'sights', 1.2829, 103.8452, 30,
    'The oldest Hindu temple in Singapore, in the middle of Chinatown. Free.',
    'Sri Mariamman Temple, Singapore', { tags: ['free', 'shoes-off'] }),
  p('thian-hock-keng', 'Thian Hock Keng Temple', 'Chinatown & CBD', 'sights', 1.2809, 103.8477, 30,
    'Beautiful 1840s Hokkien temple, built without a single nail. Free.',
    'Thian Hock Keng', { tags: ['free'] }),
  p('maxwell', 'Maxwell Food Centre', 'Chinatown & CBD', 'hawker', 1.2803, 103.8449, 50,
    'Tian Tian Hainanese chicken rice lives here. Go slightly off peak.',
    'Maxwell Food Centre', { tags: ['cheap', 'iconic'] }),
  p('chinatown-complex', 'Chinatown Complex Food Centre', 'Chinatown & CBD', 'hawker', 1.2823, 103.8434, 50,
    'The biggest hawker centre in the country, 260-odd stalls. The cheapest good meal you will get.',
    'Chinatown Complex', { tags: ['cheap', 'huge'] }),
  p('amoy-street', 'Amoy Street Food Centre', 'Chinatown & CBD', 'hawker', 1.2794, 103.8467, 45,
    'Office-crowd hawker centre. Excellent at lunch, mostly shut by evening.',
    undefined, { tags: ['cheap', 'lunch-only'] }),
  p('chinatown-market', 'Chinatown Street Market', 'Chinatown & CBD', 'shopping', 1.2827, 103.8446, 60,
    'Pagoda Street souvenir stalls. Haggle, and it stays open into the evening.',
    undefined, { tags: ['cheap', 'evening'] }),

  // ---------------- Civic District & Clarke Quay ----------------
  p('national-gallery', 'National Gallery Singapore', 'Civic District', 'sights', 1.2903, 103.8515, 120,
    'The old Supreme Court and City Hall, now Southeast Asian art. Indoor, with a rooftop bar.',
    'National Gallery Singapore', { tags: ['ticketed', 'indoor', 'rain-proof'] }),
  p('national-museum', 'National Museum of Singapore', 'Civic District', 'sights', 1.2966, 103.8485, 100,
    'The country from fishing village to now, told well. Indoor.',
    'National Museum of Singapore', { tags: ['ticketed', 'indoor', 'rain-proof'] }),
  p('fort-canning', 'Fort Canning Park', 'Civic District', 'nature', 1.2942, 103.8455, 60,
    'Hilltop park with the famous spiral tree tunnel. Free — go early, before the heat.',
    'Fort Canning Hill', { tags: ['free', 'outdoor', 'photo', 'morning'] }),
  p('clarke-quay', 'Clarke Quay', 'Clarke Quay', 'nightlife', 1.2907, 103.8465, 90,
    'Riverside bars and restaurants; the river cruise jetty is here too.',
    'Clarke Quay', { tags: ['evening'] }),
  p('river-cruise', 'Singapore River Cruise', 'Clarke Quay', 'sights', 1.2888, 103.846, 45,
    'Forty minutes on a bumboat from Clarke Quay to Marina Bay. Best just after sunset.',
    undefined, { tags: ['ticketed', 'evening'] }),
  p('jumbo-riverside', 'Jumbo Seafood, Riverside Point', 'Clarke Quay', 'restaurant', 1.2887, 103.8437, 100,
    'Chilli crab, by the river. Book ahead — walk-ins wait.',
    undefined, { tags: ['pricey', 'booking', 'iconic'] }),

  // ---------------- Bugis, Kampong Glam, Little India ----------------
  p('sultan-mosque', 'Sultan Mosque', 'Bugis & Kampong Glam', 'sights', 1.3021, 103.859, 40,
    'Golden-domed mosque at the head of Kampong Glam. Free; robes are lent at the door.',
    'Sultan Mosque', { tags: ['free', 'dress-code'] }),
  p('haji-lane', 'Haji Lane', 'Bugis & Kampong Glam', 'shopping', 1.3009, 103.8592, 60,
    'Narrow lane of murals, indie shops and bars. Free to wander, good after dark.',
    'Haji Lane', { tags: ['free', 'photo', 'evening'] }),
  p('zam-zam', 'Zam Zam Restaurant', 'Bugis & Kampong Glam', 'restaurant', 1.3021, 103.8595, 50,
    'Murtabak since 1908, opposite the mosque. Cheap for a sit-down meal.',
    undefined, { tags: ['cheap', 'halal'] }),
  p('bugis-street', 'Bugis Street', 'Bugis & Kampong Glam', 'shopping', 1.3006, 103.8554, 75,
    'Three floors of very cheap everything. Open till about 22:00.',
    'Bugis Street', { tags: ['cheap', 'evening', 'indoor'] }),
  p('sri-veeramakaliamman', 'Sri Veeramakaliamman Temple', 'Little India', 'sights', 1.3065, 103.8524, 35,
    'Vivid Kali temple on Serangoon Road. Free, shoes off.',
    'Sri Veeramakaliamman Temple', { tags: ['free', 'shoes-off'] }),
  p('tekka', 'Tekka Centre', 'Little India', 'hawker', 1.3061, 103.8503, 45,
    'Little India hawker centre — biryani, roti prata, wet market upstairs.',
    'Tekka Centre', { tags: ['cheap'] }),
  p('mustafa', 'Mustafa Centre', 'Little India', 'shopping', 1.3105, 103.856, 90,
    'Open 24 hours. Electronics, gold, groceries, chaos. Best souvenir prices in the city.',
    'Mustafa Centre', { tags: ['cheap', '24h', 'indoor'] }),

  // ---------------- Orchard & Botanics ----------------
  p('ion-orchard', 'ION Orchard', 'Orchard', 'shopping', 1.304, 103.8318, 90,
    'The flagship Orchard Road mall, straight out of the MRT station.',
    'ION Orchard', { tags: ['indoor', 'rain-proof'] }),
  p('lucky-plaza', 'Lucky Plaza', 'Orchard', 'shopping', 1.306, 103.8322, 45,
    'Cheap electronics, remittance shops and Filipino food. Bargain hard.',
    'Lucky Plaza', { tags: ['cheap', 'indoor'] }),
  p('313-somerset', '313@Somerset', 'Orchard', 'shopping', 1.3013, 103.8386, 60,
    'Mid-range high-street brands, with a food hall in the basement.',
    undefined, { tags: ['indoor'] }),
  p('newton', 'Newton Food Centre', 'Orchard', 'hawker', 1.3123, 103.8383, 50,
    'The one from Crazy Rich Asians. Touristy, still good — always check prices before ordering.',
    'Newton Food Centre', { tags: ['evening', 'iconic'] }),
  p('botanic-gardens', 'Singapore Botanic Gardens', 'Botanic Gardens', 'nature', 1.3138, 103.8159, 120,
    'UNESCO site, free to enter. The National Orchid Garden inside is ticketed.',
    'Singapore Botanic Gardens', { tags: ['free', 'outdoor', 'morning'], minRecommendedMin: 90 }),

  // ---------------- Mandai & the North ----------------
  p('night-safari', 'Night Safari', 'Mandai & the North', 'nature', 1.402, 103.788, 210,
    'The first nocturnal zoo in the world. Opens 19:15; tram ride plus walking trails. Book a timed slot.',
    'Night Safari, Singapore', { tags: ['ticketed', 'evening', 'far'], minRecommendedMin: 180 }),
  p('singapore-zoo', 'Singapore Zoo', 'Mandai & the North', 'nature', 1.4043, 103.793, 300,
    'Open-concept zoo, genuinely excellent. Half a day minimum.',
    'Singapore Zoo', { tags: ['ticketed', 'far', 'outdoor'], minRecommendedMin: 240 }),
  p('river-wonders', 'River Wonders', 'Mandai & the North', 'nature', 1.4038, 103.79, 180,
    'River-themed park next door to the zoo — manatees, giant pandas.',
    'River Wonders', { tags: ['ticketed', 'far'], minRecommendedMin: 150 }),
  p('bird-paradise', 'Bird Paradise', 'Mandai & the North', 'nature', 1.396, 103.79, 180,
    'Walk-through aviaries at Mandai. Newest of the four parks.',
    'Bird Paradise', { tags: ['ticketed', 'far'], minRecommendedMin: 150 }),
  p('treetop-walk', 'MacRitchie TreeTop Walk', 'Mandai & the North', 'nature', 1.345, 103.825, 240,
    'Suspension bridge through rainforest canopy. It is a real 10 km hike — start early.',
    'MacRitchie Reservoir', { tags: ['free', 'outdoor', 'active', 'morning'], minRecommendedMin: 210 }),

  // ---------------- Kallang ----------------
  p('national-stadium', 'National Stadium', 'Kallang', 'sights', 1.3048, 103.8742, 60,
    'The concert venue. Stadium MRT on the Circle Line drops you at the door.',
    'National Stadium, Singapore', { tags: ['venue'] }),
  p('kallang-wave', 'Kallang Wave Mall', 'Kallang', 'shopping', 1.3037, 103.8744, 45,
    'Mall attached to the stadium — where to eat before doors, and it will be busy.',
    undefined, { tags: ['indoor'] }),

  // ---------------- East ----------------
  p('katong', 'Katong & Joo Chiat shophouses', 'Katong & Joo Chiat', 'sights', 1.3086, 103.902, 90,
    'Pastel Peranakan shophouses on Koon Seng Road. Free, and the laksa is nearby.',
    'Joo Chiat', { tags: ['free', 'photo'] }),
  p('old-airport-rd', 'Old Airport Road Food Centre', 'Katong & Joo Chiat', 'hawker', 1.3084, 103.8857, 50,
    'The hawker centre locals name first. Less polished, better food than the famous ones.',
    'Old Airport Road Food Centre', { tags: ['cheap', 'iconic'] }),
  p('east-coast-park', 'East Coast Park', 'East Coast', 'nature', 1.3006, 103.9123, 120,
    'Fifteen km of beach park. Rent bikes, watch the container ships. Free.',
    'East Coast Park', { tags: ['free', 'outdoor', 'evening'] }),
  p('ec-lagoon', 'East Coast Lagoon Food Village', 'East Coast', 'hawker', 1.307, 103.931, 60,
    'Barbecue stingray and satay, on the sand, with a sea breeze. Evenings, really.',
    undefined, { tags: ['cheap', 'evening', 'outdoor'] }),

  // ---------------- West ----------------
  p('science-centre', 'Science Centre Singapore', 'Jurong & the West', 'sights', 1.333, 103.735, 150,
    'Hands-on science museum. A good rain plan.',
    'Science Centre Singapore', { tags: ['ticketed', 'indoor', 'rain-proof'] }),
  p('jurong-lake-gardens', 'Jurong Lake Gardens', 'Jurong & the West', 'nature', 1.339, 103.728, 90,
    'Free lakeside park with the Chinese Garden pagodas. Quiet, far from the crowds.',
    'Jurong Lake Gardens', { tags: ['free', 'outdoor'] }),

  // ---------------- Changi ----------------
  p('jewel', 'Jewel Changi Airport', 'Changi', 'sights', 1.3601, 103.9896, 120,
    'The indoor waterfall, inside the airport. Perfect for the last hours before a flight.',
    'Jewel Changi Airport', { tags: ['free', 'indoor', 'pre-flight'] }),

  // ---------------- Transit anchors ----------------
  p('changi-t3', 'Changi Airport Terminal 3', 'Changi', 'transit', 1.3556, 103.9865, 0,
    'Singapore Airlines arrivals and departures terminal.',
    'Singapore Changi Airport', { tags: ['airport'] }),
]

export const PLACE_BY_ID = new Map(PLACES.map((x) => [x.id, x]))

export function areaFor(c: LatLng): string {
  let best = AREAS[0]
  let bestD = Infinity
  for (const a of AREAS) {
    const d = (a.centre.lat - c.lat) ** 2 + (a.centre.lng - c.lng) ** 2
    if (d < bestD) {
      bestD = d
      best = a
    }
  }
  // More than ~12 km from every known centroid: do not pretend to know.
  return Math.sqrt(bestD) > 0.11 ? 'Singapore' : best.name
}

/** Shown on the Places screen instead of littering the map with pins. */
export const CONVENIENCE_NOTE =
  '7-Eleven and Cheers are on practically every block and inside every MRT station — drinks, SIM top-ups, plasters, umbrellas. Not worth pinning; you will walk past one.'
