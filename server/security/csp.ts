/** CSP de producción. Mantener alineada con firebase.json (headers de Hosting). */
export const PRODUCTION_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  'upgrade-insecure-requests',
  "script-src 'self' https://js.stripe.com https://apis.google.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://accounts.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https://res.cloudinary.com",
  "connect-src 'self' https://*.googleapis.com https://*.google.com https://*.gstatic.com https://*.firebaseio.com wss://*.firebaseio.com https://*.cloudfunctions.net https://*.firebasestorage.app https://firebasestorage.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebase.googleapis.com https://firebaseinstallations.googleapis.com https://apis.google.com https://accounts.google.com https://api.stripe.com https://*.stripe.com https://api.cloudinary.com https://res.cloudinary.com https://api.maptiler.com https://*.maptiler.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://accounts.google.com https://*.firebaseapp.com",
  "worker-src 'self' blob:",
].join('; ')

/** CSP de desarrollo: Vite HMR necesita eval, inline y websockets locales. */
export const DEV_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://apis.google.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://accounts.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.gstatic.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' blob: https: http:",
  "connect-src 'self' ws: wss: http://localhost:* http://127.0.0.1:* https:",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://accounts.google.com https://*.firebaseapp.com",
  "worker-src 'self' blob:",
].join('; ')

export const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
