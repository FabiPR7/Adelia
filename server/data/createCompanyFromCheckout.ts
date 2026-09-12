import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb, canUseAdminSdk } from '../firebase-admin.ts'
import { COLLECTIONS } from './collections.ts'
import { writeCompanyOps } from './companyOps.ts'
import { syncRestaurantIndex } from './restaurantIndex.ts'
import { defaultCompanyEmailTemplates } from '../email/emailTemplateDefaults.ts'
import { InputError, asEmail, asOptionalTrimmed, asPlainText } from '../security/validate.ts'
import { requireSpanishPhone } from '../security/phone.ts'
import { createStripeClient, isStripeConfigured } from '../stripe/config.ts'
import { parseSaasCheckoutPlanId, SAAS_CHECKOUT_META } from '../stripe/saasCatalog.ts'
import { claimPendingLemonPlan } from '../lemonsqueezy/syncCompany.ts'
import { defaultSchedule, slugToAuthEmail, slugify } from '../utils.ts'

function requirePassword(value: unknown): string {
  if (typeof value !== 'string') {
    throw new InputError('Indica una contraseña.')
  }
  if (value.length < 8 || !/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value)) {
    throw new InputError('La contraseña debe tener 8 caracteres, mayúscula, minúscula y número.')
  }
  return value
}

function optionalWebsite(value: unknown): string {
  const raw = asOptionalTrimmed(value, 200)
  if (!raw) {
    return ''
  }
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new InputError('La web no es válida.')
    }
  } catch {
    throw new InputError('La web no es válida.')
  }
  return url.slice(0, 200)
}

function optionalHttpsUrls(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return [...new Set(value.filter((item): item is string => (
    typeof item === 'string'
    && /^https:\/\//i.test(item.trim())
    && item.trim().length <= 500
  )).map((item) => item.trim()))].slice(0, max)
}

function optionalLabels(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return [...new Set(value.filter((item): item is string => (
    typeof item === 'string'
    && item.trim().length >= 2
    && item.trim().length <= 40
  )).map((item) => item.trim()))].slice(0, max)
}

function optionalIds(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return [...new Set(value.filter((item): item is string => (
    typeof item === 'string'
    && /^[a-z0-9_]{2,40}$/.test(item)
  )))].slice(0, max)
}

function optionalCoord(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }
  return value
}

interface CompanySignupProfile {
  email: string
  phone: string
  password: string
  name: string
  location: string
  website?: string
  municipality?: string
  postalCode?: string
  country?: string
  latitude?: number | null
  longitude?: number | null
  logoUrl?: string
  photos?: string[]
  characteristics?: string[]
  venueTypes?: string[]
  amenities?: string[]
}

function parseSignupProfile(input: CompanySignupProfile) {
  return {
    password: requirePassword(input.password),
    contactEmail: asEmail(input.email),
    phone: requireSpanishPhone(input.phone),
    name: asPlainText(input.name, 80, 'El nombre del local'),
    location: asPlainText(input.location, 200, 'La dirección'),
    website: optionalWebsite(input.website),
    municipality: asOptionalTrimmed(input.municipality, 80),
    postalCode: asOptionalTrimmed(input.postalCode, 12),
    country: asOptionalTrimmed(input.country, 60) || 'España',
    latitude: optionalCoord(input.latitude),
    longitude: optionalCoord(input.longitude),
    photos: optionalHttpsUrls(input.photos, 5),
    logoUrl: optionalHttpsUrls(input.logoUrl ? [input.logoUrl] : [], 1)[0] ?? '',
    characteristics: optionalLabels(input.characteristics, 10),
    venueTypes: optionalIds(input.venueTypes, 3),
    amenities: optionalIds(input.amenities, 40),
  }
}

async function provisionCompanyAccount(
  profile: ReturnType<typeof parseSignupProfile>,
  plan: {
    planId: 'free' | 'basic' | 'premium'
    planBilling: 'monthly' | null
    stripeBillingCustomerId: string | null
    stripeSubscriptionId: string | null
    markPlanPaid: boolean
  },
): Promise<{ companyId: string; slug: string; loginName: string }> {
  const { password, contactEmail, phone, name, location, website, municipality, postalCode, country, latitude, longitude, photos, logoUrl, characteristics, venueTypes, amenities } = profile

  const slug = slugify(name)
  if (!slug) {
    throw new InputError('Elige un nombre de local con letras o números.')
  }

  const slugConflict = await adminDb.collection(COLLECTIONS.companies).where('slug', '==', slug).limit(1).get()
  if (!slugConflict.empty) {
    throw new InputError('Ya hay un local con ese nombre. Prueba una variante.')
  }

  const authEmail = slugToAuthEmail(slug)
  const companyRef = adminDb.collection(COLLECTIONS.companies).doc()
  const now = Timestamp.now()
  let ownerUid = ''

  try {
    const userRecord = await adminAuth.createUser({
      email: authEmail,
      password,
      displayName: name,
    }).catch((error: unknown) => {
      const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code: string }).code)
        : ''
      if (code.includes('email-already-exists') || code.includes('EMAIL_EXISTS')) {
        throw new InputError('Ya hay un local con ese nombre. Prueba una variante.')
      }
      throw error
    })
    ownerUid = userRecord.uid

    await adminAuth.setCustomUserClaims(ownerUid, { mustChangePassword: false })

    await adminDb.collection(COLLECTIONS.users).doc(ownerUid).set({
      email: authEmail,
      contactEmail,
      role: 'company',
      companyId: companyRef.id,
      loginName: name,
      mustChangePassword: false,
      schemaVersion: 1,
      createdAt: now,
    })

    await companyRef.set({
      name,
      slug,
      ownerUid,
      phone,
      website,
      location,
      municipality,
      postalCode,
      country,
      contactEmail,
      latitude,
      longitude,
      description: '',
      logoUrl,
      photos,
      mainPhotoIndex: 0,
      videos: [],
      characteristics,
      venueTypes,
      amenities,
      priceRange: '',
      timeSlotMinutes: 120,
      reservationMode: 'optional',
      schedule: defaultSchedule(),
      planId: plan.planId,
      planBilling: plan.planBilling,
      planStartedAt: plan.markPlanPaid ? now : null,
      planLastPaidAt: plan.markPlanPaid ? now : null,
      stripeBillingCustomerId: plan.stripeBillingCustomerId,
      stripeSubscriptionId: plan.stripeSubscriptionId,
      discoveryFeatured: false,
      schemaVersion: 1,
      createdAt: now,
    })

    await adminDb.collection(COLLECTIONS.companyCredentials).doc(companyRef.id).set({
      loginName: name,
      authEmail,
      ownerUid,
      mustChangePassword: false,
      updatedAt: now,
    })

    await adminDb.collection(COLLECTIONS.logins).doc(slug).set({
      loginName: name,
      authEmail,
      role: 'company',
      companyId: companyRef.id,
    })

    await writeCompanyOps(companyRef.id, {
      emailTemplates: defaultCompanyEmailTemplates(),
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      stripeDetailsSubmitted: false,
    })

    const companySnap = await companyRef.get()
    await syncRestaurantIndex(companyRef.id, companySnap.data())

    return {
      companyId: companyRef.id,
      slug,
      loginName: name,
    }
  } catch (error) {
    if (ownerUid) {
      await adminAuth.deleteUser(ownerUid).catch(() => undefined)
      await adminDb.collection(COLLECTIONS.users).doc(ownerUid).delete().catch(() => undefined)
    }
    await companyRef.delete().catch(() => undefined)
    throw error
  }
}

export async function completePaidCompanySignup(input: CompanySignupProfile & {
  sessionId: string
}): Promise<{ companyId: string; slug: string; loginName: string }> {
  if (!canUseAdminSdk) {
    throw new Error('El alta no está disponible en este servidor.')
  }
  if (!isStripeConfigured()) {
    throw new Error('Stripe no está configurado.')
  }

  const sessionId = asPlainText(input.sessionId, 200, 'La sesión de pago')
  const profile = parseSignupProfile(input)

  const stripe = createStripeClient()
  const session = await stripe.checkout.sessions.retrieve(sessionId)

  if (session.metadata?.type !== SAAS_CHECKOUT_META) {
    throw new InputError('Ese pago no corresponde a un plan de Adelia.')
  }
  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    throw new InputError('Todavía no consta el pago. Espera un momento e inténtalo de nuevo.')
  }

  const planId = parseSaasCheckoutPlanId(session.metadata.planId)
  if (!planId) {
    throw new InputError('El plan pagado no es válido.')
  }

  const leadRef = adminDb.collection(COLLECTIONS.saasSubscriptions).doc(sessionId)
  const leadSnap = await leadRef.get()
  const existingCompanyId = typeof leadSnap.data()?.companyId === 'string'
    ? leadSnap.data()?.companyId as string
    : ''

  if (existingCompanyId) {
    const companySnap = await adminDb.collection(COLLECTIONS.companies).doc(existingCompanyId).get()
    if (companySnap.exists) {
      const data = companySnap.data()!
      return {
        companyId: existingCompanyId,
        slug: String(data.slug ?? ''),
        loginName: String(data.name ?? profile.name),
      }
    }
  }

  const created = await provisionCompanyAccount(profile, {
    planId,
    planBilling: 'monthly',
    stripeBillingCustomerId: typeof session.customer === 'string' ? session.customer : null,
    stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : null,
    markPlanPaid: true,
  })

  await leadRef.set(
    {
      companyId: created.companyId,
      status: 'activated',
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  return created
}

/**
 * Alta de restaurante sin checkout de Stripe.
 *
 * El plan siempre se crea como `free`. El plan de pago (Sala / Local) solo lo
 * concede el webhook de Lemon Squeezy: si el pago llegó antes del alta, quedó
 * en `lemonSqueezyPending/{email}` y aquí se reclama; si llega después, el
 * webhook actualiza la empresa por correo. El `input.plan` del formulario es
 * solo cosmético (copys del asistente), nunca concede plan.
 */
export async function completeFreeCompanySignup(
  input: CompanySignupProfile & { plan?: string },
): Promise<{ companyId: string; slug: string; loginName: string }> {
  if (!canUseAdminSdk) {
    throw new Error('El alta no está disponible en este servidor.')
  }

  const profile = parseSignupProfile(input)
  const created = await provisionCompanyAccount(profile, {
    planId: 'free',
    planBilling: null,
    stripeBillingCustomerId: null,
    stripeSubscriptionId: null,
    markPlanPaid: false,
  })

  await claimPendingLemonPlan(created.companyId, profile.contactEmail).catch((error) => {
    console.error('Lemon Squeezy pending plan claim error:', error)
  })

  return created
}
