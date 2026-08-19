import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
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
import { syncCompanyLoginIndex } from './firestore'
import { restaurantIndexPayload } from './restaurantIndex'

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

  if (!name || !location || !phone || !password) {
    throw new Error('Faltan campos obligatorios.')
  }

  const slug = slugify(name)
  const email = slugToAuthEmail(slug)

  await assertSlugAvailable(slug)

  const ownerUid = await createAuthUser(email, password)
  const companyRef = doc(collection(db, 'companies'))
  const companyId = companyRef.id
  const loginId = slugify(name)
  const now = serverTimestamp()

  const batch = writeBatch(db)

  batch.set(companyRef, {
    name,
    slug,
    ownerUid,
    phone,
    website,
    location,
    timeSlotMinutes: 120,
    schedule: defaultSchedule(),
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

  batch.set(doc(db, 'companyCredentials', companyId), {
    loginName: name,
    authEmail: email,
    ownerUid,
    mustChangePassword: true,
    updatedAt: now,
  })

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
  }))

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
      contactEmail: '',
      logoUrl: '',
      municipality: '',
      country: 'España',
      postalCode: '',
      latitude: null,
      longitude: null,
      description: '',
      photos: [],
      mainPhotoIndex: 0,
      videos: [],
      characteristics: [],
      timeSlotMinutes: 120,
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
  }

  if (payload.name?.trim()) {
    updates.name = payload.name.trim()
    credentialsUpdates.loginName = payload.name.trim()
  }

  if (payload.location?.trim()) {
    updates.location = payload.location.trim()
  }

  if (payload.phone?.trim()) {
    updates.phone = payload.phone.trim()
  }

  if (payload.website !== undefined) {
    updates.website = payload.website.trim()
  }

  if (Object.keys(updates).length > 0) {
    await updateDoc(doc(db, 'companies', companyId), updates)
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
    },
    loginName: nextLoginName,
  }
}

export async function deleteCompany(companyId: string, company: AdminCompany): Promise<void> {
  const batch = writeBatch(db)

  const [reservations, tables] = await Promise.all([
    getDocs(query(collection(db, 'reservations'), where('companyId', '==', companyId))),
    getDocs(query(collection(db, 'tables'), where('companyId', '==', companyId))),
  ])

  reservations.docs.forEach((item) => batch.delete(item.ref))
  tables.docs.forEach((item) => batch.delete(item.ref))

  batch.delete(doc(db, 'companies', companyId))
  batch.delete(doc(db, 'companyCredentials', companyId))
  batch.delete(doc(db, 'users', company.ownerUid))
  batch.delete(doc(db, 'logins', slugify(company.loginName)))
  batch.delete(doc(db, 'restaurantIndex', companyId))
  batch.delete(doc(db, 'companies', companyId, 'private', 'ops'))
  batch.delete(doc(db, 'companies', companyId, 'private', 'promotionPin'))

  await batch.commit()
}
