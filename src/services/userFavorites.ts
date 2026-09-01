import { collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '../config/firebase'

export function favoriteDocId(userId: string, slug: string): string {
  return `${userId}_${slug}`
}

export async function replaceUserFavorites(userId: string, slugs: string[]): Promise<void> {
  const snapshot = await getDocs(
    query(collection(db, 'userFavorites'), where('userId', '==', userId), limit(50)),
  )
  const next = new Set(slugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean))
  const writes: Promise<unknown>[] = []

  snapshot.docs.forEach((item) => {
    const slug = String(item.data().slug ?? '').trim().toLowerCase()
    if (!next.has(slug)) {
      writes.push(deleteDoc(item.ref))
    }
  })

  next.forEach((slug) => {
    writes.push(setDoc(doc(db, 'userFavorites', favoriteDocId(userId, slug)), {
      userId,
      slug,
      createdAt: serverTimestamp(),
    }, { merge: true }))
  })

  await Promise.all(writes)
}

export async function listUserFavoriteSlugs(userId: string): Promise<string[]> {
  try {
    const snapshot = await getDocs(
      query(collection(db, 'userFavorites'), where('userId', '==', userId), limit(50)),
    )
    return [...new Set(
      snapshot.docs
        .map((item) => String(item.data().slug ?? '').trim().toLowerCase())
        .filter(Boolean),
    )]
  } catch {
    return []
  }
}
