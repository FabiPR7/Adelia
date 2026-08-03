export type SortDirection = 'asc' | 'desc'

export interface SortState {
  key: string
  direction: SortDirection
}

export function nextSortState(
  current: SortState,
  key: string,
  defaultDirection: SortDirection = 'asc',
): SortState {
  if (current.key === key) {
    return {
      key,
      direction: current.direction === 'asc' ? 'desc' : 'asc',
    }
  }

  return { key, direction: defaultDirection }
}

export function compareStrings(left: string, right: string, direction: SortDirection): number {
  const result = left.localeCompare(right, 'es', { sensitivity: 'base' })
  return direction === 'asc' ? result : -result
}

export function compareNumbers(left: number, right: number, direction: SortDirection): number {
  return direction === 'asc' ? left - right : right - left
}

export function compareDates(left: Date, right: Date, direction: SortDirection): number {
  return compareNumbers(left.getTime(), right.getTime(), direction)
}
