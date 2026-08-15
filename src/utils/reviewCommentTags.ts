import type { ReviewTaggedProduct, ReviewTaggedPromotion } from '../types/review'

/** Marcadores embebidos en el comentario: [[p|boardId|nodeId|Nombre]] y [[r|promotionId|Nombre]] */
export const REVIEW_PRODUCT_TAG_PATTERN = /\[\[p\|([^|]+)\|([^|]+)\|([^\]]+)\]\]/g
export const REVIEW_PROMO_TAG_PATTERN = /\[\[r\|([^|]+)\|([^\]]+)\]\]/g

export function buildProductTagMarker(tag: Pick<ReviewTaggedProduct, 'boardId' | 'nodeId' | 'name'>): string {
  return `[[p|${tag.boardId}|${tag.nodeId}|${tag.name}]]`
}

export function buildPromoTagMarker(tag: Pick<ReviewTaggedPromotion, 'promotionId' | 'name'>): string {
  return `[[r|${tag.promotionId}|${tag.name}]]`
}

export function commentHasInlineTags(comment: string): boolean {
  REVIEW_PRODUCT_TAG_PATTERN.lastIndex = 0
  REVIEW_PROMO_TAG_PATTERN.lastIndex = 0
  return REVIEW_PRODUCT_TAG_PATTERN.test(comment) || REVIEW_PROMO_TAG_PATTERN.test(comment)
}

export function insertTagMarkerAt(comment: string, cursorPosition: number, marker: string): string {
  const safeCursor = Math.max(0, Math.min(cursorPosition, comment.length))
  const before = comment.slice(0, safeCursor)
  const after = comment.slice(safeCursor)

  const needsSpaceBefore = before.length > 0 && !/\s$/.test(before)
  const needsSpaceAfter = after.length > 0 && !/^\s/.test(after)
  const insertion = `${needsSpaceBefore ? ' ' : ''}${marker}${needsSpaceAfter ? ' ' : ''}`

  return before + insertion + after
}

export function extractTagsFromComment(comment: string): {
  taggedProducts: ReviewTaggedProduct[]
  taggedPromotions: ReviewTaggedPromotion[]
} {
  const productMap = new Map<string, ReviewTaggedProduct>()
  const promoMap = new Map<string, ReviewTaggedPromotion>()

  for (const match of comment.matchAll(new RegExp(REVIEW_PRODUCT_TAG_PATTERN.source, 'g'))) {
    const [, boardId, nodeId, name] = match
    if (boardId && nodeId && name) {
      productMap.set(nodeId, { boardId, nodeId, name })
    }
  }

  for (const match of comment.matchAll(new RegExp(REVIEW_PROMO_TAG_PATTERN.source, 'g'))) {
    const [, promotionId, name] = match
    if (promotionId && name) {
      promoMap.set(promotionId, { promotionId, name })
    }
  }

  return {
    taggedProducts: [...productMap.values()],
    taggedPromotions: [...promoMap.values()],
  }
}

/** Longitud del comentario contando solo el texto visible (nombres de etiquetas, sin marcadores). */
export function getReviewCommentPlainLength(comment: string): number {
  const plain = comment
    .replace(new RegExp(REVIEW_PRODUCT_TAG_PATTERN.source, 'g'), (_full, _b, _n, name: string) => name)
    .replace(new RegExp(REVIEW_PROMO_TAG_PATTERN.source, 'g'), (_full, _id, name: string) => name)

  return plain.trim().length
}

export function getReviewCommentPlainText(comment: string): string {
  return comment
    .replace(new RegExp(REVIEW_PRODUCT_TAG_PATTERN.source, 'g'), (_full, _b, _n, name: string) => name)
    .replace(new RegExp(REVIEW_PROMO_TAG_PATTERN.source, 'g'), (_full, _id, name: string) => name)
    .replace(/\s+/g, ' ')
    .trim()
}

export function serializeReviewCommentEditor(root: HTMLElement): string {
  let result = ''

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? ''
      return
    }

    if (!(node instanceof HTMLElement)) {
      return
    }

    const tagType = node.dataset.tagType
    if (tagType === 'product') {
      const boardId = node.dataset.boardId ?? ''
      const nodeId = node.dataset.nodeId ?? ''
      const name = node.textContent?.trim() ?? ''
      if (boardId && nodeId && name) {
        result += buildProductTagMarker({ boardId, nodeId, name })
      }
      return
    }

    if (tagType === 'promotion') {
      const promotionId = node.dataset.promotionId ?? ''
      const name = node.textContent?.trim() ?? ''
      if (promotionId && name) {
        result += buildPromoTagMarker({ promotionId, name })
      }
      return
    }

    node.childNodes.forEach(walk)
  }

  root.childNodes.forEach(walk)
  return result
}

export type ReviewCommentSegment =
  | { type: 'text'; value: string }
  | { type: 'product'; value: string; tag: ReviewTaggedProduct }
  | { type: 'promotion'; value: string; tag: ReviewTaggedPromotion }

export function parseReviewCommentSegments(
  comment: string,
  legacyProducts: ReviewTaggedProduct[] = [],
  legacyPromotions: ReviewTaggedPromotion[] = [],
): ReviewCommentSegment[] {
  if (commentHasInlineTags(comment)) {
    return parseInlineTagSegments(comment)
  }

  return parseLegacyNameSegments(comment, legacyProducts, legacyPromotions)
}

function parseInlineTagSegments(comment: string): ReviewCommentSegment[] {
  const pattern = /\[\[p\|([^|]+)\|([^|]+)\|([^\]]+)\]\]|\[\[r\|([^|]+)\|([^\]]+)\]\]/g
  const segments: ReviewCommentSegment[] = []
  let lastIndex = 0

  for (const match of comment.matchAll(pattern)) {
    const index = match.index ?? 0

    if (index > lastIndex) {
      segments.push({ type: 'text', value: comment.slice(lastIndex, index) })
    }

    if (match[1] && match[2] && match[3]) {
      segments.push({
        type: 'product',
        value: match[3],
        tag: { boardId: match[1], nodeId: match[2], name: match[3] },
      })
    } else if (match[4] && match[5]) {
      segments.push({
        type: 'promotion',
        value: match[5],
        tag: { promotionId: match[4], name: match[5] },
      })
    }

    lastIndex = index + match[0].length
  }

  if (lastIndex < comment.length) {
    segments.push({ type: 'text', value: comment.slice(lastIndex) })
  }

  return segments
}

function parseLegacyNameSegments(
  comment: string,
  legacyProducts: ReviewTaggedProduct[],
  legacyPromotions: ReviewTaggedPromotion[],
): ReviewCommentSegment[] {
  type PendingTag = {
    index: number
    length: number
    segment: Extract<ReviewCommentSegment, { type: 'product' | 'promotion' }>
  }

  const pending: PendingTag[] = []

  for (const tag of legacyProducts) {
    const index = comment.indexOf(tag.name)
    if (index >= 0) {
      pending.push({
        index,
        length: tag.name.length,
        segment: { type: 'product', value: tag.name, tag },
      })
    }
  }

  for (const tag of legacyPromotions) {
    const index = comment.indexOf(tag.name)
    if (index >= 0) {
      pending.push({
        index,
        length: tag.name.length,
        segment: { type: 'promotion', value: tag.name, tag },
      })
    }
  }

  pending.sort((left, right) => left.index - right.index)

  const segments: ReviewCommentSegment[] = []
  let cursor = 0

  for (const item of pending) {
    if (item.index < cursor) {
      continue
    }

    if (item.index > cursor) {
      segments.push({ type: 'text', value: comment.slice(cursor, item.index) })
    }

    segments.push(item.segment)
    cursor = item.index + item.length
  }

  if (cursor < comment.length) {
    segments.push({ type: 'text', value: comment.slice(cursor) })
  }

  if (segments.length === 0) {
    return [{ type: 'text', value: comment }]
  }

  return segments
}
