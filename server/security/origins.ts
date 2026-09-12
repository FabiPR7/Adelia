const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'https://adeliareservas.com',
  'https://www.adeliareservas.com',
  'https://adelia-reservas.web.app',
  'https://adelia-reservas.firebaseapp.com',
  'https://adelia-ccdaf.web.app',
  'https://adelia-ccdaf.firebaseapp.com',
]

function extraConfiguredOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  const fromAppUrl: string[] = []
  const appUrl = process.env.APP_URL?.trim()
  if (appUrl) {
    try {
      fromAppUrl.push(new URL(appUrl).origin)
    } catch {
      // APP_URL mal formado: se ignora para CORS.
    }
  }

  return [...fromEnv, ...fromAppUrl]
}

// Dominios de túnel (cloudflared/ngrok/localtunnel) para probar webhooks en
// local. Solo cuentan fuera de Cloud Functions (ver guardas abajo).
const DEV_TUNNEL_SUFFIXES = ['.trycloudflare.com', '.ngrok-free.app', '.loca.lt']

function isLocalDevOrigin(origin: string): boolean {
  if (process.env.K_SERVICE || process.env.FUNCTION_TARGET) {
    return false
  }
  try {
    const { hostname, protocol } = new URL(origin)
    if (protocol !== 'http:' && protocol !== 'https:') {
      return false
    }
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true
    }
    return DEV_TUNNEL_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  } catch {
    return false
  }
}

export function isAllowedOrigin(origin: string): boolean {
  if ([...DEFAULT_CORS_ORIGINS, ...extraConfiguredOrigins()].includes(origin)) {
    return true
  }
  return isLocalDevOrigin(origin)
}
