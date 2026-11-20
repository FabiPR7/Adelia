import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { db } from '../config/firebase'

// Solo lectura del formato antiguo de favoritos (cuentas viejas). Los favoritos se
// guardan por la API (/api/customer/favorites); desde aquí ya no se escribe nada.
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
