import { useState } from 'react'
import type { TimeRange, DateRangeFilter } from '../../services/adminAnalytics'
import styles from './AdminAnalyticsFilters.module.css'

interface AdminAnalyticsFiltersProps {
  timeRange: TimeRange
  onTimeRangeChange: (range: TimeRange) => void
  countryFilter: string
  onCountryFilterChange: (country: string) => void
  availableCountries: string[]
  onCustomDateRangeChange?: (range: DateRangeFilter) => void
}

function AdminAnalyticsFilters({
  timeRange,
  onTimeRangeChange,
  countryFilter,
  onCountryFilterChange,
  availableCountries,
  onCustomDateRangeChange,
}: AdminAnalyticsFiltersProps) {
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)
  const [tempStartDate, setTempStartDate] = useState('')
  const [tempEndDate, setTempEndDate] = useState('')

  const handleTimeRangeChange = (range: TimeRange) => {
    onTimeRangeChange(range)
    if (range !== 'custom') {
      setShowCustomDatePicker(false)
    } else {
      setShowCustomDatePicker(true)
    }
  }

  const applyCustomDateRange = () => {
    if (tempStartDate && tempEndDate && onCustomDateRangeChange) {
      onCustomDateRangeChange({
        startDate: new Date(tempStartDate),
        endDate: new Date(tempEndDate),
      })
    }
  }

  return (
    <div className={styles.filters}>
      <div className={styles.filterGroup}>
        <label className={styles.label}>Periodo de tiempo</label>
        <div className={styles.buttonGroup}>
          <button
            type="button"
            className={`${styles.filterButton} ${timeRange === 'today' ? styles.active : ''}`}
            onClick={() => handleTimeRangeChange('today')}
          >
            Hoy
          </button>
          <button
            type="button"
            className={`${styles.filterButton} ${timeRange === 'week' ? styles.active : ''}`}
            onClick={() => handleTimeRangeChange('week')}
          >
            Semana
          </button>
          <button
            type="button"
            className={`${styles.filterButton} ${timeRange === 'month' ? styles.active : ''}`}
            onClick={() => handleTimeRangeChange('month')}
          >
            Mes
          </button>
          <button
            type="button"
            className={`${styles.filterButton} ${timeRange === 'quarter' ? styles.active : ''}`}
            onClick={() => handleTimeRangeChange('quarter')}
          >
            Trimestre
          </button>
          <button
            type="button"
            className={`${styles.filterButton} ${timeRange === 'semester' ? styles.active : ''}`}
            onClick={() => handleTimeRangeChange('semester')}
          >
            Semestre
          </button>
          <button
            type="button"
            className={`${styles.filterButton} ${timeRange === 'year' ? styles.active : ''}`}
            onClick={() => handleTimeRangeChange('year')}
          >
            Año
          </button>
          <button
            type="button"
            className={`${styles.filterButton} ${timeRange === 'custom' ? styles.active : ''}`}
            onClick={() => handleTimeRangeChange('custom')}
          >
            Personalizado
          </button>
        </div>

        {showCustomDatePicker && (
          <div className={styles.customDatePicker}>
            <div className={styles.dateInputGroup}>
              <label className={styles.dateLabel}>Desde</label>
              <input
                type="date"
                value={tempStartDate}
                onChange={(e) => setTempStartDate(e.target.value)}
                className={styles.dateInput}
              />
            </div>
            <div className={styles.dateInputGroup}>
              <label className={styles.dateLabel}>Hasta</label>
              <input
                type="date"
                value={tempEndDate}
                onChange={(e) => setTempEndDate(e.target.value)}
                className={styles.dateInput}
              />
            </div>
            <button
              type="button"
              className={styles.applyButton}
              onClick={applyCustomDateRange}
              disabled={!tempStartDate || !tempEndDate}
            >
              Aplicar
            </button>
          </div>
        )}
      </div>

      <div className={styles.filterGroup}>
        <label className={styles.label} htmlFor="country-filter">
          Filtrar por país
        </label>
        <select
          id="country-filter"
          className={styles.select}
          value={countryFilter}
          onChange={(e) => onCountryFilterChange(e.target.value)}
        >
          <option value="">Todos los países</option>
          {availableCountries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default AdminAnalyticsFilters
