import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from '../data/collections.ts'
import {
  clampEnabledMaps,
  parseStoredPlanId,
  planAllowsDeposits,
  planAllowsMenuGrid,
  planAllowsMenuPdf,
  planMaxMenus,
  planMaxPromosOfType,
  planPromoTypes,
  type StoredPlanId,
} from './planLimits.ts'

function hasMenuPdf(data: FirebaseFirestore.DocumentData): boolean {
  return typeof data.pdfUrl === 'string' && data.pdfUrl.trim().length > 0
}

function isMenuCompliant(data: FirebaseFirestore.DocumentData, planId: StoredPlanId): boolean {
  const template = (data.template as Record<string, unknown> | undefined) ?? {}
  if (!planAllowsMenuGrid(planId) && template.layout === 'grid') {
    return false
  }
  if (!planAllowsMenuPdf(planId) && hasMenuPdf(data)) {
    return false
  }
  return true
}

export async function applyPlanFeatureLimits(companyId: string, planId: StoredPlanId): Promise<void> {
  const companyRef = adminDb.collection(COLLECTIONS.companies).doc(companyId)
  const companySnap = await companyRef.get()
  if (!companySnap.exists) {
    return
  }

  const data = companySnap.data() ?? {}
  const floorPlans = Array.isArray(data.floorPlans) ? clampEnabledMaps(data.floorPlans as Array<{ enabled?: unknown }>, planId) : null
  const floorPlan = data.floorPlan && typeof data.floorPlan === 'object'
    ? clampEnabledMaps([data.floorPlan as { enabled?: unknown }], planId)[0]
    : null

  const companyUpdates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  }

  if (!planAllowsDeposits(planId)) {
    companyUpdates.depositEnabled = false
  }
  if (floorPlans) {
    companyUpdates.floorPlans = floorPlans
  }
  if (floorPlan) {
    companyUpdates.floorPlan = floorPlan
  }

  await companyRef.set(companyUpdates, { merge: true })

  const [promosSnap, boardsSnap] = await Promise.all([
    companyRef.collection('promotions').limit(80).get(),
    companyRef.collection('menuBoards').limit(50).get(),
  ])

  if (planId === 'free') {
    const batch = adminDb.batch()
    let writes = 0
    for (const docSnap of promosSnap.docs) {
      if (docSnap.data().active === true) {
        batch.update(docSnap.ref, { active: false, updatedAt: FieldValue.serverTimestamp() })
        writes += 1
      }
    }
    for (const docSnap of boardsSnap.docs) {
      if (docSnap.data().active !== false) {
        batch.update(docSnap.ref, { active: false, updatedAt: FieldValue.serverTimestamp() })
        writes += 1
      }
    }
    if (writes > 0) {
      await batch.commit()
    }
    return
  }

  const promoWrites: FirebaseFirestore.DocumentReference[] = []
  const keptPromoIds = new Set<string>()
  for (const type of planPromoTypes()) {
    const ofType = promosSnap.docs
      .filter((docSnap) => String(docSnap.data().type ?? '') === type)
      .sort((left, right) => {
        const leftAt = left.data().createdAt?.toMillis?.() ?? 0
        const rightAt = right.data().createdAt?.toMillis?.() ?? 0
        return leftAt - rightAt
      })
    const maxPromos = planMaxPromosOfType(planId, type)
    const kept = maxPromos == null ? ofType : ofType.slice(0, maxPromos)
    for (const docSnap of kept) {
      keptPromoIds.add(docSnap.id)
    }
  }

  for (const docSnap of promosSnap.docs) {
    const allowed = keptPromoIds.has(docSnap.id)
    if (docSnap.data().active === true && !allowed) {
      promoWrites.push(docSnap.ref)
    }
  }

  const maxMenus = planMaxMenus(planId)
  const compliantActive = boardsSnap.docs
    .filter((docSnap) => docSnap.data().active !== false && isMenuCompliant(docSnap.data(), planId))
    .sort((left, right) => (left.data().sortOrder ?? 0) - (right.data().sortOrder ?? 0))
  const keptBoardIds = new Set(
    (maxMenus == null ? compliantActive : compliantActive.slice(0, maxMenus)).map((docSnap) => docSnap.id),
  )

  const boardWrites: FirebaseFirestore.DocumentReference[] = []
  for (const docSnap of boardsSnap.docs) {
    const keepActive = keptBoardIds.has(docSnap.id)
    if (docSnap.data().active !== false && !keepActive) {
      boardWrites.push(docSnap.ref)
    }
  }

  const refs = [...promoWrites, ...boardWrites]
  if (refs.length === 0) {
    return
  }

  const batch = adminDb.batch()
  for (const ref of refs) {
    batch.update(ref, { active: false, updatedAt: FieldValue.serverTimestamp() })
  }
  await batch.commit()
}

export async function applyPlanFeatureLimitsIfChanged(
  companyId: string,
  previousPlanId: unknown,
  nextPlanId: unknown,
): Promise<void> {
  const fromId = parseStoredPlanId(previousPlanId)
  const toId = parseStoredPlanId(nextPlanId)
  if (fromId === toId) {
    return
  }

  await applyPlanFeatureLimits(companyId, toId)
}
