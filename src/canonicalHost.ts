/**
 * La web también responde en la dirección de Firebase (adelia-reservas.web.app).
 * Quien entre por ahí pasa a adeliareservas.com: una sola dirección para Google,
 * para los enlaces que se comparten y para las sesiones (cada dirección guarda
 * su propia sesión). Las rutas internas de Firebase (/__/) no se tocan.
 */
const FIREBASE_HOSTS = new Set(['adelia-reservas.web.app', 'adelia-reservas.firebaseapp.com'])
const CANONICAL_ORIGIN = 'https://adeliareservas.com'

if (typeof window !== 'undefined') {
  const { hostname, pathname, search, hash } = window.location
  if (FIREBASE_HOSTS.has(hostname) && !pathname.startsWith('/__/')) {
    window.location.replace(`${CANONICAL_ORIGIN}${pathname}${search}${hash}`)
  }
}

export {}
