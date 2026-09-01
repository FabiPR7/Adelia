import type { Response } from 'express'

/**
 * Permite cachear una respuesta GET pública en el navegador y en la CDN.
 *
 * `securityHeaders` pone `Cache-Control: no-store` + `Pragma: no-cache` en todas
 * las respuestas por defecto. Para los endpoints públicos de solo lectura (datos
 * de restaurante, promociones, ciudades…) eso obliga a golpear Firestore en cada
 * visita. Esta función lo sobreescribe SOLO en esas rutas, que no dependen del
 * usuario y toleran unos segundos de desfase.
 *
 * No usar en respuestas que dependan de la sesión, de cabeceras `Authorization`
 * o que tengan efectos secundarios.
 */
export function allowPublicCache(
  res: Response,
  browserMaxAgeSeconds: number,
  cdnMaxAgeSeconds = browserMaxAgeSeconds,
): void {
  res.setHeader(
    'Cache-Control',
    `public, max-age=${browserMaxAgeSeconds}, s-maxage=${cdnMaxAgeSeconds}, ` +
      `stale-while-revalidate=${cdnMaxAgeSeconds}`,
  )
  res.removeHeader('Pragma')
}
