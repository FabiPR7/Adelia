import { collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import { db } from '../config/firebase'

export function favoriteDocId(userId: string, slug: string): string {
  return `${userId}_${slug}`
}

export async function replaceUserFavorites(userId: string, slugs: string[]): Promise<void> {
  const snapshot = await getDocs(
    query(collection(db, 'userFavorites'), where('userId', '==', userId), limit(50)),
  )
  const next = new Set(slugs)
  const writes: Promise<unknown>[] = []

  snapshot.docs.forEach((item) => {
    const slug = String(item.data().slug ?? '')
    if (!next.has(slug)) {
      writes.push(deleteDoc(item.ref))
    }
  })

  slugs.forEach((slug) => {
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
    return snapshot.docs.map((item) => String(item.data().slug ?? '')).filter(Boolean)
  } catch {
    return []
  }
}
