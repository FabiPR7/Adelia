import { Router, type Request, type Response } from 'express'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { ensureCompanyOwner } from '../auth/verifyRequest.ts'
import {
  normalizeCompanyEmailTemplates,
  normalizeCompanySettingsPayload,
  normalizeQrBrandingConfig,
  parseCompanyQrBranding,
  parseFloorPlan,
  primaryFloorPlan,
  serializeCompanyQrBranding,
  serializeFloorPlanForFirestore,
  serializeFloorPlansForFirestore,
  validateCompanySettingsPayload,
} from '../company/sharedRules.ts'
import { slugify, slugToAuthEmail } from '../../src/utils/helpers.ts'
import type { CompanySettingsPayload } from '../../src/types/index.ts'
import type { CompanyEmailTemplates, FloorPlan, QrBrandingConfig, QrBrandingKind } from '../../src/types/company.ts'

// Ajustes del local desde el panel. Antes el panel los escribía directamente en la base
// de datos; ahora el servidor comprueba que eres el dueño y limpia/valida con las MISMAS
// reglas que la web (server/company/sharedRules.ts).

const router = Router()
type Params = Record<string, string>

const COMPANY_TABLE_LIMIT = 80
const QR_KINDS = new Set<QrBrandingKind>(['booking', 'menu', 'promotion'])

async function writeLoginIndex(loginName: string, authEmail: string, companyId: string) {
  const loginId = slugify(loginName.trim())
  if (!loginId) return
  await adminDb.collection('logins').doc(loginId).set({
    loginName: loginName.trim(),
    authEmail,
    role: 'company',
    companyId,
  })
}

/** Todo lo de «Mi restaurante» (contacto, perfil, reservas y horario, mapas…). */
router.put('/:companyId/settings', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return

    let normalized: CompanySettingsPayload
    try {
      normalized = normalizeCompanySettingsPayload(req.body as CompanySettingsPayload)
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : 'Datos no válidos.' })
      return
    }
    const validationError = validateCompanySettingsPayload(normalized)
    if (validationError) {
      res.status(400).json({ error: validationError })
      return
    }

    const companyRef = adminDb.collection('companies').doc(companyId)
    const [companySnap, credentialsSnap] = await Promise.all([
      companyRef.get(),
      adminDb.collection('companyCredentials').doc(companyId).get(),
    ])
    if (!companySnap.exists) {
      res.status(404).json({ error: 'Restaurante no encontrado.' })
      return
    }

    const trimmedName = normalized.name.trim()
    const currentName = String(companySnap.data()?.name ?? '').trim()
    const nameChanged = trimmedName !== currentName
    const ownerUid = companySnap.data()?.ownerUid as string | undefined
    const authEmail =
      (credentialsSnap.data()?.authEmail as string | undefined)
      ?? slugToAuthEmail(String(companySnap.data()?.slug ?? ''))

    const batch = adminDb.batch()
    batch.update(companyRef, {
      name: trimmedName,
      contactEmail: normalized.contactEmail,
      phone: normalized.phone,
      website: normalized.website,
      location: normalized.location,
      municipality: normalized.municipality,
      country: normalized.country,
      postalCode: normalized.postalCode,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      description: normalized.description,
      logoUrl: normalized.logoUrl,
      photos: normalized.photos,
      mainPhotoIndex: normalized.mainPhotoIndex,
      videos: normalized.videos,
      characteristics: normalized.characteristics,
      venueTypes: normalized.venueTypes,
      amenities: normalized.amenities,
      priceRange: normalized.priceRange,
      timeSlotMinutes: normalized.timeSlotMinutes,
      reservationMode: normalized.reservationMode,
      depositMinPax: normalized.depositMinPax,
      depositPerGuestCents: normalized.depositPerGuestCents,
      depositEnabled: normalized.depositEnabled,
      depositCancellationHours: normalized.depositCancellationHours,
      schedule: normalized.schedule,
      turns: normalized.turns,
      floorPlan: serializeFloorPlanForFirestore(normalized.floorPlan),
      floorPlans: serializeFloorPlansForFirestore(normalized.floorPlans),
      updatedAt: FieldValue.serverTimestamp(),
    })
    if (nameChanged) {
      if (credentialsSnap.exists) {
        batch.update(credentialsSnap.ref, { loginName: trimmedName, updatedAt: FieldValue.serverTimestamp() })
      }
      if (ownerUid) {
        batch.update(adminDb.collection('users').doc(ownerUid), { loginName: trimmedName })
      }
    }
    await batch.commit()
    if (nameChanged && authEmail) {
      await writeLoginIndex(trimmedName, authEmail, companyId)
    }
    res.json({ ok: true })
  } catch (error) {
    console.error('Company settings save error:', error)
    res.status(500).json({ error: 'No se pudieron guardar los ajustes.' })
  }
})

/** Mostrar u ocultar el local en Adelia. */
router.patch('/:companyId/visibility', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const { deactivated } = req.body as { deactivated?: unknown }
    if (typeof deactivated !== 'boolean') {
      res.status(400).json({ error: 'Valor no válido.' })
      return
    }
    const ref = adminDb.collection('companies').doc(companyId)
    const snap = await ref.get()
    if (!deactivated && snap.data()?.deactivatedByAdmin === true) {
      res.status(403).json({ error: 'Adelia ha desactivado este local. Escríbenos para volver a activarlo.' })
      return
    }
    await ref.update({
      deactivated,
      deactivatedAt: deactivated ? FieldValue.serverTimestamp() : null,
      updatedAt: FieldValue.serverTimestamp(),
    })
    res.json({ ok: true })
  } catch (error) {
    console.error('Company visibility error:', error)
    res.status(500).json({ error: 'No se pudo cambiar la visibilidad.' })
  }
})

/** Sustituye la lista de mesas del local. */
router.put('/:companyId/tables', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const raw = (req.body as { tables?: unknown }).tables
    if (!Array.isArray(raw) || raw.length > COMPANY_TABLE_LIMIT) {
      res.status(400).json({ error: 'Lista de mesas no válida.' })
      return
    }
    const tables = raw.map((item, index) => {
      const row = (item ?? {}) as Record<string, unknown>
      const name = typeof row.name === 'string' ? row.name.trim().slice(0, 60) : ''
      const capacity = Math.trunc(Number(row.capacity))
      return {
        id: typeof row.id === 'string' && row.id.trim() ? row.id.trim() : null,
        name: name || `Mesa ${index + 1}`,
        capacity,
        floorPlanId: typeof row.floorPlanId === 'string' ? row.floorPlanId.trim().slice(0, 80) : '',
      }
    })
    if (tables.some((table) => !Number.isFinite(table.capacity) || table.capacity < 1 || table.capacity > 99)) {
      res.status(400).json({ error: 'Cada mesa necesita entre 1 y 99 plazas.' })
      return
    }

    const existing = await adminDb.collection('tables').where('companyId', '==', companyId).limit(COMPANY_TABLE_LIMIT).get()
    const existingIds = new Set(existing.docs.map((item) => item.id))
    // Solo se puede reutilizar un id si ya era una mesa de este local.
    for (const table of tables) {
      if (table.id && !existingIds.has(table.id)) {
        const other = await adminDb.collection('tables').doc(table.id).get()
        if (other.exists) table.id = null
      }
    }

    const batch = adminDb.batch()
    existing.docs.forEach((item) => batch.delete(item.ref))
    tables.forEach((table, index) => {
      const ref = table.id ? adminDb.collection('tables').doc(table.id) : adminDb.collection('tables').doc()
      batch.set(ref, {
        companyId,
        name: table.name,
        capacity: table.capacity,
        sortOrder: index,
        floorPlanId: table.floorPlanId,
      })
    })
    await batch.commit()
    res.json({ ok: true })
  } catch (error) {
    console.error('Company tables save error:', error)
    res.status(500).json({ error: 'No se pudieron guardar las mesas.' })
  }
})

/** Mapas del local (editor de mapas). */
router.put('/:companyId/floor-plans', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const raw = (req.body as { floorPlans?: unknown }).floorPlans
    if (!Array.isArray(raw) || raw.length > 40) {
      res.status(400).json({ error: 'Mapas no válidos.' })
      return
    }
    const plans: FloorPlan[] = raw.length > 0 ? raw.map((item) => parseFloorPlan(item)) : [parseFloorPlan(undefined)]
    await adminDb.collection('companies').doc(companyId).update({
      floorPlan: serializeFloorPlanForFirestore(primaryFloorPlan(plans)),
      floorPlans: serializeFloorPlansForFirestore(plans),
      updatedAt: FieldValue.serverTimestamp(),
    })
    res.json({ ok: true })
  } catch (error) {
    console.error('Company floor plans save error:', error)
    res.status(500).json({ error: 'No se pudieron guardar los mapas.' })
  }
})

/** Plantillas de los correos al cliente. */
router.put('/:companyId/email-templates', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const templates = (req.body as { templates?: unknown }).templates
    if (!templates || typeof templates !== 'object') {
      res.status(400).json({ error: 'Plantillas no válidas.' })
      return
    }
    const normalized = normalizeCompanyEmailTemplates(templates as CompanyEmailTemplates)
    await adminDb.collection('companies').doc(companyId).collection('private').doc('ops').set(
      { emailTemplates: normalized, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
    res.json({ ok: true })
  } catch (error) {
    console.error('Company email templates save error:', error)
    res.status(500).json({ error: 'No se pudo guardar la plantilla.' })
  }
})

/** Diseño del QR (de reservas o de carta). */
router.put('/:companyId/qr-branding', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const { kind, config } = req.body as { kind?: unknown; config?: unknown }
    if (typeof kind !== 'string' || !QR_KINDS.has(kind as QrBrandingKind) || !config || typeof config !== 'object') {
      res.status(400).json({ error: 'Diseño de QR no válido.' })
      return
    }
    const ref = adminDb.collection('companies').doc(companyId)
    const snap = await ref.get()
    const current = parseCompanyQrBranding(snap.data()?.qrBranding)
    await ref.update({
      qrBranding: serializeCompanyQrBranding({
        ...current,
        [kind]: normalizeQrBrandingConfig(config as QrBrandingConfig),
      }),
      updatedAt: FieldValue.serverTimestamp(),
    })
    res.json({ ok: true })
  } catch (error) {
    console.error('Company QR branding save error:', error)
    res.status(500).json({ error: 'No se pudo guardar el diseño del QR.' })
  }
})

/** Repara el índice de inicio de sesión del local (lo usaba el panel al abrir). */
router.post('/:companyId/login-index', async (req: Request<Params>, res: Response) => {
  try {
    const { companyId } = req.params
    if (!(await ensureCompanyOwner(req, res, companyId))) return
    const [credentialsSnap, companySnap] = await Promise.all([
      adminDb.collection('companyCredentials').doc(companyId).get(),
      adminDb.collection('companies').doc(companyId).get(),
    ])
    if (!credentialsSnap.exists || !companySnap.exists) {
      res.json({ ok: true })
      return
    }
    const loginName = (credentialsSnap.data()?.loginName as string | undefined) ?? (companySnap.data()?.name as string | undefined)
    const authEmail = (credentialsSnap.data()?.authEmail as string | undefined) ?? slugToAuthEmail(String(companySnap.data()?.slug ?? ''))
    if (loginName && authEmail) {
      // Por seguridad, nunca debe quedar una contraseña guardada en claro.
      if ('loginPassword' in (credentialsSnap.data() ?? {}) || 'password' in (credentialsSnap.data() ?? {})) {
        await credentialsSnap.ref.update({ loginPassword: FieldValue.delete(), password: FieldValue.delete() })
      }
      await writeLoginIndex(loginName, authEmail, companyId)
    }
    res.json({ ok: true, at: Timestamp.now().toMillis() })
  } catch (error) {
    console.error('Company login index error:', error)
    res.status(500).json({ error: 'No se pudo actualizar el acceso.' })
  }
})

export default router
