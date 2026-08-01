const AUTH_DOMAIN = 'adelia.app'

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function slugToAuthEmail(slug: string): string {
  return `${slug}@${AUTH_DOMAIN}`
}

export function defaultSchedule() {
  const openDay = { open: '13:00', close: '23:00', active: true }
  const closedDay = { open: '', close: '', active: false }

  return {
    monday: { ...openDay },
    tuesday: { ...openDay },
    wednesday: { ...closedDay },
    thursday: { ...openDay },
    friday: { open: '13:00', close: '23:30', active: true },
    saturday: { open: '13:00', close: '23:30', active: true },
    sunday: { open: '13:00', close: '16:00', active: true },
  }
}

export function mapCompanyDoc(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    name: data.name as string,
    slug: data.slug as string,
    ownerUid: data.ownerUid as string,
    phone: data.phone as string,
    website: (data.website as string) ?? '',
    location: data.location as string,
    timeSlotMinutes: (data.timeSlotMinutes as number) ?? 120,
    schedule: data.schedule,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
  }
}
