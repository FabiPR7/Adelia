import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'

interface CreateCompanyPayload {
  name: string
  location: string
  phone: string
  website?: string
  password: string
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function slugToAuthEmail(slug: string): string {
  return `${slug}@adeliareservas.com`
}

function defaultSchedule() {
  return {
    monday: { open: '13:00', close: '16:00', enabled: true },
    tuesday: { open: '13:00', close: '16:00', enabled: true },
    wednesday: { open: '13:00', close: '16:00', enabled: true },
    thursday: { open: '13:00', close: '16:00', enabled: true },
    friday: { open: '13:00', close: '16:00', enabled: true },
    saturday: { open: '13:00', close: '16:00', enabled: true },
    sunday: { open: '13:00', close: '16:00', enabled: true },
  }
}

function defaultTurns() {
  return [{ name: 'Comida', start: '13:00', end: '16:00' }]
}

/**
 * Cloud Function para crear empresas de forma segura
 * Solo puede ser llamada por usuarios con rol 'admin'
 */
export const adminCreateCompany = onCall(
  {
    region: 'europe-southwest1',
    memory: '256MiB',
  },
  async (request) => {
    // Verificar autenticación
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.')
    }

    // Verificar que el usuario es admin
    const userDoc = await admin
      .firestore()
      .collection('users')
      .doc(request.auth.uid)
      .get()

    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      throw new HttpsError(
        'permission-denied',
        'Solo los administradores pueden crear empresas.'
      )
    }

    // Validar payload
    const data = request.data as CreateCompanyPayload
    const { name, location, phone, website, password } = data

    if (!name?.trim() || !location?.trim() || !phone?.trim() || !password) {
      throw new HttpsError('invalid-argument', 'Faltan campos obligatorios.')
    }

    const slug = slugify(name.trim())
    const email = slugToAuthEmail(slug)

    // Verificar que el slug no exista
    const existingCompany = await admin
      .firestore()
      .collection('companies')
      .where('slug', '==', slug)
      .limit(1)
      .get()

    if (!existingCompany.empty) {
      throw new HttpsError('already-exists', 'Ya existe una empresa con ese nombre.')
    }

    try {
      // Crear usuario de Firebase Auth con Admin SDK (privilegiado)
      const userRecord = await admin.auth().createUser({
        email,
        password,
        emailVerified: true,
      })

      const ownerUid = userRecord.uid
      const now = admin.firestore.FieldValue.serverTimestamp()

      // Crear empresa en Firestore
      const companyRef = admin.firestore().collection('companies').doc()
      const companyId = companyRef.id
      const loginId = slug

      const batch = admin.firestore().batch()

      // Documento de empresa
      batch.set(companyRef, {
        name: name.trim(),
        slug,
        ownerUid,
        phone: phone.trim(),
        website: website?.trim() ?? '',
        location: location.trim(),
        photoUrl: '',
        timeSlotMinutes: 120,
        schedule: defaultSchedule(),
        turns: defaultTurns(),
        floorPlan: { tables: [], walls: [] },
        floorPlans: [{ tables: [], walls: [] }],
        emailTemplates: {
          bookingConfirmation: { enabled: false, subject: '', body: '' },
          bookingReminder: { enabled: false, subject: '', body: '' },
          bookingCancellation: { enabled: false, subject: '', body: '' },
        },
        qrBranding: {
          backgroundColor: '#ffffff',
          foregroundColor: '#000000',
          logoEnabled: false,
          logoUrl: '',
        },
        reviewCount: 0,
        reviewRatingSum: 0,
        depositDays: null,
        depositCents: null,
        depositCancellationHours: null,
        stripeAccountId: '',
        showReservationDeposit: false,
        createdAt: now,
      })

      // Documento de usuario
      batch.set(admin.firestore().collection('users').doc(ownerUid), {
        email,
        role: 'company',
        companyId,
        displayName: name.trim(),
        phone: phone.trim(),
        photoUrl: '',
        homeCity: '',
        homeMunicipality: '',
        homeCountry: '',
        homePostalCode: '',
        homeLatitude: null,
        homeLongitude: null,
        foodPreferences: [],
        onboardingCompleted: false,
        authProvider: 'password',
        favoriteSlugs: [],
        gamification: null,
        xp: 0,
        adelinas: 0,
        displayNameLower: name.trim().toLowerCase(),
        mustChangePassword: true,
        createdAt: now,
      })

      // Documento de login
      batch.set(admin.firestore().collection('logins').doc(loginId), {
        authEmail: email,
        loginName: slug,
        role: 'company',
        companyId,
        createdAt: now,
      })

      // Credenciales de empresa
      batch.set(admin.firestore().collection('companyCredentials').doc(companyId), {
        loginName: slug,
        loginPassword: '—',
        updatedAt: now,
      })

      await batch.commit()

      return {
        success: true,
        company: {
          id: companyId,
          name: name.trim(),
          slug,
          ownerUid,
        },
        loginName: slug,
      }
    } catch (error) {
      console.error('Error creating company:', error)
      
      if (error instanceof HttpsError) {
        throw error
      }
      
      throw new HttpsError('internal', 'No se pudo crear la empresa.')
    }
  }
)
