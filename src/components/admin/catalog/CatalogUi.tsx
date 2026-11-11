import { useCallback, useRef, useState, type ReactNode } from 'react'
import { getFirestoreErrorMessage } from '../../../services/firestore'
import styles from '../AdminCatalog.module.css'
import { adminApi } from '../../../services/adminApi'
import { resetCatalogBundle } from '../../../services/catalogBundle'

export function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className={styles.card}>
      <header className={styles.cardHead}>
        <h3>{title}</h3>
        {hint ? <p>{hint}</p> : null}
      </header>
      {children}
    </section>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span>{label}{hint ? <> <em>· {hint}</em></> : null}</span>
      {children}
    </label>
  )
}

export function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <input
      className={styles.input}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function NumberInput({
  value,
  onChange,
  min,
  step,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  step?: number
}) {
  return (
    <input
      className={styles.input}
      type="number"
      min={min}
      step={step}
      inputMode="decimal"
      value={Number.isFinite(value) ? value : ''}
      onChange={(event) => onChange(event.target.value === '' ? Number.NaN : Number(event.target.value))}
    />
  )
}

export function TextArea({
  value,
  onChange,
  rows = 3,
}: {
  value: string
  onChange: (value: string) => void
  rows?: number
}) {
  return (
    <textarea
      className={styles.textarea}
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <select
      className={styles.select}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  )
}

export function Check({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label className={styles.check}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  )
}

export function ColorInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#cccccc'
  return <input className={styles.color} type="color" value={safe} onChange={(event) => onChange(event.target.value)} />
}

/** Texto con una entrada por línea ⇄ lista. */
export function linesToList(value: string): string[] {
  return value.split('\n').map((line) => line.trim()).filter(Boolean)
}

/**
 * Borrador editable: parte de una copia de lo que hay guardado y avisa cuando
 * cambia. `markSaved` fija el estado actual como nuevo punto de partida.
 */
export function useDraft<T>(initial: () => T) {
  const [draft, setDraft] = useState<T>(initial)
  const baseline = useRef(JSON.stringify(draft))
  const dirty = JSON.stringify(draft) !== baseline.current

  const markSaved = useCallback((next?: T) => {
    baseline.current = JSON.stringify(next ?? draft)
    setDraft((current) => (next ?? current))
  }, [draft])

  const reset = useCallback(() => {
    setDraft(JSON.parse(baseline.current) as T)
  }, [])

  return { draft, setDraft, dirty, markSaved, reset }
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function useSave(section = 'Catálogo') {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const run = useCallback(async (action: () => Promise<void>, validate?: () => string | null) => {
    const problem = validate?.() ?? null
    if (problem) {
      setStatus('error')
      setMessage(problem)
      return false
    }
    setStatus('saving')
    setMessage(null)
    try {
      await action()
      // Las visitas nuevas piden el catálogo otra vez y queda apuntado quién lo cambió.
      resetCatalogBundle()
      void adminApi.logChange('catalog.save', section, { section })
      setStatus('saved')
      setMessage('Guardado. Llega a la web y al servidor en unos minutos (como mucho 10).')
      return true
    } catch (error) {
      setStatus('error')
      setMessage(getFirestoreErrorMessage(error) || 'No se pudo guardar.')
      return false
    }
  }, [section])

  const clear = useCallback(() => {
    setStatus('idle')
    setMessage(null)
  }, [])

  return { status, message, run, clear }
}

export function SaveBar({
  dirty,
  status,
  message,
  onSave,
  onReset,
  saveLabel = 'Guardar cambios',
}: {
  dirty: boolean
  status: SaveStatus
  message: string | null
  onSave: () => void
  onReset: () => void
  saveLabel?: string
}) {
  const saving = status === 'saving'
  const text = status === 'error' || status === 'saved'
    ? message
    : dirty
      ? 'Tienes cambios sin guardar.'
      : 'Todo guardado.'

  return (
    <div className={styles.saveBar} role="status" aria-live="polite">
      <span className={`${styles.saveMsg} ${status === 'saved' && !dirty ? styles.saveOk : ''} ${status === 'error' ? styles.saveError : ''}`}>
        {text}
      </span>
      <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onReset} disabled={!dirty || saving}>
        Descartar
      </button>
      <button type="button" className={styles.btn} onClick={onSave} disabled={!dirty || saving}>
        {saving ? 'Guardando…' : saveLabel}
      </button>
    </div>
  )
}
