import { Router, type Request, type Response } from 'express'
import { verifyCompanyAccount } from '../auth/verifyRequest.ts'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from '../data/collections.ts'
import { readCompanyGamificationState } from '../gamification/companyProgress.ts'
import { getCompanyLevelForXp } from '../gamification/companyCatalog.ts'
import { companyGamificationRef } from '../notifications/companyNotifications.ts'
import {
  companyGamificationPayload,
  syncCompanyGamificationDoc,
} from '../gamification/syncCompany.ts'

const router = Router()

router.post('/gamification/sync', async (req: Request, res: Response) => {
  try {
    const account = await verifyCompanyAccount(req)
    const payload = await syncCompanyGamificationDoc(account.companyId)
    res.json(payload)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar Compite.'
    res.status(message.includes('sesión') ? 401 : 500).json({ error: message })
  }
})

router.get('/gamification', async (req: Request, res: Response) => {
  try {
    const account = await verifyCompanyAccount(req)
    const statsSnap = await companyGamificationRef(account.companyId).get()
    const state = readCompanyGamificationState(statsSnap.data()?.state as Record<string, unknown> | undefined)
    res.json(companyGamificationPayload(state))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar Compite.'
    res.status(message.includes('sesión') ? 401 : 500).json({ error: message })
  }
})

router.get('/gamification/ranking', async (req: Request, res: Response) => {
  try {
    const account = await verifyCompanyAccount(req)
    const statsRef = companyGamificationRef(account.companyId)
    const [selfSnap, companySnap] = await Promise.all([
      statsRef.get(),
      adminDb.collection(COLLECTIONS.companies).doc(account.companyId).get(),
    ])

    let worldDocs: FirebaseFirestore.QueryDocumentSnapshot[] = []
    try {
      const worldSnap = await adminDb.collection(COLLECTIONS.companyGamification).orderBy('xp', 'desc').limit(80).get()
      worldDocs = worldSnap.docs
    } catch (rankingError) {
      const rankingMessage = rankingError instanceof Error ? rankingError.message : ''
      if (!rankingMessage.includes('FAILED_PRECONDITION') && !rankingMessage.includes('index')) {
        throw rankingError
      }
    }

    const company = companySnap.data() ?? {}
    const selfMunicipality = String(selfSnap.data()?.municipality ?? company.municipality ?? '').trim()
    const selfCountry = String(selfSnap.data()?.country ?? company.country ?? 'España').trim() || 'España'

    const mapEntry = (
      companyId: string,
      data: FirebaseFirestore.DocumentData,
      isYou: boolean,
    ) => ({
      companyId,
      name: String(data.name ?? 'Restaurante'),
      slug: String(data.slug ?? ''),
      logoUrl: String(data.logoUrl ?? ''),
      municipality: String(data.municipality ?? ''),
      country: String(data.country ?? 'España'),
      xp: typeof data.xp === 'number' ? data.xp : 0,
      level: typeof data.level === 'number' ? data.level : getCompanyLevelForXp(typeof data.xp === 'number' ? data.xp : 0).level,
      levelTitle: String(data.levelTitle ?? getCompanyLevelForXp(typeof data.xp === 'number' ? data.xp : 0).title),
      reviewAdelinas: typeof data.reviewAdelinas === 'number' ? data.reviewAdelinas : 0,
      reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : 0,
      averageRating: typeof data.averageRating === 'number' ? data.averageRating : 0,
      isYou,
    })

    const worldRaw = worldDocs.map((docSnap) => mapEntry(docSnap.id, docSnap.data(), docSnap.id === account.companyId))
    if (!worldRaw.some((entry) => entry.isYou) && selfSnap.exists) {
      worldRaw.push(mapEntry(account.companyId, selfSnap.data()!, true))
      worldRaw.sort((left, right) => right.xp - left.xp)
    }

    const rankedWorld = worldRaw.map((entry, index) => ({ ...entry, rank: index + 1 }))
    const worldRank = rankedWorld.find((entry) => entry.isYou)?.rank ?? 1
    const worldTop = rankedWorld.slice(0, 40)
    const selfWorld = rankedWorld.find((entry) => entry.isYou)
    const world = selfWorld && !worldTop.some((entry) => entry.isYou)
      ? [...worldTop, selfWorld]
      : worldTop

    const localPool = worldRaw.filter((entry) => {
      if (selfMunicipality) {
        return entry.municipality.trim().toLowerCase() === selfMunicipality.toLowerCase()
      }
      return entry.country.trim().toLowerCase() === selfCountry.toLowerCase()
    })
    if (!localPool.some((entry) => entry.isYou) && selfSnap.exists) {
      localPool.push(mapEntry(account.companyId, selfSnap.data()!, true))
    }
    localPool.sort((left, right) => right.xp - left.xp)
    const rankedLocal = localPool.map((entry, index) => ({ ...entry, rank: index + 1 }))
    const localRank = rankedLocal.find((entry) => entry.isYou)?.rank ?? 1
    const localTop = rankedLocal.slice(0, 40)
    const selfLocal = rankedLocal.find((entry) => entry.isYou)
    const local = selfLocal && !localTop.some((entry) => entry.isYou)
      ? [...localTop, selfLocal]
      : localTop

    res.json({
      local,
      world,
      localRank,
      worldRank: worldRank || 1,
      municipality: selfMunicipality,
      country: selfCountry,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar el ranking.'
    if (message.includes('FAILED_PRECONDITION') || message.includes('index')) {
      res.json({
        local: [],
        world: [],
        localRank: 1,
        worldRank: 1,
        municipality: '',
        country: 'España',
        needsIndex: true,
      })
      return
    }
    res.status(message.includes('sesión') ? 401 : 500).json({ error: message })
  }
})

export default router
