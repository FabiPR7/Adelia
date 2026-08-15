import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { getFirestoreErrorMessage } from './firestoreErrors'
import type { CustomerGamificationState } from '../types/gamification'
import type {
  CompanyReview,
  CompanyReviewOwnerReply,
  ReviewMediaItem,
  ReviewTaggedProduct,
  ReviewTaggedPromotion,
} from '../types/review'
import {
  computeReviewAdelinas,
  defaultCompanyReviewStats,
  MAX_REVIEW_RATING,
  MAX_REVIEW_REPLY_LENGTH,
  MIN_REVIEW_RATING,
  MIN_REVIEW_REPLY_LENGTH,
  normalizeReviewRating,
  parseCompanyReviewStats,
  reviewHasPhotoBonus,
} from '../types/review'
import { extractTagsFromComment, getReviewCommentPlainText } from '../utils/reviewCommentTags'

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

function sanitizeForFirestore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
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

function applyReviewGamificationOnCreate(
  current: CustomerGamificationState,
  input: { companyId: string; reservationId: string; hasPhoto: boolean },
): CustomerGamificationState {
  if (current.reviewedCompanyIds.includes(input.companyId)) {
    return current
  }

  return {
    ...current,
    reviewsCount: current.reviewsCount + 1,
    reviewsWithPhotoCount: current.reviewsWithPhotoCount + (input.hasPhoto ? 1 : 0),
    textReviewsCount: current.textReviewsCount + (input.hasPhoto ? 0 : 1),
    reviewedCompanyIds: [...current.reviewedCompanyIds, input.companyId],
    reviewedReservationIds: current.reviewedReservationIds.includes(input.reservationId)
      ? current.reviewedReservationIds
      : [...current.reviewedReservationIds, input.reservationId],
  }
}

function applyReviewGamificationOnUpdate(
  current: CustomerGamificationState,
  previousHasPhoto: boolean,
  nextHasPhoto: boolean,
): CustomerGamificationState {
  if (previousHasPhoto === nextHasPhoto) {
    return current
  }

  return {
    ...current,
    reviewsWithPhotoCount: current.reviewsWithPhotoCount + (nextHasPhoto ? 1 : -1),
    textReviewsCount: current.textReviewsCount + (nextHasPhoto ? -1 : 1),
  }
}

function applyReviewGamificationOnDelete(
  current: CustomerGamificationState,
  input: { companyId: string; hasPhoto: boolean },
): CustomerGamificationState {
  return {
    ...current,
    reviewsCount: Math.max(0, current.reviewsCount - 1),
    reviewsWithPhotoCount: Math.max(0, current.reviewsWithPhotoCount - (input.hasPhoto ? 1 : 0)),
    textReviewsCount: Math.max(0, current.textReviewsCount - (input.hasPhoto ? 0 : 1)),
    reviewedCompanyIds: current.reviewedCompanyIds.filter((id) => id !== input.companyId),
  }
}

export async function getCompanyReviews(companyId: string): Promise<CompanyReview[]> {
  const snapshot = await getDocs(collection(db, 'companies', companyId, 'reviews'))

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
  const existing = await getCustomerReviewForCompany(input.companyId, input.customerUid)
  if (existing) {
    throw new Error('Ya tienes una reseña en este restaurante. Puedes editarla o eliminarla.')
  }

  const { rating, comment } = validateReviewInput(input.rating, input.comment)
  const extractedTags = extractTagsFromComment(comment)
  const hasPhoto = reviewHasPhotoBonus(false, input.mediaItems)
  const adelinasEarned = Math.round(computeReviewAdelinas(rating, hasPhoto, input.mediaItems))
  const companyRef = doc(db, 'companies', input.companyId)
  const userRef = doc(db, 'users', input.customerUid)

  const companySnap = await getDoc(companyRef)
  const stats = companySnap.exists()
    ? parseCompanyReviewStats(companySnap.data() as Record<string, unknown>)
    : defaultCompanyReviewStats()

  const nextGamification = sanitizeForFirestore(applyReviewGamificationOnCreate(currentGamification, {
    companyId: input.companyId,
    reservationId: input.reservationId,
    hasPhoto,
  }))

  const reviewPayload = {
    companyId: input.companyId,
    reservationId: input.reservationId,
    customerUid: input.customerUid,
    customerName: input.customerName,
    rating,
    comment,
    hasPhoto,
    mediaItems: input.mediaItems,
    taggedProducts: extractedTags.taggedProducts,
    taggedPromotions: extractedTags.taggedPromotions,
    adelinasEarned,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }

  await runFirestoreSaveStep('No se pudo guardar la reseña', async () => {
    await setDoc(reviewRef(input.companyId, input.customerUid), reviewPayload)
  })

  await runFirestoreSaveStep('No se pudieron actualizar las estadísticas del restaurante', async () => {
    await updateDoc(companyRef, {
      reviewCount: stats.reviewCount + 1,
      reviewRatingSum: stats.reviewRatingSum + rating,
      reviewAdelinas: stats.reviewAdelinas + adelinasEarned,
    })
  })

  await runFirestoreSaveStep('No se pudo actualizar tu perfil', async () => {
    await updateDoc(userRef, {
      gamification: nextGamification,
      xp: nextGamification.xp,
      adelinas: nextGamification.adelinas,
    })
  })

  return nextGamification
}

export async function updateCustomerReview(
  currentGamification: CustomerGamificationState,
  input: UpdateCustomerReviewInput,
): Promise<CustomerGamificationState> {
  const existing = await getCustomerReviewForCompany(input.companyId, input.customerUid)
  if (!existing) {
    throw new Error('No encontramos tu reseña para editar.')
  }

  const { rating, comment } = validateReviewInput(input.rating, input.comment)
  const extractedTags = extractTagsFromComment(comment)
  const hasPhoto = reviewHasPhotoBonus(false, input.mediaItems)
  const adelinasEarned = Math.round(computeReviewAdelinas(rating, hasPhoto, input.mediaItems))
  const companyRef = doc(db, 'companies', input.companyId)
  const userRef = doc(db, 'users', input.customerUid)

  const companySnap = await getDoc(companyRef)
  const stats = companySnap.exists()
    ? parseCompanyReviewStats(companySnap.data() as Record<string, unknown>)
    : defaultCompanyReviewStats()

  const nextGamification = applyReviewGamificationOnUpdate(
    currentGamification,
    reviewHasPhotoBonus(existing.hasPhoto, existing.mediaItems),
    hasPhoto,
  )

  const targetRef = reviewRef(input.companyId, input.customerUid)
  const reviewPayload = {
    companyId: input.companyId,
    reservationId: input.reservationId,
    customerUid: input.customerUid,
    customerName: input.customerName,
    rating,
    comment,
    hasPhoto,
    mediaItems: input.mediaItems,
    taggedProducts: extractedTags.taggedProducts,
    taggedPromotions: extractedTags.taggedPromotions,
    adelinasEarned,
    updatedAt: serverTimestamp(),
  }

  const batch = writeBatch(db)

  if (existing.id !== input.customerUid) {
    batch.delete(doc(db, 'companies', input.companyId, 'reviews', existing.id))
    batch.set(targetRef, {
      ...reviewPayload,
      createdAt: Timestamp.fromDate(existing.createdAt),
    })
  } else {
    batch.update(targetRef, reviewPayload)
  }

  batch.update(companyRef, {
    reviewCount: Math.max(0, stats.reviewCount),
    reviewRatingSum: Math.max(0, stats.reviewRatingSum - existing.rating + rating),
    reviewAdelinas: Math.max(0, stats.reviewAdelinas - existing.adelinasEarned + adelinasEarned),
  })

  batch.update(userRef, {
    gamification: nextGamification,
    xp: nextGamification.xp,
    adelinas: nextGamification.adelinas,
  })

  await batch.commit().catch((error) => {
    throw new Error(getFirestoreErrorMessage(error, 'save'))
  })
  return nextGamification
}

export async function deleteCustomerReview(
  currentGamification: CustomerGamificationState,
  companyId: string,
  customerUid: string,
): Promise<CustomerGamificationState> {
  const existing = await getCustomerReviewForCompany(companyId, customerUid)
  if (!existing) {
    throw new Error('No encontramos tu reseña para eliminar.')
  }

  const companyRef = doc(db, 'companies', companyId)
  const userRef = doc(db, 'users', customerUid)

  const companySnap = await getDoc(companyRef)
  const stats = companySnap.exists()
    ? parseCompanyReviewStats(companySnap.data() as Record<string, unknown>)
    : defaultCompanyReviewStats()

  const nextGamification = applyReviewGamificationOnDelete(currentGamification, {
    companyId,
    hasPhoto: reviewHasPhotoBonus(existing.hasPhoto, existing.mediaItems),
  })

  const batch = writeBatch(db)

  batch.delete(reviewRef(companyId, customerUid))

  if (existing.id !== customerUid) {
    batch.delete(doc(db, 'companies', companyId, 'reviews', existing.id))
  }

  batch.update(companyRef, {
    reviewCount: Math.max(0, stats.reviewCount - 1),
    reviewRatingSum: Math.max(0, stats.reviewRatingSum - existing.rating),
    reviewAdelinas: Math.max(0, stats.reviewAdelinas - existing.adelinasEarned),
  })

  batch.update(userRef, {
    gamification: nextGamification,
    xp: nextGamification.xp,
    adelinas: nextGamification.adelinas,
  })

  await batch.commit().catch((error) => {
    throw new Error(getFirestoreErrorMessage(error, 'save'))
  })
  return nextGamification
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

  const createdAt = existingReply?.createdAt ?? new Date()

  return {
    text: trimmed,
    createdAt,
    updatedAt: new Date(),
  }
}
