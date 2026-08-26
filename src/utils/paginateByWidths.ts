export function paginateByWidths(widths: number[], maxWidth: number, gap: number): number[][] {
  if (widths.length === 0) {
    return []
  }

  if (maxWidth <= 0) {
    return [widths.map((_, index) => index)]
  }

  const pages: number[][] = []
  let index = 0

  while (index < widths.length) {
    const page: number[] = []
    let used = 0

    while (index < widths.length) {
      const extra = page.length > 0 ? gap : 0
      const nextWidth = extra + widths[index]

      if (page.length > 0 && used + nextWidth > maxWidth + 0.5) {
        break
      }

      used += nextWidth
      page.push(index)
      index += 1
    }

    pages.push(page)
  }

  return pages
}
