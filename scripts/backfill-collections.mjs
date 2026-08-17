/**
 * Rellena las colecciones nuevas desde los docs gordos existentes.
 *   node scripts/backfill-collections.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ?? path.join(root, 'serviceAccountKey.json')
const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || 'adelia'

if (!existsSync(serviceAccountPath)) {
  console.error('Falta serviceAccountKey.json')
  process.exit(1)
}

initializeApp({
  credential: cert(JSON.parse(readFileSync(serviceAccountPath, 'utf8'))),
})

const db = getFirestore(undefined, databaseId)

function friendshipId(a, b) {
  return [a, b].sort().join('_')
}

function restaurantIndexPayload(companyId, data) {
  const photos = Array.isArray(data.photos) ? data.photos.filter((item) => typeof item === 'string') : []
  const characteristics = Array.isArray(data.characteristics)
    ? data.characteristics.filter((item) => typeof item === 'string').slice(0, 8)
    : []
  const logoUrl = typeof data.logoUrl === 'string' ? data.logoUrl : ''
  const name = typeof data.name === 'string' ? data.name : ''
  const location = typeof data.location === 'string' ? data.location : ''
  const municipality = typeof data.municipality === 'string' ? data.municipality : ''
  const country = typeof data.country === 'string' ? data.country : ''
  const description = typeof data.description === 'string' ? data.description : ''
  const postalCode = typeof data.postalCode === 'string' ? data.postalCode : ''
  const videos = Array.isArray(data.videos) ? data.videos : []

  return {
    companyId,
    name,
    slug: typeof data.slug === 'string' ? data.slug : '',
    location,
    municipality,
    country,
    postalCode,
    latitude: typeof data.latitude === 'number' ? data.latitude : null,
    longitude: typeof data.longitude === 'number' ? data.longitude : null,
    photoUrl: photos[0] ?? logoUrl,
    logoUrl,
    characteristics,
    searchText: [name, location, municipality, country, description, ...characteristics].join(' ').toLowerCase(),
    reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : 0,
    reviewRatingSum: typeof data.reviewRatingSum === 'number' ? data.reviewRatingSum : 0,
    reviewAdelinas: typeof data.reviewAdelinas === 'number' ? data.reviewAdelinas : 0,
    hasProfile: Boolean(
      description || municipality || postalCode || country || characteristics.length || photos.length || videos.length,
    ),
    updatedAt: FieldValue.serverTimestamp(),
  }
}

const companies = await db.collection('companies').get()
let indexed = 0
for (const docSnap of companies.docs) {
  await db.collection('restaurantIndex').doc(docSnap.id).set(restaurantIndexPayload(docSnap.id, docSnap.data()), { merge: true })
  indexed += 1
}
console.log(`restaurantIndex: ${indexed}`)

const users = await db.collection('users').get()
let stats = 0
let names = 0
let friendPairs = 0
for (const userSnap of users.docs) {
  const data = userSnap.data()
  if (data.role === 'customer') {
    const displayName = typeof data.displayName === 'string' ? data.displayName : ''
    if (displayName && !data.displayNameLower) {
      await userSnap.ref.set({ displayNameLower: displayName.toLowerCase() }, { merge: true })
      names += 1
    }
    const gamification = data.gamification && typeof data.gamification === 'object' ? data.gamification : { xp: data.xp ?? 0, adelinas: data.adelinas ?? 0 }
    await db.collection('userGamification').doc(userSnap.id).set({
      uid: userSnap.id,
      xp: typeof gamification.xp === 'number' ? gamification.xp : 0,
      adelinas: typeof gamification.adelinas === 'number' ? gamification.adelinas : 0,
      state: gamification,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    stats += 1

    const friendsSnap = await userSnap.ref.collection('friends').get()
    for (const friendDoc of friendsSnap.docs) {
      const other = friendDoc.id
      const pairId = friendshipId(userSnap.id, other)
      const [low, high] = [userSnap.id, other].sort()
      await db.collection('friendships').doc(pairId).set({
        userLow: low,
        userHigh: high,
        userIds: [userSnap.id, other],
        createdAt: friendDoc.data().since ?? FieldValue.serverTimestamp(),
      }, { merge: true })
      friendPairs += 1
    }
  }
}
console.log(`userGamification: ${stats}. displayNameLower: ${names}. friendships from legacy: ${friendPairs}.`)

let opsCopied = 0
for (const docSnap of companies.docs) {
  const data = docSnap.data()
  const payload = {}
  if (data.emailTemplates) payload.emailTemplates = data.emailTemplates
  if (typeof data.stripeAccountId === 'string') payload.stripeAccountId = data.stripeAccountId
  if (typeof data.stripeChargesEnabled === 'boolean') payload.stripeChargesEnabled = data.stripeChargesEnabled
  if (typeof data.stripePayoutsEnabled === 'boolean') payload.stripePayoutsEnabled = data.stripePayoutsEnabled
  if (typeof data.stripeDetailsSubmitted === 'boolean') payload.stripeDetailsSubmitted = data.stripeDetailsSubmitted
  if (Object.keys(payload).length > 0) {
    await docSnap.ref.collection('private').doc('ops').set({
      ...payload,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    opsCopied += 1
  }
}
console.log(`company private/ops: ${opsCopied}`)

let claimsCopied = 0
for (const userSnap of users.docs) {
  const data = userSnap.data()
  if (data.role !== 'customer') continue
  const gamification = data.gamification && typeof data.gamification === 'object' ? data.gamification : {}
  const claims = Array.isArray(gamification.claimedPromotions) ? gamification.claimedPromotions : []
  for (const [index, claim] of claims.entries()) {
    if (!claim || typeof claim !== 'object') continue
    const promotionId = typeof claim.promotionId === 'string' ? claim.promotionId : ''
    const reservationId = typeof claim.reservationId === 'string' ? claim.reservationId : ''
    if (!promotionId) continue
    const claimId = reservationId
      ? `${userSnap.id}_${reservationId}_${promotionId}`
      : `${userSnap.id}_${promotionId}_${index + 1}`
    await db.collection('promotionClaims').doc(claimId).set({
      customerUid: userSnap.id,
      ...claim,
    }, { merge: true })
    claimsCopied += 1
  }

  const favoriteSlugs = Array.isArray(data.favoriteSlugs) ? data.favoriteSlugs : []
  for (const slug of favoriteSlugs) {
    if (typeof slug !== 'string' || !slug) continue
    await db.collection('userFavorites').doc(`${userSnap.id}_${slug}`).set({
      userId: userSnap.id,
      slug,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true })
  }
}
console.log(`promotionClaims from user docs: ${claimsCopied}`)

let reviewsIndexed = 0
for (const companySnap of companies.docs) {
  const reviewsSnap = await companySnap.ref.collection('reviews').get()
  for (const reviewDoc of reviewsSnap.docs) {
    const review = reviewDoc.data()
    const customerUid = typeof review.customerUid === 'string' ? review.customerUid : reviewDoc.id
    await db.collection('reviewIndex').doc(`${companySnap.id}_${customerUid}`).set({
      companyId: companySnap.id,
      companyName: companySnap.data().name ?? 'Restaurante',
      companySlug: companySnap.data().slug ?? '',
      customerUid,
      reservationId: review.reservationId ?? '',
      rating: review.rating ?? 0,
      hasPhoto: review.hasPhoto === true,
      commentExcerpt: typeof review.comment === 'string' ? review.comment.slice(0, 180) : '',
      createdAt: review.createdAt ?? FieldValue.serverTimestamp(),
    }, { merge: true })
    reviewsIndexed += 1
  }

  const consumptions = await companySnap.ref.collection('verifiedConsumptions').get()
  for (const item of consumptions.docs) {
    const data = item.data()
    const customerUid = typeof data.customerUid === 'string' ? data.customerUid : ''
    if (!customerUid) continue
    await db.collection('productClaims').doc(`${customerUid}_${item.id}`).set({
      customerUid,
      companyId: companySnap.id,
      reservationId: item.id,
      clientName: data.clientName ?? '',
      promotionId: data.promotionId ?? null,
      mode: data.mode ?? 'total',
      totalCents: data.totalCents ?? 0,
      lineItems: data.lineItems ?? [],
      verifiedAt: data.verifiedAt ?? FieldValue.serverTimestamp(),
    }, { merge: true })
  }
}
console.log(`reviewIndex: ${reviewsIndexed}`)
