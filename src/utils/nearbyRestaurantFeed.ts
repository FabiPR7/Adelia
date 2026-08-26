export const NEARBY_FEED_PAGE_SIZE = 5

export function nextNearbyFeedCount(
  visibleCount: number,
  total: number,
  pageSize: number = NEARBY_FEED_PAGE_SIZE,
): number {
  if (total <= 0 || pageSize <= 0) {
    return 0
  }

  return Math.min(total, Math.max(0, visibleCount) + pageSize)
}

export function sliceNearbyFeed<T>(items: T[], visibleCount: number): T[] {
  if (visibleCount <= 0) {
    return []
  }

  return items.slice(0, visibleCount)
}
