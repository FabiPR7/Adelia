import { useEffect, useId, useRef, useState } from 'react'
import { searchWorldCities, type CitySuggestion } from '../services/citySearch'
import styles from './CityAutocomplete.module.css'

interface CityAutocompleteProps {
  value: CitySuggestion | null
  onChange: (city: CitySuggestion | null) => void
  placeholder?: string
  label?: string
  className?: string
  variant?: 'default' | 'form'
  compact?: boolean
}

function CityAutocomplete({
  value,
  onChange,
  placeholder = 'Ciudad…',
  label = 'Zona',
  className,
  variant = 'default',
  compact = false,
}: CityAutocompleteProps) {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState(value?.label ?? '')
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)

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
      setSuggestions([])
      setLoading(false)
      setError(null)
      return
    }

    if (trimmed.length < 2) {
      setSuggestions([])
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const timeoutId = window.setTimeout(() => {
      void searchWorldCities(trimmed)
        .then((results) => {
          if (!cancelled) {
            setSuggestions(results)
            setIsOpen(results.length > 0)
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
  }, [inputValue, value])

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
    setInputValue('')
    setSuggestions([])
    setIsOpen(false)
    setActiveIndex(-1)
    setError(null)
  }

  const handleInputChange = (nextValue: string) => {
    setInputValue(nextValue)

    if (value && nextValue !== value.label) {
      onChange(null)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % suggestions.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1))
      return
    }

    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      selectSuggestion(suggestions[activeIndex])
      return
    }

    if (event.key === 'Escape') {
      setIsOpen(false)
      setActiveIndex(-1)
    }
  }

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

      {isOpen && suggestions.length > 0 && (
        <ul id={listboxId} className={styles.listbox} role="listbox">
          {suggestions.map((suggestion, index) => (
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
          ))}
        </ul>
      )}
    </div>
  )
}

export default CityAutocomplete
