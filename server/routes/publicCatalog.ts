import { Router, type Request, type Response } from 'express'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'

/**
 * Todo el catálogo del negocio en una sola respuesta (planes, objetos, misiones,
 * niveles, reglas). Antes cada visita leía unos 60 documentos de Firestore; así
 * la web pide un único JSON que guarda la CDN de Hosting 5 minutos, y la base
 * solo se lee unas pocas veces por hora aunque entren millones de personas.
 */
const router = Router()

const COLLECTIONS = [
  'planCatalog',
  'inventoryItems',
  'missionCatalog',
  'levelCatalog',
  'companyLevelCatalog',
  'companyMissionCatalog',
] as const
const CONFIG_DOCS = [
  ['gameConfig', 'adelia'],
  ['gameConfig', 'rewards'],
  ['gameConfig', 'penalties'],
  ['gameConfig', 'company'],
  ['appConfig', 'billing'],
  ['appConfig', 'planCapabilities'],
] as const
const CACHE_MS = 5 * 60_000
const MAX_DOCS = 300

export interface CatalogBundle {
  generatedAt: string
  collections: Record<string, Array<{ id: string; data: Record<string, unknown> }>>
  docs: Record<string, Record<string, unknown> | null>
}

let cache: { at: number; bundle: CatalogBundle } | null = null
let inflight: Promise<CatalogBundle> | null = null

/** Pasa las fechas de Firestore a texto para que el JSON sea limpio. */
export function plainValue(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(plainValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, plainValue(inner)]))
  }
  return value
}

async function buildBundle(): Promise<CatalogBundle> {
  const [collectionSnaps, docSnaps] = await Promise.all([
    Promise.all(COLLECTIONS.map((name) => adminDb.collection(name).limit(MAX_DOCS).get())),
    adminDb.getAll(...CONFIG_DOCS.map(([collection, id]) => adminDb.collection(collection).doc(id))),
  ])
  const collections: CatalogBundle['collections'] = {}
  COLLECTIONS.forEach((name, index) => {
    collections[name] = collectionSnaps[index].docs.map((doc) => ({
      id: doc.id,
      data: plainValue(doc.data()) as Record<string, unknown>,
    }))
  })
  const docs: CatalogBundle['docs'] = {}
  CONFIG_DOCS.forEach(([collection, id], index) => {
    const snap = docSnaps[index]
    docs[`${collection}/${id}`] = snap?.exists ? (plainValue(snap.data()) as Record<string, unknown>) : null
  })
  return { generatedAt: new Date().toISOString(), collections, docs }
}

export async function getCatalogBundle(): Promise<CatalogBundle> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.bundle
  }
  if (!inflight) {
    inflight = buildBundle()
      .then((bundle) => {
        cache = { at: Date.now(), bundle }
        return bundle
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const bundle = await getCatalogBundle()
    res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=300')
    res.json(bundle)
  } catch (error) {
    console.error('catalog bundle error:', error)
    res.status(503).json({ error: 'Catálogo no disponible.' })
  }
})

export default router
