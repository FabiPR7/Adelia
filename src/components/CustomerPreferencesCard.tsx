import { useEffect, useState } from 'react'
import { saveCustomerPreferences } from '../services/customerAccount'
import styles from './CustomerPreferencesCard.module.css'

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

interface CustomerPreferencesCardProps {
  birthday: string
  hideFromRanking: boolean
  onSaved: () => Promise<void> | void
}

function splitBirthday(value: string): { month: string; day: string } {
  const match = /^(\d{2})-(\d{2})$/.exec(value)
  return match ? { month: String(Number(match[1])), day: String(Number(match[2])) } : { month: '', day: '' }
}

/** Cumpleaños (día y mes, sin año) y si sale en los rankings públicos. */
function CustomerPreferencesCard({ birthday, hideFromRanking, onSaved }: CustomerPreferencesCardProps) {
  const initial = splitBirthday(birthday)
  const [month, setMonth] = useState(initial.month)
  const [day, setDay] = useState(initial.day)
  const [hidden, setHidden] = useState(hideFromRanking)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const next = splitBirthday(birthday)
    setMonth(next.month)
    setDay(next.day)
  }, [birthday])

  useEffect(() => {
    setHidden(hideFromRanking)
  }, [hideFromRanking])

  const maxDay = month ? DAYS_IN_MONTH[Number(month) - 1] : 31
  const birthdayValue = month && day ? `${month.padStart(2, '0')}-${day.padStart(2, '0')}` : ''
  const dirty = birthdayValue !== birthday || hidden !== hideFromRanking

  const save = async () => {
    if ((month && !day) || (!month && day)) {
      setMessage({ tone: 'error', text: 'Elige el día y el mes, o deja los dos vacíos.' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      await saveCustomerPreferences({ birthday: birthdayValue, hideFromRanking: hidden })
      await onSaved()
      setMessage({ tone: 'ok', text: 'Guardado.' })
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={styles.card} aria-labelledby="prefs-title">
      <h2 id="prefs-title" className={styles.title}>Preferencias</h2>

      <div className={styles.row}>
        <div>
          <p className={styles.label}>🎂 Tu cumpleaños</p>
          <p className={styles.hint}>Solo el día y el mes, para felicitarte ese día. No se enseña a nadie.</p>
        </div>
        <div className={styles.birthday}>
          <select
            aria-label="Día"
            value={day}
            onChange={(event) => setDay(event.target.value)}
          >
            <option value="">Día</option>
            {Array.from({ length: maxDay }, (_, index) => String(index + 1)).map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
          <select
            aria-label="Mes"
            value={month}
            onChange={(event) => {
              const nextMonth = event.target.value
              setMonth(nextMonth)
              const limit = nextMonth ? DAYS_IN_MONTH[Number(nextMonth) - 1] : 31
              if (Number(day) > limit) setDay(String(limit))
            }}
          >
            <option value="">Mes</option>
            {MONTHS.map((name, index) => (
              <option key={name} value={String(index + 1)}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      <label className={styles.row}>
        <div>
          <p className={styles.label}>🏆 Salir en los rankings</p>
          <p className={styles.hint}>
            Si lo quitas, los demás no te verán en los rankings. Tú sigues sumando XP y viendo tu puesto, y tus
            amigos te siguen viendo.
          </p>
        </div>
        <input
          type="checkbox"
          className={styles.switch}
          role="switch"
          checked={!hidden}
          onChange={(event) => setHidden(!event.target.checked)}
        />
      </label>

      {message ? (
        <p className={message.tone === 'ok' ? styles.ok : styles.error} role="status">{message.text}</p>
      ) : null}

      <button type="button" className={styles.save} onClick={() => void save()} disabled={!dirty || saving}>
        {saving ? 'Guardando…' : 'Guardar preferencias'}
      </button>
    </section>
  )
}

export default CustomerPreferencesCard
