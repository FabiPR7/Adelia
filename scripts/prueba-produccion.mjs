// Pruebas contra la web y el servidor de producción. SOLO CONSULTA: no crea, cambia ni
// borra nada. Comprueba que las direcciones públicas responden bien y que las privadas
// no dejan entrar sin sesión. Uso: `node scripts/prueba-produccion.mjs`
// (o con otra dirección: BASE=https://… node scripts/prueba-produccion.mjs).

const BASE = process.env.BASE ?? 'https://adeliareservas.com'
const results = []

async function check(name, fn) {
  const started = Date.now()
  try {
    await fn()
    results.push({ name, ok: true, ms: Date.now() - started })
  } catch (error) {
    results.push({ name, ok: false, ms: Date.now() - started, error: error instanceof Error ? error.message : String(error) })
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function get(path, init) {
  const response = await fetch(BASE + path, { redirect: 'manual', ...init })
  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    // no es JSON
  }
  return { status: response.status, headers: response.headers, text, json }
}

let someSlug = 'carol'
let someCompanyId = ''

// ---------- Web ----------
await check('La web abre (inicio)', async () => {
  const r = await get('/')
  assert(r.status === 200, `estado ${r.status}`)
  assert(r.text.includes('<div id="root"'), 'falta la app')
})
await check('Cabeceras de seguridad (CSP, sin incrustar, https estricto)', async () => {
  const r = await get('/')
  const csp = r.headers.get('content-security-policy') ?? ''
  assert(csp.includes("default-src 'self'"), 'sin CSP')
  assert(csp.includes("frame-ancestors 'none'"), 'se puede incrustar en otras webs')
  assert(csp.includes('tiles.openfreemap.org'), 'el mapa limpio no está permitido')
  assert((r.headers.get('strict-transport-security') ?? '').includes('max-age'), 'sin HSTS')
  assert(r.headers.get('x-content-type-options') === 'nosniff', 'sin nosniff')
})
await check('Una ficha de restaurante abre como página (no 404)', async () => {
  const r = await get('/reservar/carol')
  assert(r.status === 200, `estado ${r.status}`)
})
await check('El servidor responde (/api/health)', async () => {
  const r = await get('/api/health')
  assert(r.status === 200, `estado ${r.status}`)
})

// ---------- Buscar ----------
await check('Buscar: lista de restaurantes', async () => {
  const r = await get('/api/public/discovery')
  assert(r.status === 200, `estado ${r.status}`)
  const list = r.json?.restaurants ?? []
  assert(list.length > 0, 'sin restaurantes')
  assert(list.every((x) => x.id && x.slug && x.name), 'restaurantes sin datos básicos')
  someSlug = list[0].slug
  someCompanyId = list[0].id
  assert((r.headers.get('cache-control') ?? '').includes('max-age'), 'sin caché pública (la CDN no la guarda)')
})
await check('Buscar: por ciudad (Logroño)', async () => {
  const r = await get('/api/public/discovery?city=logro%C3%B1o')
  assert(r.status === 200 && (r.json?.restaurants ?? []).length > 0, `estado ${r.status}`)
})
await check('Buscar: cerca de un punto', async () => {
  const r = await get('/api/public/discovery?lat=42.47&lng=-2.45')
  assert(r.status === 200 && Array.isArray(r.json?.restaurants), `estado ${r.status}`)
})
await check('Buscar: datos raros no rompen el servidor', async () => {
  const r = await get('/api/public/discovery?lat=abc&lng=999&cursor=%3Cscript%3E')
  assert(r.status === 200, `estado ${r.status}`)
})
await check('Buscar: ciudades al escribir', async () => {
  const r = await get('/api/public/cities/search?q=logr')
  assert(r.status === 200, `estado ${r.status}`)
})
await check('Buscar: lo mejor del mes', async () => {
  const r = await get('/api/public/discovery/league?city=logro%C3%B1o')
  assert(r.status === 200, `estado ${r.status}`)
})

// ---------- Ficha, carta, reseñas, promos ----------
await check('Ficha: datos del restaurante y reglas de reserva', async () => {
  const r = await get(`/api/public/booking/${someSlug}`)
  assert(r.status === 200, `estado ${r.status}`)
  assert(r.json?.company?.slug === someSlug, 'otro restaurante')
  assert(typeof r.json?.booking?.canReserve === 'boolean', 'sin reglas de reserva')
})
await check('Ficha: un restaurante que no existe da 404 (no error)', async () => {
  const r = await get('/api/public/booking/no-existe-este-local-xyz')
  assert(r.status === 404, `estado ${r.status}`)
})
await check('Ficha: reseñas públicas', async () => {
  const r = await get(`/api/public/booking/${someSlug}/reviews?limit=6`)
  assert(r.status === 200 && Array.isArray(r.json?.reviews), `estado ${r.status}`)
  assert(r.json.reviews.length <= 6, 'manda más reseñas de las pedidas')
})
await check('Carta: Carolina tiene cartas', async () => {
  const id = 'ahS2jGcFMZwx1YYciYMD'
  const r = await get(`/api/public/menus/${id}`)
  assert(r.status === 200 && Array.isArray(r.json?.boards), `estado ${r.status}`)
})
await check('Carta: «solo la lista» no manda platos', async () => {
  const r = await get('/api/public/menus/ahS2jGcFMZwx1YYciYMD?boardsOnly=1')
  assert(r.status === 200 && (r.json?.nodes ?? []).length === 0, 'manda platos')
})
await check('Carta: un id inválido no rompe el servidor', async () => {
  const r = await get('/api/public/menus/..%2F..%2Fusers')
  // Rechazado o redirigido, nunca un error del servidor.
  assert(r.status < 500, `estado ${r.status}`)
})
await check('Promos: lista pública', async () => {
  const r = await get('/api/public/promotions')
  assert(r.status === 200 && Array.isArray(r.json?.promotions), `estado ${r.status}`)
})
await check('Promos: las de un restaurante', async () => {
  const r = await get(`/api/public/promotions/${someSlug}`)
  assert(r.status === 200, `estado ${r.status}`)
})

// ---------- Privado: sin sesión no se entra ----------
const privadas = [
  ['GET', '/api/customer/reviews/eligibility/' + (someCompanyId || 'x')],
  ['POST', '/api/customer/reviews'],
  ['GET', '/api/customer/reservations'],
  ['GET', '/api/customer/promotions/availability'],
  ['GET', '/api/customer/promotions/ladders'],
  ['GET', '/api/customer/friends/visits'],
  ['GET', '/api/customer/gamification/consumptions'],
]
for (const [method, path] of privadas) {
  await check(`Privado sin sesión: ${method} ${path.replace(/\/[A-Za-z0-9]{15,}$/, '/…')}`, async () => {
    const r = await get(path, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'POST' ? '{}' : undefined })
    assert(r.status === 401 || r.status === 403, `estado ${r.status} (debería ser 401/403)`)
    assert(!/at [\w.]+ \(|Exception|stack/i.test(r.text), 'enseña detalles técnicos')
  })
}
await check('Privado con una sesión falsa: no entra', async () => {
  const r = await get('/api/customer/reservations', { headers: { Authorization: 'Bearer token-inventado' } })
  assert(r.status === 401 || r.status === 403, `estado ${r.status}`)
})
await check('Panel de restaurante sin sesión: no entra', async () => {
  const r = await get(`/api/company/${someCompanyId || 'x'}/menu/boards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  assert(r.status === 401 || r.status === 403 || r.status === 404, `estado ${r.status}`)
})
await check('Administración sin sesión: no entra', async () => {
  const r = await get('/api/admin/stats')
  assert([401, 403, 404].includes(r.status), `estado ${r.status}`)
})

// ---------- Resultado ----------
const failed = results.filter((r) => !r.ok)
for (const r of results) {
  console.log(`${r.ok ? '✅' : '❌'} ${r.name} (${r.ms} ms)${r.ok ? '' : ' → ' + r.error}`)
}
console.log(`\n${results.length - failed.length} de ${results.length} bien`)
process.exit(failed.length ? 1 : 0)
