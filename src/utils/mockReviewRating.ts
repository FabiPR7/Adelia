/** Puntuación ficticia estable por restaurante hasta exista reseñas reales. */
export function getMockReviewRating(slug: string): number {
  let hash = 0

  for (let index = 0; index < slug.length; index += 1) {
    hash = (hash * 31 + slug.charCodeAt(index)) >>> 0
  }

  const normalized = (hash % 700) / 1000
  return Math.round((3.8 + normalized) * 10) / 10
}

/** Adelinas de reseña acumuladas (ficticio, estable por slug). */
export function getMockAdelinaReviewCount(slug: string): number {
  let hash = 0

  for (let index = 0; index < slug.length; index += 1) {
    hash = (hash * 17 + slug.charCodeAt(index)) >>> 0
  }

  return 120 + (hash % 880)
}

/** Reservas totales ficticias (estable por slug) hasta exista métrica real. */
export function getMockReservationCount(slug: string): number {
  let hash = 0

  for (let index = 0; index < slug.length; index += 1) {
    hash = (hash * 23 + slug.charCodeAt(index)) >>> 0
  }

  return 45 + (hash % 420)
}
