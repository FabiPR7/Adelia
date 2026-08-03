import { useMemo, useState } from 'react'
import styles from './CharacteristicPicker.module.css'

interface CharacteristicPickerProps {
  label?: string
  options: readonly string[]
  selected: string[]
  maxSelected: number
  onChange: (selected: string[]) => void
}

function CharacteristicPicker({
  label = 'Características',
  options,
  selected,
  maxSelected,
  onChange,
}: CharacteristicPickerProps) {
  const [query, setQuery] = useState('')
  const atLimit = selected.length >= maxSelected

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    if (!normalized) {
      return options
    }

    return options.filter((option) => option.toLowerCase().includes(normalized))
  }, [options, query])

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option))
      return
    }

    if (atLimit) {
      return
    }

    onChange([...selected, option])
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.counter}>
          {selected.length}/{maxSelected} seleccionadas
        </span>
      </div>

      {selected.length > 0 && (
        <div className={styles.selectedList}>
          {selected.map((option) => (
            <span key={option} className={styles.selectedChip}>
              {option}
              <button type="button" onClick={() => toggleOption(option)} aria-label={`Quitar ${option}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="search"
        className={styles.search}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar característica…"
        aria-label="Buscar característica"
      />

      <div className={styles.bubbles} role="listbox" aria-label={label} aria-multiselectable="true">
        {filteredOptions.length === 0 ? (
          <p className={styles.emptySearch}>Ninguna característica coincide con la búsqueda.</p>
        ) : (
          filteredOptions.map((option) => {
            const isSelected = selected.includes(option)

            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`${styles.bubble} ${isSelected ? styles.bubbleSelected : ''}`}
                disabled={!isSelected && atLimit}
                onClick={() => toggleOption(option)}
              >
                {option}
              </button>
            )
          })
        )}
      </div>

      <p className={styles.hint}>Elige hasta {maxSelected} características que describan tu local.</p>
    </div>
  )
}

export default CharacteristicPicker
