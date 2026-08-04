import { useEffect, useId, useRef, useState } from 'react'
import styles from './DiscoveryTraitsFilter.module.css'

interface DiscoveryTraitsFilterProps {
  options: string[]
  value: string
  onChange: (value: string) => void
}

function TraitsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <path
        fill="currentColor"
        d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.41l9 9c.36.37.86.59 1.41.59.55 0 1.05-.22 1.42-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z"
      />
    </svg>
  )
}

function DiscoveryTraitsFilter({ options, value, onChange }: DiscoveryTraitsFilterProps) {
  const panelId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  const handleSelect = (option: string) => {
    onChange(value === option ? '' : option)
    setIsOpen(false)
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.trigger} ${value ? styles.triggerActive : ''}`}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((current) => !current)}
      >
        <TraitsIcon />
        <span className={styles.triggerLabel}>{value || 'Estilo'}</span>
      </button>

      {isOpen && (
        <div id={panelId} className={styles.panel} role="dialog" aria-label="Filtrar por estilo">
          <p className={styles.panelTitle}>Tipo y ambiente</p>
          <div className={styles.chips}>
            {options.map((option) => (
              <button
                key={option}
                type="button"
                className={`${styles.chip} ${value === option ? styles.chipActive : ''}`}
                onClick={() => handleSelect(option)}
              >
                {option}
              </button>
            ))}
          </div>
          {value && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={() => {
                onChange('')
                setIsOpen(false)
              }}
            >
              Quitar filtro
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default DiscoveryTraitsFilter
