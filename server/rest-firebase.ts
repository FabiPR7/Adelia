import {
  apiKey,
  databaseId,
  hasServiceAccount,
  projectId,
} from './firebase-admin.ts'

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(databaseId)}/documents`

function toFirestoreValue(value: unknown): Record<string, unknown> {
  if (value === null) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'number') return { integerValue: String(value) }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (value instanceof Date) return { timestampValue: value.toISOString() }

  if (typeof value === 'object' && value !== null) {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, item]) => [
            key,
            toFirestoreValue(item),
          ]),
        ),
      },
    }
  }

  throw new Error(`Tipo Firestore no soportado: ${typeof value}`)
}

function toFirestoreFields(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)]),
  )
}

export async function verifyIdTokenWithRest(idToken: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error?.message ?? 'Token inválido.')
  }

  const user = data.users?.[0]

  if (!user?.localId) {
    throw new Error('Token inválido.')
  }

  return {
    uid: user.localId as string,
    email: user.email as string | undefined,
  }
}

export async function getUserRoleWithRest(idToken: string, uid: string) {
  const response = await fetch(`${FIRESTORE_BASE}/users/${uid}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  })

  if (!response.ok) {
    throw new Error('No se pudo leer el perfil del usuario.')
  }

  const data = await response.json()
  return data.fields?.role?.stringValue as string | undefined
}

export async function signInWithPasswordRest(email: string, password: string) {
  if (!apiKey) {
    throw new Error('Falta VITE_FIREBASE_API_KEY en la API.')
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error?.message ?? 'Contraseña incorrecta.')
  }

  return data
}

export async function createAuthUserWithRest(email: string, password: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error?.message ?? 'No se pudo crear el usuario Auth.')
  }

  return {
    uid: data.localId as string,
  }
}

export async function setFirestoreDocWithRest(
  idToken: string,
  docPath: string,
  payload: Record<string, unknown>,
) {
  const url = `${FIRESTORE_BASE}/${docPath}`

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: toFirestoreFields(payload) }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error?.message ?? 'No se pudo escribir en Firestore.')
  }

  return data
}

export function getAdminAuthMode() {
  return hasServiceAccount ? 'admin-sdk' : 'rest'
}
