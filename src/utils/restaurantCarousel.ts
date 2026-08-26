export function restaurantCarouselItemKey(
  prefix: string,
  restaurantId: string,
  index: number,
): string {
  return `${prefix}-${restaurantId}-${index}`
}

/** Mantiene el offset en [period, 2*period) para el bucle de 3 copias. */
export function wrapCarouselOffset(offset: number, period: number): number {
  if (period <= 0) {
    return offset
  }

  return (((offset % period) + period) % period) + period
}
