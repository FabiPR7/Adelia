import 'dotenv/config'

const API_KEY = process.env.VITE_FIREBASE_API_KEY
const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID
const DATABASE_ID = process.env.VITE_FIREBASE_DATABASE_ID || '(default)'
const AUTH_DOMAIN = 'adelia.app'

const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${encodeURIComponent(DATABASE_ID)}/documents`

const SEED_USERS = [
  {
    loginName: 'Fabian',
    email: `fabian@${AUTH_DOMAIN}`,
    password: 'Adelia2026',
    role: 'admin',
    companyId: null,
  },
]

const defaultSchedule = {
  monday: { open: '13:00', close: '23:00', active: true },
  tuesday: { open: '13:00', close: '23:00', active: true },
  wednesday: { open: '', close: '', active: false },
  thursday: { open: '13:00', close: '23:00', active: true },
  friday: { open: '13:00', close: '23:30', active: true },
  saturday: { open: '13:00', close: '23:30', active: true },
  sunday: { open: '13:00', close: '16:00', active: true },
}

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toFirestoreValue(value) {
  if (value === null) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'number') return { integerValue: String(value) }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (value instanceof Date) return { timestampValue: value.toISOString() }

  if (typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, toFirestoreValue(item)]),
        ),
      },
    }
  }

  throw new Error(`Tipo no soportado: ${typeof value}`)
}

function toFirestoreFields(data) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)]),
  )
}

async function createOrGetAuthUser(email, password) {
  const signUpResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )

  const signUpData = await signUpResponse.json()

  if (signUpResponse.ok) {
    return { uid: signUpData.localId, idToken: signUpData.idToken }
  }

  if (signUpData.error?.message === 'EMAIL_EXISTS') {
    const signInResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    )

    const signInData = await signInResponse.json()

    if (signInResponse.ok) {
      return { uid: signInData.localId, idToken: signInData.idToken }
    }

    const legacyPasswords = ['Adelia@Admin2026', 'Taqueria@2026', 'Rincon@2026']

    for (const legacyPassword of legacyPasswords) {
      if (legacyPassword === password) continue

      const legacySignIn = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password: legacyPassword,
            returnSecureToken: true,
          }),
        },
      )

      const legacyData = await legacySignIn.json()

      if (legacySignIn.ok) {
        await updatePassword(legacyData.idToken, password)
        return { uid: legacyData.localId, idToken: legacyData.idToken }
      }
    }

    throw new Error(
      `Usuario ${email} ya existe pero la contraseña no coincide. Revisa Firebase Auth.`,
    )
  }

  throw new Error(signUpData.error?.message ?? 'Error creando usuario')
}

async function updatePassword(idToken, password) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        password,
        returnSecureToken: true,
      }),
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error?.message ?? 'No se pudo actualizar la contraseña')
  }

  return data
}

async function setDocument(idToken, docPath, data) {
  const url = `${FIRESTORE_BASE}/${docPath}`

  const response = await fetch(`${url}?currentDocument.exists=true`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  }).catch(() => null)

  if (response?.ok) {
    return response.json()
  }

  const createResponse = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  })

  const body = await createResponse.json()

  if (!createResponse.ok) {
    const reason = body.error?.message ?? createResponse.statusText

    if (reason.includes('NOT_FOUND') && reason.includes('database')) {
      throw new Error(
        `La base de datos Firestore "${DATABASE_ID}" no existe. Créala en Firebase Console → Firestore → Create database.`,
      )
    }

    if (reason.includes('PERMISSION_DENIED') || createResponse.status === 403) {
      throw new Error(
        'Permiso denegado en Firestore. Usa firestore.rules.bootstrap, publica, y vuelve a ejecutar npm run seed.',
      )
    }

    throw new Error(reason)
  }

  return body
}

async function writeFirestoreSeed(adminToken, users) {
  const now = new Date()

  for (const user of users) {
    await setDocument(adminToken, `users/${user.uid}`, {
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      loginName: user.loginName,
      createdAt: now,
    })

    await setDocument(adminToken, `logins/${slugify(user.loginName)}`, {
      loginName: user.loginName,
      authEmail: user.email,
      role: user.role,
    })
  }
}

function printCredentials() {
  console.log('\nCredenciales de acceso:\n')

  for (const user of SEED_USERS) {
    console.log(user.role === 'admin' ? 'ADMIN' : `EMPRESA — ${user.loginName}`)
    console.log(`  Nombre:     ${user.loginName}`)
    console.log(`  Contraseña: ${user.password}\n`)
  }
}

async function seed() {
  if (!API_KEY || !PROJECT_ID) {
    throw new Error('Faltan variables VITE_FIREBASE_API_KEY o VITE_FIREBASE_PROJECT_ID en .env')
  }

  console.log(`Proyecto: ${PROJECT_ID}`)
  console.log(`Base de datos Firestore: ${DATABASE_ID}\n`)
  console.log('Creando usuarios en Firebase Auth…')

  const users = []

  for (const seedUser of SEED_USERS) {
    const authUser = await createOrGetAuthUser(seedUser.email, seedUser.password)
    users.push({ ...seedUser, uid: authUser.uid, idToken: authUser.idToken })
  }

  const adminUser = users.find((user) => user.role === 'admin')

  console.log('Usuarios Auth listos. Escribiendo Firestore…')

  try {
    await writeFirestoreSeed(adminUser.idToken, users)
    console.log('\n✅ Seed completado (Auth + Firestore).\n')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    console.log('\n⚠️  Usuarios Auth OK, pero Firestore falló.')
    console.log(`    ${message}\n`)
    console.log('    Sin Firestore la app no puede cargar datos reales.\n')
  }

  printCredentials()
}

seed().catch((error) => {
  console.error('❌ Error en seed:', error.message)
  process.exit(1)
})
