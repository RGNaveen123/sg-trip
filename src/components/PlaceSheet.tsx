import { CalendarPlus, MapPin, MessageCircleQuestion, Play, Trash2 } from 'lucide-react'
import { Btn, Chip, Sheet, Spinner } from './ui'
import { usePlaceInfo } from '../lib/hooks'
import { mapsPlaceUrl, youtubeSearchUrl, formatDuration } from '../lib/geo'
import { CATEGORY_LABEL } from '../data/places'
import { useTrip } from '../lib/store'
import type { Place } from '../lib/types'

export function PlaceSheet({
  place,
  onClose,
  onSchedule,
  onAsk,
}: {
  place: Place | null
  onClose: () => void
  onSchedule: (p: Place) => void
  onAsk: (prompt: string) => void
}) {
  const { info, loading } = usePlaceInfo(place)
  const removeCustomPlace = useTrip((s) => s.removeCustomPlace)

  return (
    <Sheet
      open={Boolean(place)}
      onClose={onClose}
      title={place?.name}
      subtitle={
        place ? `${place.area} · ${CATEGORY_LABEL[place.category]}` : undefined
      }
      full
    >
      {place && (
        <div className="space-y-4">
          <div className="relative h-44 overflow-hidden rounded-2xl border border-line bg-ink-2">
            {info?.photo ? (
              <img src={info.photo} alt={place.name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-mute-2">
                {loading ? <Spinner /> : <MapPin size={22} />}
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink to-transparent" />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Chip tone="gold">{formatDuration(place.typicalMin)} typical</Chip>
            {place.minRecommendedMin && (
              <Chip tone="alert">needs {formatDuration(place.minRecommendedMin)}+</Chip>
            )}
            {place.tags?.map((t) => (
              <Chip key={t}>{t.replace(/-/g, ' ')}</Chip>
            ))}
            {place.custom && <Chip tone="walk">yours · {place.source}</Chip>}
          </div>

          <p className="text-[13.5px] leading-relaxed text-cream/90">{place.blurb}</p>

          <div>
            <div className="lbl mb-1.5">What&apos;s here</div>
            {loading && !info ? (
              <div className="flex items-center gap-2 text-[12px] text-mute">
                <Spinner /> Reading Wikipedia…
              </div>
            ) : info?.extract ? (
              <p className="text-[13px] leading-relaxed text-mute">{info.extract}</p>
            ) : (
              <p className="text-[12px] text-mute-2">
                No free summary available for this one.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <a href={mapsPlaceUrl(place.coords, place.name)} target="_blank" rel="noreferrer">
              <Btn full>
                <MapPin size={14} /> On the map
              </Btn>
            </a>
            <a href={youtubeSearchUrl(place.name)} target="_blank" rel="noreferrer">
              <Btn full>
                <Play size={14} /> Videos
              </Btn>
            </a>
          </div>

          <Btn
            full
            onClick={() =>
              onAsk(
                `Tell me what's actually worth doing at ${place.name} in Singapore, how long to budget, and roughly what it costs. Keep it short.`,
              )
            }
          >
            <MessageCircleQuestion size={14} /> Ask about this place
          </Btn>

          <Btn variant="gold" full onClick={() => onSchedule(place)}>
            <CalendarPlus size={15} /> Put it on the plan
          </Btn>

          {place.custom && (
            <Btn
              variant="danger"
              full
              onClick={() => {
                removeCustomPlace(place.id)
                onClose()
              }}
            >
              <Trash2 size={14} /> Delete this spot
            </Btn>
          )}
        </div>
      )}
    </Sheet>
  )
}
