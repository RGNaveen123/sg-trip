import { useState } from 'react'
import { Field, inputCls, Sheet, Btn } from './ui'
import { LocationFinder, type Resolved } from './LocationFinder'
import { areaFor } from '../data/places'
import { useTrip } from '../lib/store'
import type { Place, PlaceCategory } from '../lib/types'

const CATEGORIES: { value: PlaceCategory; label: string }[] = [
  { value: 'sights', label: 'Sight' },
  { value: 'nature', label: 'Nature' },
  { value: 'hawker', label: 'Hawker' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'shopping', label: 'Shopping' },
  { value: 'nightlife', label: 'After dark' },
]

export function AddPlaceSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  onAdded: (p: Place, msg: string) => void
}) {
  const addCustomPlace = useTrip((s) => s.addCustomPlace)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<PlaceCategory>('sights')
  const [found, setFound] = useState<Resolved | null>(null)

  const closeAll = () => {
    setName('')
    setFound(null)
    onClose()
  }

  const save = () => {
    if (!found) return
    const area = areaFor(found.coords)
    const place: Place = {
      id: `custom-${Math.random().toString(36).slice(2, 9)}`,
      name: name.trim() || found.label,
      area,
      category,
      coords: found.coords,
      blurb: 'Added by you.',
      typicalMin: 90,
      custom: true,
      source: found.source,
    }
    addCustomPlace(place)
    onAdded(place, `${place.name} saved under ${area}.`)
    closeAll()
  }

  return (
    <Sheet
      open={open}
      onClose={closeAll}
      title="Add your own spot"
      subtitle="Search it, drop a pin, or paste a link"
      full
    >
      <div className="space-y-4">
        <LocationFinder value={found} onChange={setFound} />

        {found && (
          <>
            <Field
              label="Call it"
              hint={`Leave blank to use "${found.label}".`}
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={found.label}
                className={inputCls}
              />
            </Field>

            <Field label="What kind of place">
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={`rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors ${
                      category === c.value
                        ? 'border-gold bg-gold/12 text-gold'
                        : 'border-line text-mute'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </Field>

            <Btn variant="gold" full onClick={save}>
              Save this spot
            </Btn>
          </>
        )}
      </div>
    </Sheet>
  )
}
