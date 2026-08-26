import {
  collection,
  deleteField,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import type {
  AdminCompany,
  Company,
  CreateCompanyPayload,
  UpdateCompanyPayload,
} from '../types'
import { defaultTurns, parseFloorPlans, withFloorPlans, defaultCompanyEmailTemplates } from '../types/company'
import { defaultCompanyQrBranding } from '../utils/qrBranding'
import { defaultSchedule, slugify, slugToAuthEmail } from '../utils/helpers'
import { nextCompanySubscription, parseCompanyPlanId } from '../data/companyPlans'
import { syncCompanyLoginIndex } from './firestore'
import { restaurantIndexPayload } from './restaurantIndex'
import { requireAuthPassword } from '../utils/passwordValidation'
import { assertNoSecretFields } from '../utils/secretFields'

const AUTH_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY

async function createAuthUser(email: string, password: string): Promise<string> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${AUTH_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )

  const data = (await response.json()) as {
    localId?: string
    error?: { message?: string }
  }

  if (!response.ok || !data.localId) {
    const message = data.error?.message ?? ''

    if (message.includes('EMAIL_EXISTS')) {
      throw new Error('Ya existe una empresa con ese nombre.')
    }

    throw new Error(message || 'No se pudo crear la cuenta de acceso de la empresa.')
  }

  return data.localId
}

async function assertSlugAvailable(slug: string) {
  const snapshot = await getDocs(query(collection(db, 'companies'), where('slug', '==', slug)))

  if (!snapshot.empty) {
    throw new Error('Ya existe una empresa con ese nombre.')
  }
}

export async function createCompany(payload: CreateCompanyPayload): Promise<{
  company: Company
  loginName: string
  password: string
}> {
  const name = payload.name.trim()
  const location = payload.location.trim()
  const phone = payload.phone.trim()
  const website = payload.website?.trim() ?? ''
  const password = payload.password
  const municipality = payload.municipality?.trim() ?? ''
  const postalCode = payload.postalCode?.trim() ?? ''
  const country = payload.country?.trim() || 'España'
  const contactEmail = payload.contactEmail?.trim() ?? ''

  if (!name || !location || !phone || !password) {
    throw new Error('Faltan campos obligatorios.')
  }

  requireAuthPassword(password)

  const slug = slugify(name)
  const email = slugToAuthEmail(slug)

  await assertSlugAvailable(slug)

  const ownerUid = await createAuthUser(email, password)
  const companyRef = doc(collection(db, 'companies'))
  const companyId = companyRef.id
  const loginId = slugify(name)
  const now = serverTimestamp()
  const subscription = nextCompanySubscription({
    currentPlanId: 'free',
    currentStartedAt: null,
    nextPlanId: payload.planId,
    nextBilling: payload.planBilling,
    nextStartedAt: payload.planStartedAt,
  })
  const startedAtWrite =
    subscription.planStartedAt instanceof Date
      ? Timestamp.fromDate(subscription.planStartedAt)
      : subscription.planStartedAt === 'now'
        ? now
        : undefined

  const batch = writeBatch(db)

  batch.set(companyRef, {
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
        timeSlotMinutes: 120,
        reservationMode: 'optional',
        schedule: defaultSchedule(),
    planId: subscription.planId,
    planBilling: subscription.planBilling,
    ...(startedAtWrite ? { planStartedAt: startedAtWrite } : {}),
    discoveryFeatured: payload.discoveryFeatured === true,
    createdAt: now,
  })

  batch.set(doc(db, 'users', ownerUid), {
    email,
    role: 'company',
    companyId,
    loginName: name,
    mustChangePassword: true,
    createdAt: now,
  })

  const credentialsPayload = {
    loginName: name,
    authEmail: email,
    ownerUid,
    mustChangePassword: true,
    updatedAt: now,
  }
  assertNoSecretFields(credentialsPayload, 'companyCredentials')
  batch.set(doc(db, 'companyCredentials', companyId), credentialsPayload)

  batch.set(doc(db, 'logins', loginId), {
    loginName: name,
    authEmail: email,
    role: 'company',
    companyId,
  })

  batch.set(doc(db, 'companies', companyId, 'private', 'ops'), {
    emailTemplates: defaultCompanyEmailTemplates(),
    stripeAccountId: null,
    stripeChargesEnabled: false,
    stripePayoutsEnabled: false,
    stripeDetailsSubmitted: false,
    updatedAt: now,
  })

  batch.set(doc(db, 'restaurantIndex', companyId), restaurantIndexPayload({
    id: companyId,
    name,
    slug,
    location,
    municipality,
    country,
    postalCode,
    discoveryFeatured: payload.discoveryFeatured === true,
  }, { persistFeatured: true }))

  await batch.commit()

  return {
    company: {
      id: companyId,
      name,
      slug,
      ownerUid,
      phone,
      website,
      location,
      contactEmail,
      logoUrl: '',
      municipality,
      country,
      postalCode,
      latitude: null,
      longitude: null,
      description: '',
      photos: [],
      mainPhotoIndex: 0,
      videos: [],
      characteristics: [],
      venueTypes: [],
      amenities: [],
      priceRange: '',
      timeSlotMinutes: 120,
      reservationMode: 'optional',
      depositMinPax: null,
      depositPerGuestCents: null,
      depositEnabled: false,
      depositCancellationHours: null,
      schedule: defaultSchedule(),
      turns: defaultTurns(),
      ...withFloorPlans(parseFloorPlans(undefined)),
      emailTemplates: defaultCompanyEmailTemplates(),
      qrBranding: defaultCompanyQrBranding(),
      reviewCount: 0,
      reviewRatingSum: 0,
      reviewAdelinas: 0,
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      stripeDetailsSubmitted: false,
      planId: subscription.planId,
      planBilling: subscription.planBilling,
      planStartedAt:
        subscription.planStartedAt instanceof Date
          ? subscription.planStartedAt
          : subscription.planStartedAt === 'now'
            ? new Date()
            : null,
      planLastPaidAt: null,
      discoveryFeatured: payload.discoveryFeatured === true,
      createdAt: new Date(),
    },
    loginName: name,
    password,
  }
}

export async function updateCompany(
  companyId: string,
  company: AdminCompany,
  payload: UpdateCompanyPayload,
): Promise<{ company: Company; loginName: string; password?: string }> {
  const updates: Record<string, unknown> = {}
  const credentialsUpdates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    loginPassword: deleteField(),
    password: deleteField(),
  }

  if (payload.name?.trim()) {
    updates.name = payload.name.trim()
    credentialsUpdates.loginName = payload.name.trim()
  }

  if (payload.location?.trim()) {
    updates.location = payload.location.trim()
  }

  if (payload.phone !== undefined) {
    updates.phone = payload.phone.trim()
  }

  if (payload.website !== undefined) {
    updates.website = payload.website.trim()
  }

  if (payload.contactEmail !== undefined) {
    updates.contactEmail = payload.contactEmail.trim()
  }

  if (payload.municipality !== undefined) {
    updates.municipality = payload.municipality.trim()
  }

  if (payload.postalCode !== undefined) {
    updates.postalCode = payload.postalCode.trim()
  }

  if (payload.country !== undefined) {
    updates.country = payload.country.trim()
  }

  const subscription = nextCompanySubscription({
    currentPlanId: parseCompanyPlanId(company.planId),
    currentBilling: company.planBilling,
    currentStartedAt: company.planStartedAt,
    nextPlanId: payload.planId ?? company.planId,
    nextBilling: payload.planBilling,
    nextStartedAt: payload.planStartedAt,
  })
  updates.planId = subscription.planId
  updates.planBilling = subscription.planBilling
  if (subscription.planStartedAt === 'clear') {
    updates.planStartedAt = deleteField()
  } else if (subscription.planStartedAt instanceof Date) {
    updates.planStartedAt = Timestamp.fromDate(subscription.planStartedAt)
  } else if (subscription.planStartedAt === 'now') {
    updates.planStartedAt = serverTimestamp()
  }

  if (subscription.planId === 'free' || payload.planLastPaidAt === 'clear') {
    updates.planLastPaidAt = deleteField()
  } else if (payload.planLastPaidAt === 'now') {
    updates.planLastPaidAt = serverTimestamp()
  } else if (payload.planLastPaidAt instanceof Date) {
    updates.planLastPaidAt = Timestamp.fromDate(payload.planLastPaidAt)
  }

  if (payload.discoveryFeatured !== undefined) {
    updates.discoveryFeatured = payload.discoveryFeatured
  }

  if (Object.keys(updates).length > 0) {
    await updateDoc(doc(db, 'companies', companyId), updates)
    await setDoc(
      doc(db, 'restaurantIndex', companyId),
      restaurantIndexPayload({
        id: companyId,
        name: (updates.name as string) ?? company.name,
        slug: company.slug,
        location: (updates.location as string) ?? company.location,
        municipality: (updates.municipality as string) ?? company.municipality,
        country: (updates.country as string) ?? company.country,
        postalCode: (updates.postalCode as string) ?? company.postalCode,
        latitude: company.latitude,
        longitude: company.longitude,
        logoUrl: company.logoUrl,
        photos: company.photos,
        videos: company.videos,
        characteristics: company.characteristics,
        venueTypes: company.venueTypes,
        amenities: company.amenities,
        priceRange: company.priceRange,
        description: company.description,
        reviewCount: company.reviewCount,
        reviewRatingSum: company.reviewRatingSum,
        reviewAdelinas: company.reviewAdelinas,
        discoveryFeatured:
          payload.discoveryFeatured !== undefined
            ? payload.discoveryFeatured
            : company.discoveryFeatured,
      }, { persistFeatured: true }),
      { merge: true },
    )
  }

  const nextLoginName = (payload.name?.trim() || company.loginName).trim()

  if (payload.password?.trim()) {
    throw new Error(
      'Cambiar la contraseña de una empresa desde aquí requiere la API en local. Crea una contraseña nueva al registrar la empresa o pide al restaurante que la cambie al entrar.',
    )
  }

  if (Object.keys(credentialsUpdates).length > 1) {
    await updateDoc(doc(db, 'companyCredentials', companyId), credentialsUpdates)
  }

  const authEmail =
    (await getDoc(doc(db, 'companyCredentials', companyId))).data()?.authEmail as string | undefined ??
    slugToAuthEmail(company.slug)

  if (payload.name?.trim()) {
    await syncCompanyLoginIndex(nextLoginName, authEmail, companyId)

    if (slugify(company.loginName) !== slugify(nextLoginName)) {
      await updateDoc(doc(db, 'users', company.ownerUid), {
        loginName: nextLoginName,
      })
    }
  }

  return {
    company: {
      ...company,
      ...updates,
      name: (updates.name as string) ?? company.name,
      slug: (updates.slug as string) ?? company.slug,
      location: (updates.location as string) ?? company.location,
      phone: (updates.phone as string) ?? company.phone,
      website: (updates.website as string) ?? company.website,
      contactEmail: (updates.contactEmail as string) ?? company.contactEmail,
      municipality: (updates.municipality as string) ?? company.municipality,
      postalCode: (updates.postalCode as string) ?? company.postalCode,
      country: (updates.country as string) ?? company.country,
      planId: subscription.planId,
      planBilling: subscription.planBilling,
      planStartedAt:
        subscription.planStartedAt === 'clear'
          ? null
          : subscription.planStartedAt instanceof Date
            ? subscription.planStartedAt
            : subscription.planStartedAt === 'now'
              ? new Date()
              : company.planStartedAt,
      planLastPaidAt:
        subscription.planId === 'free' || payload.planLastPaidAt === 'clear'
          ? null
          : payload.planLastPaidAt === 'now'
            ? new Date()
            : payload.planLastPaidAt instanceof Date
              ? payload.planLastPaidAt
              : company.planLastPaidAt,
      discoveryFeatured:
        payload.discoveryFeatured !== undefined
          ? payload.discoveryFeatured
          : company.discoveryFeatured,
    },
    loginName: nextLoginName,
  }
}

export async function deleteCompany(companyId: string, company: AdminCompany): Promise<void> {
  async function deleteMatching(collectionName: string) {
    for (;;) {
      const snapshot = await getDocs(
        query(collection(db, collectionName), where('companyId', '==', companyId), limit(400)),
      )
      if (snapshot.empty) {
        break
      }
      const chunk = writeBatch(db)
      snapshot.docs.forEach((item) => chunk.delete(item.ref))
      await chunk.commit()
      if (snapshot.size < 400) {
        break
      }
    }
  }

  await deleteMatching('reservations')
  await deleteMatching('tables')

  const batch = writeBatch(db)
  batch.delete(doc(db, 'companies', companyId))
  batch.delete(doc(db, 'companyCredentials', companyId))
  batch.delete(doc(db, 'users', company.ownerUid))
  batch.delete(doc(db, 'logins', slugify(company.loginName)))
  batch.delete(doc(db, 'restaurantIndex', companyId))
  batch.delete(doc(db, 'companies', companyId, 'private', 'ops'))
  batch.delete(doc(db, 'companies', companyId, 'private', 'promotionPin'))
  await batch.commit()
}

export async function countCompanyMenuBoards(companyId: string): Promise<number> {
  try {
    const snap = await getCountFromServer(collection(db, 'companies', companyId, 'menuBoards'))
    return snap.data().count
  } catch {
    return 0
  }
}
