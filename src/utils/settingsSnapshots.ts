import type { CompanySettingsPayload, SettingsSection, TableInput } from '../types'
import { parseFloorPlans, withFloorPlans } from '../types/company'
import { parseCompanyReservationMode } from '../data/companyReservationMode'

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
        mainPhotoIndex: form.mainPhotoIndex,
        videos: form.videos,
        characteristics: form.characteristics,
        venueTypes: form.venueTypes,
        amenities: form.amenities,
        priceRange: form.priceRange,
        latitude: form.latitude,
        longitude: form.longitude,
      })
    case 'reservation-settings':
      return JSON.stringify({
        reservationMode: form.reservationMode,
        timeSlotMinutes: form.timeSlotMinutes,
        timeSlotMinutesInput,
        depositEnabled: form.depositEnabled,
        depositMinPax: form.depositMinPax,
        depositPerGuestCents: form.depositPerGuestCents,
        depositCancellationHours: form.depositCancellationHours,
        turns: form.turns,
        schedule: form.schedule,
      })
    case 'tables':
      return JSON.stringify({
        tables,
        floorPlan: form.floorPlan,
        floorPlans: form.floorPlans,
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
          mainPhotoIndex: typeof parsed.mainPhotoIndex === 'number' ? parsed.mainPhotoIndex : 0,
          videos: parsed.videos as string[],
          characteristics: parsed.characteristics as string[],
          venueTypes: Array.isArray(parsed.venueTypes) ? parsed.venueTypes as string[] : [],
          amenities: Array.isArray(parsed.amenities) ? parsed.amenities as string[] : [],
          priceRange: typeof parsed.priceRange === 'string' ? parsed.priceRange as CompanySettingsPayload['priceRange'] : '',
          latitude: typeof parsed.latitude === 'number' ? parsed.latitude : parsed.latitude === null ? null : form.latitude,
          longitude: typeof parsed.longitude === 'number' ? parsed.longitude : parsed.longitude === null ? null : form.longitude,
        },
      }
    case 'reservation-settings':
      return {
        ...state,
        timeSlotMinutesInput: parsed.timeSlotMinutesInput as string,
        form: {
          ...form,
          timeSlotMinutes: parsed.timeSlotMinutes as number,
          reservationMode: parseCompanyReservationMode(parsed.reservationMode),
          depositEnabled: parsed.depositEnabled === true,
          depositMinPax: (parsed.depositMinPax as number | null | undefined) ?? null,
          depositPerGuestCents: (parsed.depositPerGuestCents as number | null | undefined) ?? null,
          depositCancellationHours: (parsed.depositCancellationHours as number | null | undefined) ?? null,
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
          ...withFloorPlans(parseFloorPlans(parsed.floorPlans ?? form.floorPlans, parsed.floorPlan)),
        },
      }
    default:
      return state
  }
}
