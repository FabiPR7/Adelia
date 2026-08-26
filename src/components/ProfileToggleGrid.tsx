import type { CompanyFacilityIcon } from '../data/companyProfileFacilities'
import FacilityIcon from './FacilityIcon'
import styles from './ProfileToggleGrid.module.css'

interface ProfileToggleOption {
  id: string
  label: string
  icon: CompanyFacilityIcon | string
}

interface ProfileToggleGridProps {
  label: string
  hint?: string
  options: readonly ProfileToggleOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  maxSelected?: number
}

function ProfileToggleGrid({
  label,
  hint,
  options,
  selected,
  onChange,
  maxSelected,
}: ProfileToggleGridProps) {
  const atLimit = typeof maxSelected === 'number' && selected.length >= maxSelected

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((item) => item !== id))
      return
    }

    if (atLimit) {
      return
    }

    onChange([...selected, id])
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {typeof maxSelected === 'number' ? (
          <span className={styles.counter}>
            {selected.length}/{maxSelected}
          </span>
        ) : (
          <span className={styles.counter}>{selected.length} activos</span>
        )}
      </div>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
      <div className={styles.grid} role="group" aria-label={label}>
        {options.map((option) => {
          const isOn = selected.includes(option.id)

          return (
            <button
              key={option.id}
              type="button"
              className={`${styles.tile} ${isOn ? styles.tileOn : ''}`}
              aria-pressed={isOn}
              disabled={!isOn && atLimit}
              onClick={() => toggle(option.id)}
            >
              <span className={styles.icon}>
                <FacilityIcon name={option.icon} />
              </span>
              <span className={styles.tileLabel}>{option.label}</span>
              <span className={styles.check} aria-hidden="true">
                {isOn ? '✓' : ''}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ProfileToggleGrid
