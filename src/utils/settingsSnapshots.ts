import type { CompanySettingsPayload, SettingsSection, TableInput } from '../types'

export interface SettingsEditorState {
  form: CompanySettingsPayload
  tables: TableInput[]
  timeSlotMinutesInput: string
}

export function createSectionSnapshot(
  section: SettingsSection,
  state: SettingsEditorState,
): string {
  const { form, tables, timeSlotMinutesInput } = state

  switch (section) {
    case 'contact':
      return JSON.stringify({
        name: form.name,
        contactEmail: form.contactEmail,
        phone: form.phone,
        location: form.location,
        website: form.website,
        logoUrl: form.logoUrl,
      })
    case 'profile':
      return JSON.stringify({
        municipality: form.municipality,
        country: form.country,
        postalCode: form.postalCode,
        description: form.description,
        photos: form.photos,
        videos: form.videos,
        characteristics: form.characteristics,
      })
    case 'reservation-settings':
      return JSON.stringify({
        timeSlotMinutes: form.timeSlotMinutes,
        timeSlotMinutesInput,
        turns: form.turns,
        schedule: form.schedule,
      })
    case 'tables':
      return JSON.stringify({
        tables,
        floorPlan: form.floorPlan,
      })
    default:
      return ''
  }
}

export function createAllSectionSnapshots(
  state: SettingsEditorState,
  sections: SettingsSection[],
): Record<SettingsSection, string> {
  return Object.fromEntries(
    sections.map((section) => [section, createSectionSnapshot(section, state)]),
  ) as Record<SettingsSection, string>
}

export function isSectionDirty(
  section: SettingsSection,
  state: SettingsEditorState,
  savedSnapshot: string | undefined,
): boolean {
  if (!savedSnapshot) {
    return false
  }

  return createSectionSnapshot(section, state) !== savedSnapshot
}

export function applySectionSnapshot(
  section: SettingsSection,
  snapshot: string,
  state: SettingsEditorState,
): SettingsEditorState {
  const parsed = JSON.parse(snapshot) as Record<string, unknown>
  const { form } = state

  switch (section) {
    case 'contact':
      return {
        ...state,
        form: {
          ...form,
          name: parsed.name as string,
          contactEmail: parsed.contactEmail as string,
          phone: parsed.phone as string,
          location: parsed.location as string,
          website: parsed.website as string,
          logoUrl: parsed.logoUrl as string,
        },
      }
    case 'profile':
      return {
        ...state,
        form: {
          ...form,
          municipality: parsed.municipality as string,
          country: parsed.country as string,
          postalCode: parsed.postalCode as string,
          description: parsed.description as string,
          photos: parsed.photos as string[],
          videos: parsed.videos as string[],
          characteristics: parsed.characteristics as string[],
        },
      }
    case 'reservation-settings':
      return {
        ...state,
        timeSlotMinutesInput: parsed.timeSlotMinutesInput as string,
        form: {
          ...form,
          timeSlotMinutes: parsed.timeSlotMinutes as number,
          turns: parsed.turns as CompanySettingsPayload['turns'],
          schedule: parsed.schedule as CompanySettingsPayload['schedule'],
        },
      }
    case 'tables':
      return {
        ...state,
        tables: parsed.tables as TableInput[],
        form: {
          ...form,
          floorPlan: parsed.floorPlan as CompanySettingsPayload['floorPlan'],
        },
      }
    default:
      return state
  }
}
