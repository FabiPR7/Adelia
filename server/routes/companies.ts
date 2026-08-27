import { Router, type Request, type Response } from 'express'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb, canUseAdminSdk } from '../firebase-admin.ts'
import {
  createAuthUserWithRest,
  setFirestoreDocWithRest,
} from '../rest-firebase.ts'
import { defaultSchedule, mapCompanyDoc, slugToAuthEmail, slugify, companySubscriptionFields } from '../utils.ts'
import { syncRestaurantIndex } from '../data/restaurantIndex.ts'
import { writeCompanyOps } from '../data/companyOps.ts'
import { defaultCompanyEmailTemplates } from '../email/emailTemplateDefaults.ts'
import { applyPlanFeatureLimitsIfChanged } from '../company/enforcePlanLimits.ts'

const router = Router()

function getAdminToken(req: Request) {
  return req.headers.authorization?.slice(7) ?? ''
}

async function syncLoginIndex(loginName: string, authEmail: string, role: string, companyId?: string) {
  const loginId = slugify(loginName)

  await adminDb.collection('logins').doc(loginId).set({
    loginName,
    authEmail,
    role,
    ...(companyId ? { companyId } : {}),
  })
}

async function removeLoginIndex(loginName: string) {
  await adminDb.collection('logins').doc(slugify(loginName)).delete()
}

async function deleteCompanyData(companyId: string, loginName: string) {
  const batch = adminDb.batch()

  const reservations = await adminDb
    .collection('reservations')
    .where('companyId', '==', companyId)
    .get()

  reservations.docs.forEach((docSnap) => batch.delete(docSnap.ref))

  const tables = await adminDb
    .collection('tables')
    .where('companyId', '==', companyId)
    .get()

  tables.docs.forEach((docSnap) => batch.delete(docSnap.ref))

  batch.delete(adminDb.collection('companies').doc(companyId))
  batch.delete(adminDb.collection('companyCredentials').doc(companyId))
  batch.delete(adminDb.collection('restaurantIndex').doc(companyId))
  batch.delete(adminDb.collection('companies').doc(companyId).collection('private').doc('ops'))
  batch.delete(adminDb.collection('companies').doc(companyId).collection('private').doc('promotionPin'))

  await batch.commit()
  await removeLoginIndex(loginName)
}

async function markMustChangePassword(ownerUid: string, companyId: string) {
  await adminAuth.setCustomUserClaims(ownerUid, { mustChangePassword: true })
  await adminDb.collection('users').doc(ownerUid).set(
    { mustChangePassword: true },
    { merge: true },
  )
  await adminDb.collection('companyCredentials').doc(companyId).set(
    {
      mustChangePassword: true,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  )
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      location,
      phone,
      website,
      password,
      planId,
      planBilling,
      planStartedAt,
      municipality,
      postalCode,
      country,
      contactEmail,
      discoveryFeatured,
    } = req.body

    if (!name || !location || !phone || !password) {
      res.status(400).json({ error: 'Faltan campos obligatorios.' })
      return
    }

    const slug = slugify(name)
    const email = slugToAuthEmail(slug)

    if (canUseAdminSdk) {
      const slugConflict = await adminDb
        .collection('companies')
        .where('slug', '==', slug)
        .get()

      if (!slugConflict.empty) {
        res.status(409).json({ error: 'Ya existe una empresa con ese nombre.' })
        return
      }

      const companyRef = adminDb.collection('companies').doc()
      const userRecord = await adminAuth.createUser({
        email,
        password,
        displayName: name,
      })

      await adminAuth.setCustomUserClaims(userRecord.uid, {
        mustChangePassword: true,
      })

      const now = Timestamp.now()
      const subscription = companySubscriptionFields({
        currentPlanId: 'free',
        hasStartedAt: false,
        nextPlanId: planId,
        nextBilling: planBilling,
        nextStartedAt: planStartedAt,
      })

      await adminDb.collection('users').doc(userRecord.uid).set({
        email,
        role: 'company',
        companyId: companyRef.id,
        loginName: name,
        mustChangePassword: true,
        createdAt: now,
      })

      await companyRef.set({
        name,
        slug,
        ownerUid: userRecord.uid,
        phone,
        website: website ?? '',
        location,
        municipality: typeof municipality === 'string' ? municipality.trim() : '',
        postalCode: typeof postalCode === 'string' ? postalCode.trim() : '',
        country: typeof country === 'string' && country.trim() ? country.trim() : 'España',
        contactEmail: typeof contactEmail === 'string' ? contactEmail.trim() : '',
        discoveryFeatured: discoveryFeatured === true,
        timeSlotMinutes: 120,
        reservationMode: 'optional',
        schedule: defaultSchedule(),
        planId: subscription.planId,
        planBilling: subscription.planBilling,
        ...(subscription.planStartedAt instanceof Date
          ? { planStartedAt: Timestamp.fromDate(subscription.planStartedAt) }
          : subscription.planStartedAt === 'now'
            ? { planStartedAt: now }
            : {}),
        createdAt: now,
      })

      await adminDb.collection('companyCredentials').doc(companyRef.id).set({
        loginName: name,
        authEmail: email,
        ownerUid: userRecord.uid,
        mustChangePassword: true,
        updatedAt: now,
      })

      await syncLoginIndex(name, email, 'company', companyRef.id)
      await markMustChangePassword(userRecord.uid, companyRef.id)
      await writeCompanyOps(companyRef.id, {
        emailTemplates: defaultCompanyEmailTemplates(),
        stripeAccountId: null,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
        stripeDetailsSubmitted: false,
      })
      await syncRestaurantIndex(companyRef.id, {
        name,
        slug,
        location,
        municipality: typeof municipality === 'string' ? municipality.trim() : '',
        postalCode: typeof postalCode === 'string' ? postalCode.trim() : '',
        country: typeof country === 'string' && country.trim() ? country.trim() : 'España',
        phone,
        website: website ?? '',
        discoveryFeatured: discoveryFeatured === true,
      })

      const snapshot = await companyRef.get()

      res.status(201).json({
        company: mapCompanyDoc(snapshot.id, snapshot.data()!),
        loginName: name,
        password,
      })
      return
    }

    const adminToken = getAdminToken(req)

    if (!adminToken) {
      res.status(401).json({ error: 'No autorizado.' })
      return
    }

    const userRecord = await createAuthUserWithRest(email, password)
    const companyId = `comp_${slug}_${Date.now()}`
    const now = new Date()
    const subscription = companySubscriptionFields({
      currentPlanId: 'free',
      hasStartedAt: false,
      nextPlanId: planId,
      nextBilling: planBilling,
      nextStartedAt: planStartedAt,
    })

    await setFirestoreDocWithRest(adminToken, `users/${userRecord.uid}`, {
      email,
      role: 'company',
      companyId,
      loginName: name,
      mustChangePassword: true,
      createdAt: now,
    })

    await setFirestoreDocWithRest(adminToken, `companies/${companyId}`, {
      name,
      slug,
      ownerUid: userRecord.uid,
      phone,
      website: website ?? '',
      location,
      timeSlotMinutes: 120,
      reservationMode: 'optional',
      schedule: defaultSchedule(),
      planId: subscription.planId,
      planBilling: subscription.planBilling,
      ...(subscription.planStartedAt instanceof Date
        ? { planStartedAt: subscription.planStartedAt }
        : subscription.planStartedAt === 'now'
          ? { planStartedAt: now }
          : {}),
      createdAt: now,
    })

    await setFirestoreDocWithRest(adminToken, `companyCredentials/${companyId}`, {
      loginName: name,
      authEmail: email,
      ownerUid: userRecord.uid,
      mustChangePassword: true,
      updatedAt: now,
    })

    await setFirestoreDocWithRest(adminToken, `logins/${slug}`, {
      loginName: name,
      authEmail: email,
      role: 'company',
    })
    await setFirestoreDocWithRest(adminToken, `companies/${companyId}/private/ops`, {
      emailTemplates: defaultCompanyEmailTemplates(),
      stripeAccountId: null,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      stripeDetailsSubmitted: false,
      updatedAt: now,
    })
    await setFirestoreDocWithRest(adminToken, `restaurantIndex/${companyId}`, {
      companyId,
      name,
      slug,
      location,
      hasProfile: false,
      updatedAt: now,
    })

    res.status(201).json({
      company: {
        id: companyId,
        name,
        slug,
        ownerUid: userRecord.uid,
        phone,
        website: website ?? '',
        location,
        timeSlotMinutes: 120,
        reservationMode: 'optional',
        schedule: defaultSchedule(),
        createdAt: now.toISOString(),
      },
      loginName: name,
      password,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error creando empresa.'
    res.status(500).json({ error: message })
  }
})

router.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!canUseAdminSdk) {
      res.status(503).json({
        error:
          'Editar empresas requiere serviceAccountKey.json en la raíz del proyecto.',
      })
      return
    }

    const { id } = req.params
    const {
      name,
      location,
      phone,
      website,
      password,
      planId,
      planBilling,
      planStartedAt,
      municipality,
      postalCode,
      country,
      contactEmail,
      discoveryFeatured,
      planLastPaidAt,
    } = req.body

    const companyRef = adminDb.collection('companies').doc(id)
    const companySnap = await companyRef.get()

    if (!companySnap.exists) {
      res.status(404).json({ error: 'Empresa no encontrada.' })
      return
    }

    const companyData = companySnap.data()!
    const credentialsSnap = await adminDb.collection('companyCredentials').doc(id).get()
    const previousLoginName =
      (credentialsSnap.data()?.loginName as string) ?? (companyData.name as string)

    const updates: Record<string, unknown> = {}

    if (name) {
      updates.name = name
      updates.slug = slugify(name)
    }
    if (location) updates.location = location
    if (phone) updates.phone = phone
    if (website !== undefined) updates.website = website
    if (municipality !== undefined) updates.municipality = String(municipality).trim()
    if (postalCode !== undefined) updates.postalCode = String(postalCode).trim()
    if (country !== undefined) updates.country = String(country).trim() || 'España'
    if (contactEmail !== undefined) updates.contactEmail = String(contactEmail).trim()
    if (discoveryFeatured !== undefined) updates.discoveryFeatured = discoveryFeatured === true
    if (planLastPaidAt === 'clear') {
      updates.planLastPaidAt = FieldValue.delete()
    } else if (planLastPaidAt === 'now') {
      updates.planLastPaidAt = Timestamp.now()
    }

    const subscription = companySubscriptionFields({
      currentPlanId: companyData.planId,
      hasStartedAt: Boolean(companyData.planStartedAt),
      nextPlanId: planId ?? companyData.planId,
      nextBilling: planBilling ?? companyData.planBilling,
      nextStartedAt: planStartedAt,
    })
    updates.planId = subscription.planId
    updates.planBilling = subscription.planBilling
    if (subscription.planStartedAt === 'clear') {
      updates.planStartedAt = FieldValue.delete()
    } else if (subscription.planStartedAt instanceof Date) {
      updates.planStartedAt = Timestamp.fromDate(subscription.planStartedAt)
    } else if (subscription.planStartedAt === 'now') {
      updates.planStartedAt = Timestamp.now()
    }

    if (Object.keys(updates).length > 0) {
      await companyRef.update(updates)
    }

    if (subscription.planId !== companyData.planId) {
      await applyPlanFeatureLimitsIfChanged(id, companyData.planId, subscription.planId)
    }

    const nextLoginName = (updates.name as string) ?? (companyData.name as string)
    const credentialsUpdate: Record<string, unknown> = {
      loginName: nextLoginName,
      updatedAt: Timestamp.now(),
    }

    if (password) {
      const ownerUid = companyData.ownerUid as string
      await adminAuth.updateUser(ownerUid, { password })
      credentialsUpdate.loginPassword = FieldValue.delete()
      credentialsUpdate.mustChangePassword = true
      await markMustChangePassword(ownerUid, id)
    }

    await adminDb
      .collection('companyCredentials')
      .doc(id)
      .set(credentialsUpdate, { merge: true })

    if (previousLoginName !== nextLoginName) {
      await removeLoginIndex(previousLoginName)
      const authEmail =
        (credentialsSnap.data()?.authEmail as string) ??
        slugToAuthEmail((updates.slug as string | undefined) ?? (companyData.slug as string))
      await syncLoginIndex(nextLoginName, authEmail, 'company', id)
      await adminDb.collection('users').doc(companyData.ownerUid as string).set(
        { loginName: nextLoginName },
        { merge: true },
      )
    }

    const updatedSnap = await companyRef.get()
    await syncRestaurantIndex(id, updatedSnap.data())

    res.json({
      company: mapCompanyDoc(updatedSnap.id, updatedSnap.data()!),
      loginName: nextLoginName,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error actualizando empresa.'
    res.status(500).json({ error: message })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!canUseAdminSdk) {
      res.status(503).json({
        error:
          'Eliminar empresas requiere serviceAccountKey.json en la raíz del proyecto.',
      })
      return
    }

    const { id } = req.params
    const companyRef = adminDb.collection('companies').doc(id)
    const companySnap = await companyRef.get()

    if (!companySnap.exists) {
      res.status(404).json({ error: 'Empresa no encontrada.' })
      return
    }

    const companyData = companySnap.data()!
    const ownerUid = companyData.ownerUid as string

    const credentialsSnap = await adminDb.collection('companyCredentials').doc(id).get()
    const loginName =
      (credentialsSnap.data()?.loginName as string) ?? (companyData.name as string)

    await deleteCompanyData(id, loginName)
    await adminDb.collection('users').doc(ownerUid).delete()

    try {
      await adminAuth.deleteUser(ownerUid)
    } catch {
      // Usuario de auth ya eliminado
    }

    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error eliminando empresa.'
    res.status(500).json({ error: message })
  }
})

export default router
