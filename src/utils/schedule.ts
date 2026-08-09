import type { CompanySchedule, DaySchedule } from '../types'
import { SCHEDULE_DAY_KEYS, SCHEDULE_DAY_LABELS } from '../types/company'

export const MAX_SCHEDULE_PERIODS = 3

export interface SchedulePeriod {
  open: string
  close: string
}

export function defaultDaySchedule(
  active: boolean,
  open = '13:00',
  close = '23:00',
): DaySchedule {
  return syncDayScheduleFields({
    active,
    periods: active ? [{ open, close }] : [{ open: '', close: '' }],
  })
}

export function syncDayScheduleFields(day: {
  active: boolean
  periods: SchedulePeriod[]
}): DaySchedule {
  const periods = day.periods.slice(0, MAX_SCHEDULE_PERIODS).map((period) => ({
    open: period.open ?? '',
    close: period.close ?? '',
  }))

  if (periods.length === 0) {
    periods.push({ open: '', close: '' })
  }

  return {
    active: day.active,
    periods,
    open: periods[0]?.open ?? '',
    close: periods[periods.length - 1]?.close ?? '',
  }
}

export function normalizeDaySchedule(raw: Partial<DaySchedule> | Record<string, unknown>): DaySchedule {
  const active = Boolean(raw.active)

  if (Array.isArray(raw.periods) && raw.periods.length > 0) {
    const periods = raw.periods.slice(0, MAX_SCHEDULE_PERIODS).map((period) => {
      const entry = period as Partial<SchedulePeriod>
      return {
        open: typeof entry.open === 'string' ? entry.open : '',
        close: typeof entry.close === 'string' ? entry.close : '',
      }
    })

    return syncDayScheduleFields({ active, periods })
  }

  const open = typeof raw.open === 'string' ? raw.open : ''
  const close = typeof raw.close === 'string' ? raw.close : ''

  return syncDayScheduleFields({
    active,
    periods: [{ open, close }],
  })
}

export function normalizeCompanySchedule(schedule: Partial<CompanySchedule> | Record<string, unknown>): CompanySchedule {
  const normalized = {} as CompanySchedule

  for (const dayKey of SCHEDULE_DAY_KEYS) {
    const rawDay = schedule[dayKey]
    normalized[dayKey] = normalizeDaySchedule(
      rawDay && typeof rawDay === 'object' ? (rawDay as Partial<DaySchedule>) : {},
    )
  }

  return normalized
}

export function getDaySchedulePeriods(day: DaySchedule): SchedulePeriod[] {
  if (Array.isArray(day.periods) && day.periods.length > 0) {
    return day.periods
  }

  return [{ open: day.open, close: day.close }]
}

export function getDaySchedulePeriodCount(day: DaySchedule): number {
  return getDaySchedulePeriods(day).length
}

export function resizeDaySchedulePeriods(day: DaySchedule, count: number): DaySchedule {
  const targetCount = Math.min(MAX_SCHEDULE_PERIODS, Math.max(1, count))
  const current = getDaySchedulePeriods(day)
  const next = current.slice(0, targetCount)

  while (next.length < targetCount) {
    if (next.length === 0) {
      next.push({ open: '13:00', close: '16:00' })
      continue
    }

    const previous = next[next.length - 1]
    const previousClose = previous.close || '16:00'
    const nextOpen = previousClose > '20:00' ? previousClose : '20:00'
    const nextClose = nextOpen >= '23:00' ? '23:59' : '23:00'
    next.push({ open: nextOpen, close: nextClose })
  }

  return syncDayScheduleFields({ active: day.active, periods: next })
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function schedulePeriodsOverlap(first: SchedulePeriod, second: SchedulePeriod): boolean {
  if (!first.open || !first.close || !second.open || !second.close) {
    return false
  }

  const firstStart = timeToMinutes(first.open)
  const firstEnd = timeToMinutes(first.close)
  const secondStart = timeToMinutes(second.open)
  const secondEnd = timeToMinutes(second.close)

  return firstStart < secondEnd && secondStart < firstEnd
}

export function updateDaySchedulePeriod(
  day: DaySchedule,
  periodIndex: number,
  field: keyof SchedulePeriod,
  value: string,
): DaySchedule {
  const periods = getDaySchedulePeriods(day).map((period, index) =>
    index === periodIndex ? { ...period, [field]: value } : period,
  )

  return syncDayScheduleFields({ active: day.active, periods })
}

export function validateDaySchedule(day: DaySchedule, dayLabel: string): string | null {
  if (!day.active) {
    return null
  }

  const periods = getDaySchedulePeriods(day)

  for (let index = 0; index < periods.length; index += 1) {
    const period = periods[index]
    const label = periods.length > 1 ? `${dayLabel}, tramo ${index + 1}` : dayLabel

    if (!period.open || !period.close) {
      return `Completa el horario de ${label}.`
    }

    if (period.open >= period.close) {
      return `El horario de ${label} debe cerrar después de abrir.`
    }
  }

  for (let firstIndex = 0; firstIndex < periods.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < periods.length; secondIndex += 1) {
      if (schedulePeriodsOverlap(periods[firstIndex], periods[secondIndex])) {
        if (periods.length === 2) {
          return `En ${dayLabel}, los dos tramos no pueden cruzarse (por ejemplo, 12:00–16:00 y 20:00–00:00).`
        }

        return `En ${dayLabel}, los tramos ${firstIndex + 1} y ${secondIndex + 1} se cruzan.`
      }
    }
  }

  return null
}

export function validateCompanyScheduleDetailed(schedule: CompanySchedule): string | null {
  for (const dayKey of SCHEDULE_DAY_KEYS) {
    const error = validateDaySchedule(schedule[dayKey], SCHEDULE_DAY_LABELS[dayKey])

    if (error) {
      return error
    }
  }

  return null
}
