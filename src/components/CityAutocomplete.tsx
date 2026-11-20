import { useEffect, useId, useRef, useState } from 'react'
import { searchWorldCities, type CitySuggestion } from '../services/citySearch'
import { suggestAddresses, type AddressSuggestion } from '../services/geocoding'
import { pickAddress, type PickedAddress } from './AddressAutocomplete'
import { looksLikeStreet } from '../utils/addressQuery'
import styles from './CityAutocomplete.module.css'

interface CityAutocompleteProps {
  value: CitySuggestion | null
  onChange: (city: CitySuggestion | null) => void
  placeholder?: string
  label?: string
  className?: string
  variant?: 'default' | 'form'
  compact?: boolean
  /** Texto escrito aunque no se elija una sugerencia (para buscar por lo escrito). */
  onTextChange?: (text: string) => void
  /** Si se pasa, también se puede escribir una calle: se sugieren direcciones y se avisa al elegir una. */
  onPickAddress?: (address: PickedAddress) => void
  /** Para que las calles sugeridas sean las de tu zona. */
  nearLat?: number
  nearLng?: number
}

function CityAutocomplete({
  value,
  onChange,
  placeholder = 'Ciudad…',
  label = 'Zona',
  className,
  variant = 'default',
  compact = false,
  onTextChange,
  onPickAddress,
  nearLat,
  nearLng,
}: CityAutocompleteProps) {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState(value?.label ?? '')
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [addresses, setAddresses] = useState<AddressSuggestion[]>([])
  const wantsAddresses = Boolean(onPickAddress)

  useEffect(() => {
    setInputValue(value?.label ?? '')
  }, [value])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
        setActiveIndex(-1)

        if (!value) {
          setInputValue('')
        } else {
          setInputValue(value.label)
        }
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen, value])

  useEffect(() => {
    const trimmed = inputValue.trim()

    if (value && trimmed === value.label) {
      setAddresses([])
      setSuggestions([])
      setLoading(false)
      setError(null)
      return
    }

    if (trimmed.length < 2) {
      setAddresses([])
      setSuggestions([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const timeoutId = window.setTimeout(() => {
      // Calles y direcciones (solo con al menos 3 letras), además de ciudades.
      if (wantsAddresses && trimmed.length >= 3) {
        const bias = typeof nearLat === 'number' && typeof nearLng === 'number' ? { lat: nearLat, lng: nearLng } : null
        void suggestAddresses(trimmed, bias)
          .then((items) => {
            if (cancelled) return
            const streets = items.filter((item) => Boolean(item.street))
            setAddresses(streets)
            if (streets.length > 0) setIsOpen(true)
          })
          .catch(() => undefined)
      } else {
        setAddresses([])
      }
      void searchWorldCities(trimmed)
        .then((results) => {
          if (!cancelled) {
            // Si parece una calle, pocas ciudades para que se vean las calles.
            setSuggestions(wantsAddresses && looksLikeStreet(trimmed) ? results.slice(0, 3) : results)
            setIsOpen((open) => results.length > 0 || (wantsAddresses && open))
            setActiveIndex(results.length > 0 ? 0 : -1)
          }
        })
        .catch((searchError) => {
          if (!cancelled) {
            setSuggestions([])
            setError(
              searchError instanceof Error
                ? searchError.message
                : 'No se pudieron cargar ciudades.',
            )
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false)
          }
        })
    }, 280)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [inputValue, value, wantsAddresses, nearLat, nearLng])

  const selectAddress = (suggestion: AddressSuggestion) => {
    const picked = pickAddress(suggestion, inputValue)
    onPickAddress?.(picked)
    setInputValue([picked.line, picked.city].filter(Boolean).join(', '))
    setSuggestions([])
    setAddresses([])
    setIsOpen(false)
    setActiveIndex(-1)
    setError(null)
  }

  const selectSuggestion = (suggestion: CitySuggestion) => {
    onChange(suggestion)
    setInputValue(suggestion.label)
    setSuggestions([])
    setIsOpen(false)
    setActiveIndex(-1)
    setError(null)
  }

  const clearSelection = () => {
    onChange(null)
    onTextChange?.('')
    setInputValue('')
    setSuggestions([])
    setIsOpen(false)
    setActiveIndex(-1)
    setError(null)
  }

  const handleInputChange = (nextValue: string) => {
    setInputValue(nextValue)
    onTextChange?.(nextValue)

    if (value && nextValue !== value.label) {
      onChange(null)
    }
  }

  // Si parece una calle, las calles van primero.
  const streetFirst = wantsAddresses && looksLikeStreet(inputValue)
  const cityOffset = streetFirst ? addresses.length : 0
  const addressOffset = streetFirst ? 0 : suggestions.length

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const total = suggestions.length + addresses.length
    if (!isOpen || total === 0) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % total)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => (current <= 0 ? total - 1 : current - 1))
      return
    }

    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      if (activeIndex >= addressOffset && activeIndex < addressOffset + addresses.length) {
        selectAddress(addresses[activeIndex - addressOffset])
      } else {
        selectSuggestion(suggestions[activeIndex - cityOffset])
      }
      return
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
      setActiveIndex(-1)
    }
  }

  const addressOptions = addresses.map((address, offset) => {
    const index = addressOffset + offset
    return (
      <li key={address.id} role="presentation">
        <button
          type="button"
          role="option"
          aria-selected={activeIndex === index}
          className={`${styles.option} ${activeIndex === index ? styles.optionActive : ''}`}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => selectAddress(address)}
        >
          <span className={styles.optionName}>📍 {address.title}</span>
          <span className={styles.optionMeta}>{address.subtitle}</span>
        </button>
      </li>
    )
  })

  return (
    <div
      className={`${styles.root} ${variant === 'form' ? styles.rootForm : ''} ${
        compact ? styles.rootCompact : ''
      } ${className ?? ''}`}
      ref={rootRef}
    >
      <label className={styles.field}>
        <span className={compact ? styles.srOnly : styles.label}>{label}</span>
        <div className={styles.inputWrap}>
          <input
            type="search"
            value={inputValue}
            onChange={(event) => handleInputChange(event.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) {
                setIsOpen(true)
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`${styles.input} ${variant === 'form' ? styles.inputForm : ''} ${
              compact ? styles.inputCompact : ''
            }`}
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            autoComplete="off"
          />

          {(value || inputValue) && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={clearSelection}
              aria-label="Quitar ciudad"
            >
              ×
            </button>
          )}
        </div>
      </label>

      {loading && (
        <p className={styles.hint} aria-live="polite">
          Buscando ciudades…
        </p>
      )}

      {!loading && !value && inputValue.trim().length >= 2 && suggestions.length === 0 && !error && (
        <p className={styles.hint}>Elige una ciudad de la lista.</p>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {isOpen && suggestions.length + addresses.length > 0 && (
        <ul id={listboxId} className={styles.listbox} role="listbox">
          {streetFirst ? addressOptions : null}
          {suggestions.map((suggestion, rawIndex) => {
            const index = rawIndex + cityOffset
            return (
              <li key={suggestion.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  className={`${styles.option} ${activeIndex === index ? styles.optionActive : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectSuggestion(suggestion)}
                >
                  <span className={styles.optionName}>{suggestion.name}</span>
                  <span className={styles.optionMeta}>
                    {[suggestion.region, suggestion.country].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            )
          })}
          {!streetFirst ? addressOptions : null}
        </ul>
      )}
    </div>
  )
}

export default CityAutocomplete
