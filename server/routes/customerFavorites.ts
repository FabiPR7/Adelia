import { Router, type Request, type Response } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyCustomerUid } from '../auth/verifyRequest.ts'
import { adminDb } from '../firebase-admin.ts'
import { COLLECTIONS } from '../data/collections.ts'

const router = Router()

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MAX_FAVORITES = 200

function normalizeSlug(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeFavoriteSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  const next: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const slug = normalizeSlug(item)
    if (!slug || !SLUG_RE.test(slug) || seen.has(slug)) {
      continue
    }
    seen.add(slug)
    next.push(slug)
    if (next.length >= MAX_FAVORITES) {
      break
    }
  }
  return next
}

/**
 * Lee los favoritos de un cliente. `users/{uid}.favoriteSlugs` (array) es la
 * única fuente de verdad. La colección `userFavorites` solo se consulta como
 * fallback para cuentas antiguas que aún no tienen el array poblado, y en ese
 * caso se copia al array para no volver a mirarla.
 */
async function loadFavoriteSlugs(
  userRef: FirebaseFirestore.DocumentReference,
  userData: FirebaseFirestore.DocumentData,
): Promise<string[]> {
  const fromArray = normalizeFavoriteSlugs(userData.favoriteSlugs)
  if (fromArray.length > 0 || Array.isArray(userData.favoriteSlugs)) {
    return fromArray
  }

  try {
    const legacySnap = await adminDb
      .collection(COLLECTIONS.userFavorites)
      .where('userId', '==', userRef.id)
      .limit(MAX_FAVORITES)
      .get()
    const migrated = normalizeFavoriteSlugs(legacySnap.docs.map((doc) => doc.data().slug))
    if (migrated.length > 0) {
      await userRef.set({ favoriteSlugs: migrated }, { merge: true })
    }
    return migrated
  } catch {
    return []
  }
}

function statusForError(message: string): number {
  return message.includes('cliente') || message.includes('autoriz') ? 401 : 500
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const userRef = adminDb.collection(COLLECTIONS.users).doc(user.uid)
    const userSnap = await userRef.get()
    if (!userSnap.exists) {
      res.status(404).json({ error: 'Usuario no encontrado.' })
      return
    }

    const favoriteSlugs = await loadFavoriteSlugs(userRef, userSnap.data() ?? {})
    res.json({ favoriteSlugs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar los favoritos.'
    res.status(statusForError(message)).json({ error: message })
  }
})

router.put('/', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const favoriteSlugs = normalizeFavoriteSlugs(req.body?.favoriteSlugs)
    const userRef = adminDb.collection(COLLECTIONS.users).doc(user.uid)
    const userSnap = await userRef.get()
    if (!userSnap.exists || userSnap.data()?.role !== 'customer') {
      res.status(404).json({ error: 'Usuario no encontrado.' })
      return
    }

    await userRef.set(
      { favoriteSlugs, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    )
    res.json({ favoriteSlugs })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudieron guardar los favoritos.'
    res.status(message.includes('cliente') || message.includes('autoriz') ? 401 : 400).json({ error: message })
  }
})

router.post('/:slug', async (req: Request, res: Response) => {
  try {
    const user = await verifyCustomerUid(req)
    const slug = normalizeSlug(req.params.slug)
    if (!slug || !SLUG_RE.test(slug)) {
      res.status(400).json({ error: 'Slug de restaurante no válido.' })
      return
    }

    const saved = req.body?.saved !== false && req.body?.saved !== 'false'
    const userRef = adminDb.collection(COLLECTIONS.users).doc(user.uid)

    const favoriteSlugs = await adminDb.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef)
      if (!userSnap.exists || userSnap.data()?.role !== 'customer') {
        throw new Error('Usuario no encontrado.')
      }

      const current = normalizeFavoriteSlugs(userSnap.data()?.favoriteSlugs)
      const next = saved
        ? (current.includes(slug) ? current : [...current, slug].slice(0, MAX_FAVORITES))
        : current.filter((item) => item !== slug)

      transaction.set(
        userRef,
        { favoriteSlugs: next, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      )
      return next
    })

    res.json({ favoriteSlugs, saved: favoriteSlugs.includes(slug) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo actualizar el favorito.'
    if (message.includes('no encontrado')) {
      res.status(404).json({ error: message })
      return
    }
    res.status(message.includes('cliente') || message.includes('autoriz') ? 401 : 400).json({ error: message })
  }
})

export default router
