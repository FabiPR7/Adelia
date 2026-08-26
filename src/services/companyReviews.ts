import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import { getFirestoreErrorMessage } from './firestoreErrors'
import { pingCompanyGamification } from './companyGamification'
import type { CustomerGamificationState } from '../types/gamification'
import type {
  CompanyReview,
  CompanyReviewOwnerReply,
  ReviewMediaItem,
  ReviewTaggedProduct,
  ReviewTaggedPromotion,
} from '../types/review'
import {
  MAX_REVIEW_RATING,
  MAX_REVIEW_REPLY_LENGTH,
  MIN_REVIEW_RATING,
  MIN_REVIEW_REPLY_LENGTH,
  normalizeReviewRating,
  reviewHasPhotoBonus,
} from '../types/review'
import { getReviewCommentPlainText } from '../utils/reviewCommentTags'
import { COMPANY_REVIEW_PAGE_SIZE } from './firestoreQuery'

export interface SubmitCustomerReviewInput {
  reservationId: string
  companyId: string
  customerUid: string
  customerName: string
  rating: number
  comment: string
  mediaItems: ReviewMediaItem[]
  taggedProducts: ReviewTaggedProduct[]
  taggedPromotions: ReviewTaggedPromotion[]
}

export interface UpdateCustomerReviewInput {
  companyId: string
  customerUid: string
  customerName: string
  reservationId: string
  rating: number
  comment: string
  mediaItems: ReviewMediaItem[]
  taggedProducts: ReviewTaggedProduct[]
  taggedPromotions: ReviewTaggedPromotion[]
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

async function callCustomerReviewApi(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: Record<string, unknown>,
) {
  const user = auth.currentUser
  if (!user) {
    throw new Error('Debes iniciar sesión como cliente.')
  }
  const token = await user.getIdToken()
  const response = await fetch(`${API_BASE}/api/customer/reviews${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = (await response.json().catch(() => ({}))) as {
    error?: string
    inventory?: Record<string, number>
    xp?: number
    adelinas?: number
  }
  if (!response.ok) {
    throw new Error(data.error ?? 'No se pudo guardar la reseña.')
  }
  return data
}

function mapReviewMediaItems(value: unknown): ReviewMediaItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return []
    }

    const record = item as Record<string, unknown>
    const url = typeof record.url === 'string' ? record.url.trim() : ''
    const type = record.type === 'video' ? 'video' : record.type === 'image' ? 'image' : null

    if (!url || !type) {
      return []
    }

    return [{ url, type }]
  })
}

function mapReviewTaggedProducts(value: unknown): ReviewTaggedProduct[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return []
    }

    const record = item as Record<string, unknown>
    const nodeId = typeof record.nodeId === 'string' ? record.nodeId : ''
    const boardId = typeof record.boardId === 'string' ? record.boardId : ''
    const name = typeof record.name === 'string' ? record.name.trim() : ''

    if (!nodeId || !boardId || !name) {
      return []
    }

    return [{ nodeId, boardId, name }]
  })
}

function mapReviewOwnerReply(value: unknown): CompanyReviewOwnerReply | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const text = typeof record.text === 'string' ? record.text.trim() : ''
  const createdAt = (record.createdAt as { toDate?: () => Date })?.toDate?.()
    ?? (typeof record.createdAt === 'string' ? new Date(record.createdAt) : null)
  const updatedAt = (record.updatedAt as { toDate?: () => Date })?.toDate?.()
    ?? (typeof record.updatedAt === 'string' ? new Date(record.updatedAt) : undefined)

  if (!text || !createdAt) {
    return null
  }

  return {
    text,
    createdAt,
    updatedAt,
  }
}

function mapReviewTaggedPromotions(value: unknown): ReviewTaggedPromotion[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return []
    }

    const record = item as Record<string, unknown>
    const promotionId = typeof record.promotionId === 'string' ? record.promotionId : ''
    const name = typeof record.name === 'string' ? record.name.trim() : ''

    if (!promotionId || !name) {
      return []
    }

    return [{ promotionId, name }]
  })
}

function mapReviewDoc(id: string, data: Record<string, unknown>): CompanyReview | null {
  const rating = typeof data.rating === 'number' ? data.rating : null
  const comment = typeof data.comment === 'string' ? data.comment : ''
  const createdAt = (data.createdAt as { toDate?: () => Date })?.toDate?.()
    ?? (typeof data.createdAt === 'string' ? new Date(data.createdAt) : null)
  const mediaItems = mapReviewMediaItems(data.mediaItems)

  if (rating == null || !createdAt) {
    return null
  }

  const legacyHasPhoto = data.hasPhoto === true

  return {
    id,
    companyId: typeof data.companyId === 'string' ? data.companyId : '',
    reservationId: typeof data.reservationId === 'string' ? data.reservationId : id,
    customerUid: typeof data.customerUid === 'string' ? data.customerUid : '',
    customerName: typeof data.customerName === 'string' ? data.customerName : '',
    rating,
    comment,
    hasPhoto: reviewHasPhotoBonus(legacyHasPhoto, mediaItems),
    mediaItems,
    taggedProducts: mapReviewTaggedProducts(data.taggedProducts),
    taggedPromotions: mapReviewTaggedPromotions(data.taggedPromotions),
    adelinasEarned: typeof data.adelinasEarned === 'number' ? data.adelinasEarned : 0,
    createdAt,
    ownerReply: mapReviewOwnerReply(data.ownerReply),
  }
}

function reviewRef(companyId: string, customerUid: string) {
  return doc(db, 'companies', companyId, 'reviews', customerUid)
}

async function runFirestoreSaveStep(label: string, action: () => Promise<void>) {
  try {
    await action()
  } catch (error) {
    throw new Error(`${label}: ${getFirestoreErrorMessage(error, 'save')}`)
  }
}

function validateReviewInput(rating: number, comment: string) {
  const normalizedRating = normalizeReviewRating(rating)
  const trimmedComment = comment.trim()

  if (normalizedRating < MIN_REVIEW_RATING || normalizedRating > MAX_REVIEW_RATING) {
    throw new Error('Selecciona una puntuación entre 1 y 5 Adelinas.')
  }

  if (getReviewCommentPlainText(trimmedComment).length < 10) {
    throw new Error('Escribe al menos 10 caracteres en tu reseña.')
  }

  if (trimmedComment.length < 10) {
    throw new Error('Escribe al menos 10 caracteres en tu reseña.')
  }

  return { rating: normalizedRating, comment: trimmedComment }
}

function validateCompanyReplyInput(text: string) {
  const trimmed = text.trim()

  if (trimmed.length < MIN_REVIEW_REPLY_LENGTH) {
    throw new Error(`Escribe al menos ${MIN_REVIEW_REPLY_LENGTH} caracteres en tu respuesta.`)
  }

  if (trimmed.length > MAX_REVIEW_REPLY_LENGTH) {
    throw new Error(`La respuesta no puede superar ${MAX_REVIEW_REPLY_LENGTH} caracteres.`)
  }

  return trimmed
}

function reviewDocumentRef(companyId: string, reviewId: string) {
  return doc(db, 'companies', companyId, 'reviews', reviewId)
}

export async function getCompanyReviews(companyId: string): Promise<CompanyReview[]> {
  const snapshot = await getDocs(
    query(
      collection(db, 'companies', companyId, 'reviews'),
      orderBy('createdAt', 'desc'),
      limit(COMPANY_REVIEW_PAGE_SIZE),
    ),
  ).catch(() => getDocs(query(collection(db, 'companies', companyId, 'reviews'), limit(COMPANY_REVIEW_PAGE_SIZE))))

  return snapshot.docs
    .map((item) => mapReviewDoc(item.id, item.data()))
    .filter((review): review is CompanyReview => review !== null)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
}

export async function getCustomerReviewForCompany(
  companyId: string,
  customerUid: string,
): Promise<CompanyReview | null> {
  const directSnap = await getDoc(reviewRef(companyId, customerUid))
  if (directSnap.exists()) {
    return mapReviewDoc(directSnap.id, directSnap.data())
  }

  const legacySnapshot = await getDocs(
    query(
      collection(db, 'companies', companyId, 'reviews'),
      where('customerUid', '==', customerUid),
      limit(1),
    ),
  )

  const legacyDoc = legacySnapshot.docs[0]
  if (!legacyDoc) {
    return null
  }

  return mapReviewDoc(legacyDoc.id, legacyDoc.data())
}

export async function getCustomerReviewsByCompanyIds(
  companyIds: string[],
  customerUid: string,
): Promise<Record<string, CompanyReview>> {
  const uniqueCompanyIds = [...new Set(companyIds)]
  const entries = await Promise.all(
    uniqueCompanyIds.map(async (companyId) => {
      const review = await getCustomerReviewForCompany(companyId, customerUid)
      return review ? ([companyId, review] as const) : null
    }),
  )

  return Object.fromEntries(entries.filter((entry): entry is [string, CompanyReview] => entry !== null))
}

export async function submitCustomerReview(
  currentGamification: CustomerGamificationState,
  input: SubmitCustomerReviewInput,
): Promise<CustomerGamificationState> {
  const { rating, comment } = validateReviewInput(input.rating, input.comment)
  const data = await callCustomerReviewApi('/', 'POST', {
    companyId: input.companyId,
    reservationId: input.reservationId,
    rating,
    comment,
    mediaItems: input.mediaItems,
  })
  return {
    ...currentGamification,
    ...(data.inventory && typeof data.inventory === 'object' ? { inventory: data.inventory } : {}),
    ...(typeof data.xp === 'number' && Number.isFinite(data.xp) ? { xp: Math.trunc(data.xp) } : {}),
    ...(typeof data.adelinas === 'number' && Number.isFinite(data.adelinas)
      ? { adelinas: Math.trunc(data.adelinas) }
      : {}),
  }
}

export async function updateCustomerReview(
  currentGamification: CustomerGamificationState,
  input: UpdateCustomerReviewInput,
): Promise<CustomerGamificationState> {
  const { rating, comment } = validateReviewInput(input.rating, input.comment)
  await callCustomerReviewApi(`/${encodeURIComponent(input.companyId)}`, 'PUT', {
    reservationId: input.reservationId,
    rating,
    comment,
    mediaItems: input.mediaItems,
  })
  return currentGamification
}

export async function deleteCustomerReview(
  currentGamification: CustomerGamificationState,
  companyId: string,
  customerUid: string,
): Promise<CustomerGamificationState> {
  void customerUid
  await callCustomerReviewApi(`/${encodeURIComponent(companyId)}`, 'DELETE')
  return currentGamification
}

export async function submitCompanyReviewReply(
  companyId: string,
  reviewId: string,
  text: string,
  existingReply?: CompanyReviewOwnerReply | null,
): Promise<CompanyReviewOwnerReply> {
  const trimmed = validateCompanyReplyInput(text)
  const reviewSnap = await getDoc(reviewDocumentRef(companyId, reviewId))

  if (!reviewSnap.exists()) {
    throw new Error('No encontramos la reseña para responder.')
  }

  const currentReply = mapReviewOwnerReply(reviewSnap.data().ownerReply)
  if (currentReply && !existingReply) {
    throw new Error('Esta reseña ya tiene una respuesta. Puedes editarla, pero no añadir otra.')
  }

  const ownerReplyPayload = existingReply
    ? {
        text: trimmed,
        createdAt: Timestamp.fromDate(existingReply.createdAt),
        updatedAt: serverTimestamp(),
      }
    : {
        text: trimmed,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

  await runFirestoreSaveStep('No se pudo guardar la respuesta', async () => {
    await updateDoc(reviewDocumentRef(companyId, reviewId), { ownerReply: ownerReplyPayload })
  })
  pingCompanyGamification()

  const createdAt = existingReply?.createdAt ?? new Date()

  return {
    text: trimmed,
    createdAt,
    updatedAt: new Date(),
  }
}
