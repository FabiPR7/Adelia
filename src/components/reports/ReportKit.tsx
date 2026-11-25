/**
 * Piezas comunes de los Informes del panel: cabecera, barra de periodo,
 * cifras con comparación, tarjetas de gráfico y tablas con buscador.
 * Así los cinco informes se ven y se usan igual.
 */
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { CalendarRange, Download, RefreshCw, Search, type LucideIcon } from 'lucide-react'
import type { ReportGranularity, ReportPeriodConfig } from '../../utils/reservationReports'
import styles from './ReportKit.module.css'

export { styles as reportStyles }

export const GRANULARITY_OPTIONS: { id: ReportGranularity; label: string }[] = [
  { id: 'monthly', label: 'Mes' },
  { id: 'quarterly', label: 'Trimestre' },
  { id: 'annual', label: 'Año' },
]

export const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const label = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date(2024, index, 1))
  return { value: index + 1, label: label.charAt(0).toUpperCase() + label.slice(1) }
})

export const QUARTER_OPTIONS = [
  { value: 1, label: '1.º trimestre (ene – mar)' },
  { value: 2, label: '2.º trimestre (abr – jun)' },
  { value: 3, label: '3.º trimestre (jul – sep)' },
  { value: 4, label: '4.º trimestre (oct – dic)' },
]

/** Periodo anterior dentro del mismo año (los datos se cargan por año). */
export function previousPeriodConfig(config: ReportPeriodConfig): ReportPeriodConfig | null {
  if (config.granularity === 'monthly' && config.month > 1) {
    return { ...config, month: config.month - 1 }
  }
  if (config.granularity === 'quarterly' && config.quarter > 1) {
    return { ...config, quarter: config.quarter - 1 }
  }
  return null
}

export function previousPeriodLabel(config: ReportPeriodConfig): string {
  if (config.granularity === 'monthly') return 'el mes anterior'
  if (config.granularity === 'quarterly') return 'el trimestre anterior'
  return 'el año anterior'
}

export interface KpiDelta {
  text: string
  tone: 'up' | 'down' | 'flat'
}

/** Variación frente al periodo anterior; `invert` para cifras donde subir es malo. */
export function computeDelta(current: number, previous: number | null | undefined, invert = false): KpiDelta | null {
  if (previous == null) {
    return null
  }
  if (previous <= 0) {
    return current > 0 ? { text: 'Nuevo', tone: invert ? 'down' : 'up' } : null
  }
  const pct = Math.round(((current - previous) / previous) * 100)
  if (pct === 0) {
    return { text: '0 %', tone: 'flat' }
  }
  const good = invert ? pct < 0 : pct > 0
  return { text: `${pct > 0 ? '+' : ''}${pct} %`, tone: good ? 'up' : 'down' }
}

/** Con punto de miles también en los de 4 cifras («1.265», no «1265»). */
export function formatNumber(value: number, decimals = 0): string {
  let text: string
  try {
    text = new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: 'always' as unknown as boolean,
    }).format(value)
  } catch {
    text = value.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }
  return text.replace(/^(-?)(d)(d{3})(?=$|,)/, '$1$2.$3')
}

export function ReportHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerText}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
      {actions ? <div className={styles.headerActions}>{actions}</div> : null}
    </header>
  )
}

interface ReportPeriodBarProps {
  config: ReportPeriodConfig
  years: number[]
  periodLabel: string
  loading: boolean
  onChange: (next: ReportPeriodConfig) => void
  onRefresh: () => void
}

export function ReportPeriodBar({ config, years, periodLabel, loading, onChange, onRefresh }: ReportPeriodBarProps) {
  return (
    <div className={styles.periodBar}>
      <div className={styles.segmented} role="radiogroup" aria-label="Periodo del informe">
        {GRANULARITY_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={config.granularity === option.id}
            className={`${styles.segmentedButton} ${config.granularity === option.id ? styles.segmentedButtonOn : ''}`}
            onClick={() => onChange({ ...config, granularity: option.id })}
          >
            {option.label}
          </button>
        ))}
      </div>

      {config.granularity === 'monthly' ? (
        <select
          className={styles.select}
          value={config.month}
          onChange={(event) => onChange({ ...config, month: Number(event.target.value) })}
          aria-label="Mes"
        >
          {MONTH_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : null}

      {config.granularity === 'quarterly' ? (
        <select
          className={styles.select}
          value={config.quarter}
          onChange={(event) => onChange({ ...config, quarter: Number(event.target.value) })}
          aria-label="Trimestre"
        >
          {QUARTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      ) : null}

      <select
        className={`${styles.select} ${styles.selectYear}`}
        value={config.year}
        onChange={(event) => onChange({ ...config, year: Number(event.target.value) })}
        aria-label="Año"
      >
        {years.map((year) => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>

      <span className={styles.periodLabel}>
        <CalendarRange size={15} aria-hidden="true" />
        {periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)}
      </span>

      <button type="button" className={styles.ghostButton} onClick={onRefresh} disabled={loading}>
        <RefreshCw size={15} aria-hidden="true" className={loading ? styles.spin : undefined} />
        {loading ? 'Actualizando…' : 'Actualizar'}
      </button>
    </div>
  )
}

/**
 * Las cifras del informe, como la carta de un restaurante: la primera va sola
 * y en grande (el «plato del día»); el resto, en lista con puntos hasta la cifra.
 * `columns` se mantiene por compatibilidad: la carta se reparte sola.
 */
export function KpiGrid({ children }: { children: ReactNode; columns?: 3 | 4 | 5 }) {
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<KpiCardProps>[]
  if (items.length === 0) return null
  const [lead, ...rest] = items
  return (
    <div className={styles.kpis}>
      {cloneElement(lead, { variant: 'lead' })}
      {rest.length > 0 ? (
        <div className={styles.menu}>
          {rest.map((item) => cloneElement(item, { variant: 'item' }))}
        </div>
      ) : null}
    </div>
  )
}

interface KpiCardProps {
  icon: LucideIcon
  label: string
  value: ReactNode
  suffix?: string
  hint?: ReactNode
  delta?: KpiDelta | null
  deltaLabel?: string
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'info'
  /** Lo pone KpiGrid: la primera cifra va destacada y el resto en la carta. */
  variant?: 'lead' | 'item'
}

function DeltaNote({ delta, deltaLabel, long }: { delta: KpiDelta; deltaLabel?: string; long?: boolean }) {
  const arrow = delta.tone === 'up' ? '↗' : delta.tone === 'down' ? '↘' : '→'
  return (
    <span className={`${styles.delta} ${styles[`delta_${delta.tone}`]}`} title={deltaLabel ? `Frente a ${deltaLabel}` : undefined}>
      <span aria-hidden="true">{arrow}</span> {delta.text}
      {long && deltaLabel ? (
        <span className={styles.deltaWhen}> {deltaLabel.startsWith('el ') ? `frente al ${deltaLabel.slice(3)}` : `frente a ${deltaLabel}`}</span>
      ) : null}
    </span>
  )
}

export function KpiCard({ label, value, suffix, hint, delta, deltaLabel, variant = 'item' }: KpiCardProps) {
  if (variant === 'lead') {
    return (
      <div className={styles.lead}>
        <span className={styles.leadLabel}>{label}</span>
        <span className={styles.leadValue}>
          {value}
          {suffix ? <small>{suffix}</small> : null}
        </span>
        <span className={styles.leadFoot}>
          {delta ? <DeltaNote delta={delta} deltaLabel={deltaLabel} long /> : null}
          {/* La frase ya dice con qué se compara: no se repite «vs. …». */}
          {hint && !(delta && deltaLabel && typeof hint === 'string' && hint.startsWith('vs.')) ? (
            <span className={styles.kpiHint}>{hint}</span>
          ) : null}
        </span>
      </div>
    )
  }

  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.leader} aria-hidden="true" />
      <span className={styles.kpiValue}>
        {value}
        {suffix ? <small>{suffix}</small> : null}
      </span>
      {delta || hint ? (
        <span className={styles.kpiFoot}>
          {delta ? <DeltaNote delta={delta} deltaLabel={deltaLabel} /> : null}
          {hint ? <span className={styles.kpiHint}>{hint}</span> : null}
        </span>
      ) : null}
    </div>
  )
}

interface ReportCardProps {
  title: string
  subtitle?: string
  icon?: LucideIcon
  wide?: boolean
  aside?: ReactNode
  children: ReactNode
}

export function ReportCard({ title, subtitle, icon: Icon, wide, aside, children }: ReportCardProps) {
  return (
    <section className={`${styles.card} ${wide ? styles.cardWide : ''}`}>
      <header className={styles.cardHead}>
        <div className={styles.cardHeadText}>
          <h3>
            {Icon ? <Icon size={15} aria-hidden="true" /> : null}
            {title}
          </h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {aside ? <div className={styles.cardAside}>{aside}</div> : null}
      </header>
      <div className={styles.cardBody}>{children}</div>
    </section>
  )
}

export function ChartsGrid({ children }: { children: ReactNode }) {
  return <div className={styles.chartsGrid}>{children}</div>
}

interface TableCardProps {
  title: string
  meta?: ReactNode
  search?: { value: string; onChange: (value: string) => void; placeholder: string }
  filters?: ReactNode
  onDownload?: () => void
  downloadDisabled?: boolean
  footer?: ReactNode
  children: ReactNode
}

export function TableCard({ title, meta, search, filters, onDownload, downloadDisabled, footer, children }: TableCardProps) {
  return (
    <section className={styles.tableCard}>
      <header className={styles.tableHead}>
        <div className={styles.cardHeadText}>
          <h3>{title}</h3>
          {meta ? <p>{meta}</p> : null}
        </div>
        <div className={styles.tableTools}>
          {filters}
          {search ? (
            <label className={styles.searchField}>
              <Search size={15} aria-hidden="true" />
              <input
                type="search"
                value={search.value}
                onChange={(event) => search.onChange(event.target.value)}
                placeholder={search.placeholder}
                aria-label={search.placeholder}
              />
            </label>
          ) : null}
          {onDownload ? (
            <button type="button" className={styles.secondaryButton} onClick={onDownload} disabled={downloadDisabled}>
              <Download size={15} aria-hidden="true" />
              Excel
            </button>
          ) : null}
        </div>
      </header>
      {children}
      {footer ? <footer className={styles.tableFooter}>{footer}</footer> : null}
    </section>
  )
}

export function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text?: string }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon} aria-hidden="true">
        <Icon size={20} />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      {text ? <p>{text}</p> : null}
    </div>
  )
}

export function LoadingState({ text = 'Cargando informe…' }: { text?: string }) {
  return (
    <div className={styles.loadingState}>
      <span className={styles.spinner} aria-hidden="true" />
      {text}
    </div>
  )
}

/** Barra horizontal sencilla para rankings dentro de tablas. */
export function InlineBar({ value, max, tone = 'accent' }: { value: number; max: number; tone?: 'accent' | 'good' }) {
  const percent = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <span className={styles.inlineBar} aria-hidden="true">
      <span className={tone === 'good' ? styles.inlineBarGood : undefined} style={{ width: `${percent}%` }} />
    </span>
  )
}
