import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { MapPin } from 'lucide-react'
import { suggestAddresses, type AddressSuggestion } from '../services/geocoding'
import type { GeoCoordinates } from '../utils/geo'
import styles from './AddressAutocomplete.module.css'

/** Lo que se rellena solo al elegir una dirección de la lista. */
export interface PickedAddress {
  /** «Calle Tricio, 1» (con el número que escribiste si el mapa no lo trae). */
  line: string
  postalCode: string
  city: string
  region: string
  country: string
  lat: number
  lng: number
}

const SUGGEST_DELAY_MS = 280

function typedNumber(text: string): string {
  const match = /(?:^|[\s,])(\d{1,4}[a-zA-Z]?)\b/.exec(text)
  return match ? match[1] : ''
}

export function pickAddress(suggestion: AddressSuggestion, typed: string): PickedAddress {
  const street = suggestion.street || ''
  const number = suggestion.houseNumber || (street ? typedNumber(typed) : '')
  const line = street ? (number ? `${street}, ${number}` : street) : suggestion.title
  return {
    line,
    postalCode: suggestion.postalCode ?? '',
    city: suggestion.city ?? '',
    region: suggestion.region ?? '',
    country: suggestion.country ?? '',
    lat: suggestion.lat,
    lng: suggestion.lng,
  }
}

interface AddressAutocompleteProps {
  id?: string
  value: string
  onChange: (value: string) => void
  onPick: (address: PickedAddress) => void
  near?: GeoCoordinates | null
  placeholder?: string
  /** Clase del input, para que se vea igual que el resto del formulario. */
  inputClassName?: string
  maxLength?: number
}

/** Escribe la calle: al elegirla se rellenan ciudad, código postal, país y el punto del mapa. */
function AddressAutocomplete({
  id,
  value,
  onChange,
  onPick,
  near = null,
  placeholder = 'Calle Mayor, 12',
  inputClassName,
  maxLength = 200,
}: AddressAutocompleteProps) {
  const listboxId = useId()
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const skipNextRef = useRef(false)
  const typedRef = useRef(false)
  const nearLat = near?.lat
  const nearLng = near?.lng

  useEffect(() => {
    if (skipNextRef.current || !typedRef.current) {
      skipNextRef.current = false
      return undefined
    }
    const query = value.trim()
    if (query.length < 3) {
      setSuggestions([])
      setOpen(false)
      return undefined
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      const bias = typeof nearLat === 'number' && typeof nearLng === 'number' ? { lat: nearLat, lng: nearLng } : null
      void suggestAddresses(query, bias, controller.signal)
        .then((items) => {
          setSuggestions(items)
          setActiveIndex(-1)
          setOpen(items.length > 0)
        })
        .catch(() => undefined)
    }, SUGGEST_DELAY_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [value, nearLat, nearLng])

  const choose = (suggestion: AddressSuggestion) => {
    const picked = pickAddress(suggestion, value)
    skipNextRef.current = true
    onChange(picked.line)
    onPick(picked)
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1))
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      choose(suggestions[activeIndex])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className={styles.root}>
      <input
        id={id}
        className={inputClassName}
        value={value}
        onChange={(event) => {
          typedRef.current = true
          onChange(event.target.value)
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(suggestions.length > 0)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
      />
      {open && suggestions.length > 0 ? (
        <ul id={listboxId} className={styles.listbox} role="listbox">
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={activeIndex === index}
              className={`${styles.option} ${activeIndex === index ? styles.optionActive : ''}`}
              onMouseDown={(event) => {
                event.preventDefault()
                choose(suggestion)
              }}
            >
              <MapPin size={15} aria-hidden="true" className={styles.icon} />
              <span className={styles.text}>
                <span className={styles.title}>{suggestion.title}</span>
                {suggestion.subtitle ? <span className={styles.meta}>{suggestion.subtitle}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default AddressAutocomplete
