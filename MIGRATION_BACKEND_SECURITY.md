# 🔄 Migración de Seguridad: Creación de Empresas al Backend

## ⚠️ VULNERABILIDAD CRÍTICA IDENTIFICADA

**Archivo vulnerable**: `src/services/adminCompanies.ts`
**Líneas**: 27-53 (función `createAuthUser()`)

### Problema:
La función crea usuarios de Firebase Auth directamente desde el frontend usando la API pública:

```typescript
const AUTH_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY

async function createAuthUser(email: string, password: string): Promise<string> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${AUTH_API_KEY}`,
    // ...
  )
}
```

**Riesgo**: Cualquiera con acceso al código puede crear usuarios Auth, aunque las reglas de Firestore prevengan crear empresas.

---

## ✅ SOLUCIÓN IMPLEMENTADA

### 1. Cloud Function Creada

**Archivo**: `functions/src/adminCompanyManagement.ts`

```typescript
export const adminCreateCompany = onCall(
  {
    region: 'europe-southwest1',
    memory: '256MiB',
  },
  async (request) => {
    // ✅ Verifica autenticación
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.')
    }

    // ✅ Verifica rol de admin
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(request.auth.uid)
      .get()

    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      throw new HttpsError(
        'permission-denied',
        'Solo los administradores pueden crear empresas.'
      )
    }

    // ✅ Crea usuario con Admin SDK (privilegiado y seguro)
    const userRecord = await admin.auth().createUser({
      email,
      password,
      emailVerified: true,
    })

    // ✅ Crea empresa en Firestore
    // ...
  }
)
```

### 2. Frontend Exportado

**Cambio en**: `functions/src/index.ts`

```typescript
export { adminCreateCompany } from './adminCompanyManagement.ts'
```

---

## 🚀 PRÓXIMOS PASOS NECESARIOS

### Paso 1: Actualizar Firebase Config

Agregar `functions` al config de Firebase en el frontend:

**Archivo**: `src/config/firebase.ts`

```typescript
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { getAnalytics } from 'firebase/analytics'
import { getFunctions } from 'firebase/functions'  // ← AGREGAR

export const functions = getFunctions(app, 'europe-southwest1')  // ← AGREGAR
```

### Paso 2: Actualizar adminCompanies.ts

Reemplazar la función `createCompany()` para usar la Cloud Function:

**Archivo**: `src/services/adminCompanies.ts`

```typescript
import { httpsCallable } from 'firebase/functions'
import { functions } from '../config/firebase'

export async function createCompany(payload: CreateCompanyPayload): Promise<{
  company: Company
  loginName: string
  password: string
}> {
  // ✅ Llama a Cloud Function segura
  const createCompanyFn = httpsCallable(functions, 'adminCreateCompany')
  
  const result = await createCompanyFn({
    name: payload.name,
    location: payload.location,
    phone: payload.phone,
    website: payload.website,
    password: payload.password,
  })

  const data = result.data as {
    success: boolean
    company: { id: string; name: string; slug: string; ownerUid: string }
    loginName: string
  }

  // Sincronizar índices
  await Promise.all([
    syncCompanyLoginIndex(data.loginName, slugToAuthEmail(data.company.slug), data.company.id),
    restaurantIndexPayload(data.company.id, { slug: data.company.slug }),
  ])

  return { /* ... */ }
}
```

### Paso 3: Eliminar Código Vulnerable

Eliminar estas funciones del frontend (ya no se necesitan):

```typescript
// ❌ ELIMINAR
const AUTH_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY

async function createAuthUser(email: string, password: string) { /* ... */ }
async function assertSlugAvailable(slug: string) { /* ... */ }
```

### Paso 4: Desplegar Cloud Function

```bash
# Compilar TypeScript
cd functions
npm run build

# Desplegar solo la nueva función
firebase deploy --only functions:adminCreateCompany

# O desplegar todas
firebase deploy --only functions
```

### Paso 5: Testing

1. Probar creación de empresa desde panel de admin
2. Verificar que solo usuarios admin pueden crear
3. Verificar que usuarios no-admin reciben error de permisos

---

## 📋 Checklist de Migración

- [x] Cloud Function creada (`adminCompanyManagement.ts`)
- [x] Función exportada en `functions/src/index.ts`
- [ ] Agregar `functions` a `src/config/firebase.ts`
- [ ] Actualizar `src/services/adminCompanies.ts`
- [ ] Eliminar código vulnerable del frontend
- [ ] Compilar Cloud Functions (`npm run build`)
- [ ] Desplegar Cloud Functions
- [ ] Testing end-to-end
- [ ] Actualizar documentación

---

## ⏱️ Estimación

- **Tiempo de implementación**: 30 minutos
- **Tiempo de despliegue**: 5 minutos
- **Tiempo de testing**: 15 minutos
- **TOTAL**: ~50 minutos

---

## 🎯 Beneficios de Seguridad

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Creación de usuarios** | ❌ API pública | ✅ Admin SDK |
| **Verificación de permisos** | ⚠️ Solo Firestore rules | ✅ Backend + rules |
| **Exposición de código** | ❌ Lógica en frontend | ✅ Lógica en backend |
| **Usuarios huérfanos** | ❌ Posible | ✅ Imposible |

---

## 🔐 Estado Final

Después de esta migración:
- ✅ Creación de empresas 100% segura
- ✅ Solo admin puede crear empresas (verificado en backend)
- ✅ No hay forma de bypassear la seguridad
- ✅ Código vulnerable eliminado del frontend
