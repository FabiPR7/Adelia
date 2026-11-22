// Ningún error técnico llega a la pantalla («java.io.IOException», «TypeError»,
// «Firebase: auth/…»…): si el texto no es para personas, se enseña uno claro.
// Los mensajes que escribimos nosotros (en el servidor o en la app) pasan tal cual.
// Igual en la app (C:deliasrcTilsriendlyError.ts).

export const GENERIC_ERROR_MESSAGE = 'Algo ha fallado. Inténtalo de nuevo.'
const OFFLINE_ERROR_MESSAGE = 'Sin conexión a internet. Comprueba tu conexión e inténtalo de nuevo.'

const NETWORK =
  /network request failed|failed to fetch|networkerror|network-request-failed|unable to resolve host|failed to connect|connection (reset|refused|abort)|socket|timed? ?out|econn|enotfound|ioexception|unexpected end of stream|sin conexión/i

const TECHNICAL =
  /exception|java\.|kotlin|android\.|objc|nsurl|typeerror|referenceerror|syntaxerror|rangeerror|undefined|null is not|cannot read|is not a function|unexpected token|json|firebase|auth\/|firestore|permission[-_ ]denied|internal|stack|status code|\bhttps?:\/\/|\[object|errno|code: |\bat [\w.$]+ \(/i

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    return typeof message === 'string' ? message : ''
  }
  return ''
}

/** Texto para enseñar a la persona. `fallback` es el mensaje propio de esa pantalla. */
export function friendlyErrorMessage(error: unknown, fallback: string = GENERIC_ERROR_MESSAGE): string {
  const message = rawMessage(error).trim()
  if (!message) return fallback
  if (NETWORK.test(message)) return OFFLINE_ERROR_MESSAGE
  if (TECHNICAL.test(message) || message.length > 240) return fallback
  return message
}
