export interface GroupableSlot {
  time: string
  available: boolean
}

export interface SlotGroup<T extends GroupableSlot> {
  id: 'morning' | 'lunch' | 'afternoon' | 'night'
  label: string
  slots: T[]
}

const PERIODS: Array<{ id: SlotGroup<GroupableSlot>['id']; label: string; fromMinutes: number }> = [
  { id: 'morning', label: 'Mañana', fromMinutes: 0 },
  { id: 'lunch', label: 'Mediodía', fromMinutes: 12 * 60 },
  { id: 'afternoon', label: 'Tarde', fromMinutes: 17 * 60 },
  { id: 'night', label: 'Noche', fromMinutes: 20 * 60 },
]

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return (hours || 0) * 60 + (minutes || 0)
}

/** Agrupa por franja las horas que se pueden pedir; las ocupadas o pasadas no se muestran. */
export function groupBookableSlots<T extends GroupableSlot>(slots: T[]): SlotGroup<T>[] {
  const visible = slots.filter((slot) => slot.available)

  return PERIODS.map((period, index) => {
    const nextFrom = PERIODS[index + 1]?.fromMinutes ?? Number.POSITIVE_INFINITY

    return {
      id: period.id,
      label: period.label,
      slots: visible.filter((slot) => {
        const minutes = toMinutes(slot.time)
        return minutes >= period.fromMinutes && minutes < nextFrom
      }),
    }
  }).filter((group) => group.slots.length > 0)
}
