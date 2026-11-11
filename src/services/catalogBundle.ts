/**
 * El catálogo del negocio (planes, objetos, misiones, niveles, reglas) llega en
 * un único JSON del servidor, guardado en la CDN. Si no responde, quien lo use
 * lee Firestore como antes.
 */
const API_BASE = import.meta.env.VITE_API_URL ?? ''
const TIMEOUT_MS = 2000

export interface CatalogBundleDoc {
  id: string
  data: Record<string, unknown>
}

export interface CatalogBundle {
  collections: Record<string, CatalogBundleDoc[]>
  docs: Record<string, Record<string, unknown> | null>
}

/** Imita lo justo de un QuerySnapshot de Firestore para reutilizar los lectores. */
export interface BundleQuerySnap {
  docs: Array<{ id: string; data: () => Record<string, unknown> }>
}

/** Imita lo justo de un DocumentSnapshot. */
export interface BundleDocSnap {
  exists: () => boolean
  data: () => Record<string, unknown> | undefined
}

let bundlePromise: Promise<CatalogBundle | null> | null = null

async function requestBundle(): Promise<CatalogBundle | null> {
  if (typeof fetch !== 'function' || import.meta.env.MODE === 'test') {
    return null
  }
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null
  try {
    const response = await fetch(`${API_BASE}/api/public/catalog`, { signal: controller?.signal })
    if (!response.ok) return null
    const body = await response.json() as Partial<CatalogBundle>
    if (!body || typeof body.collections !== 'object' || typeof body.docs !== 'object') return null
    return { collections: body.collections ?? {}, docs: body.docs ?? {} }
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function fetchCatalogBundle(): Promise<CatalogBundle | null> {
  if (!bundlePromise) {
    bundlePromise = requestBundle()
  }
  return bundlePromise
}

/** Tras guardar algo en el panel, la próxima lectura vuelve a pedirlo. */
export function resetCatalogBundle(): void {
  bundlePromise = null
}

export function bundleQuery(bundle: CatalogBundle, collection: string): BundleQuerySnap {
  return {
    docs: (bundle.collections[collection] ?? []).map((entry) => ({ id: entry.id, data: () => entry.data })),
  }
}

export function bundleDoc(bundle: CatalogBundle, path: string): BundleDocSnap {
  const data = bundle.docs[path] ?? null
  return { exists: () => data !== null, data: () => data ?? undefined }
}
