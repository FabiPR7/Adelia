// Copia corta en memoria de lo que el panel pide en varias pantallas (mesas, promos,
// reseñas). Ir de Inicio a Compite, Reseñas o Reservas ya no vuelve a leer lo mismo.
// Se vacía entera en cuanto el restaurante cambia algo (callCompanyApi).

const PANEL_CACHE_MS = 60_000

const store = new Map<string, { at: number; value: unknown }>()
const inflight = new Map<string, Promise<unknown>>()

export function panelCached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && Date.now() - hit.at < PANEL_CACHE_MS) {
    return Promise.resolve(hit.value as T)
  }
  const running = inflight.get(key)
  if (running) return running as Promise<T>

  const promise = loader()
    .then((value) => {
      store.set(key, { at: Date.now(), value })
      return value
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, promise)
  return promise
}

export function clearPanelCache(): void {
  store.clear()
}
