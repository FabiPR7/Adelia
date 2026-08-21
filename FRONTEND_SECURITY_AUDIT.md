# 🔍 Auditoría de Seguridad del Frontend

## 🚨 VULNERABILIDADES CRÍTICAS ENCONTRADAS

### 1. 🔴 CRÍTICO: Creación de Empresas desde Frontend

**Archivo**: `src/services/adminCompanies.ts`
**Función**: `createAuthUser()` líneas 27-53

#### Problema:
```typescript
const AUTH_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY

async function createAuthUser(email: string, password: string): Promise<string> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${AUTH_API_KEY}`,
    // ...
  )
}
```

**Vulnerabilidad**:
- ✅ Las reglas de Firestore SÍ requieren `isAdmin()` para crear empresas
- ❌ PERO la creación del usuario de Firebase Auth NO está protegida
- ❌ Cualquiera con acceso al código puede llamar a la API pública y crear usuarios de Auth
- ❌ Aunque no puedan crear el documento en Firestore, ya crearon un usuario Auth huérfano

#### Impacto:
- Usuarios Auth huérfanos en el sistema
- Posible saturación de la base de usuarios
- Difícil de limpiar usuarios Auth sin documentos asociados

#### Solución Recomendada:
**MOVER A CLOUD FUNCTION**

Crear Cloud Function protegida:
```typescript
// functions/src/adminCreateCompany.ts
export const adminCreateCompany = onCall(
  { region: 'europe-west1' },
  async (request) => {
    // Verificar que el usuario es admin
    if (!request.auth || !(await isAdmin(request.auth.uid))) {
      throw new HttpsError('permission-denied', 'Solo admin puede crear empresas')
    }
    
    // Crear usuario con Admin SDK (privilegiado)
    const userRecord = await admin.auth().createUser({
      email: data.email,
      password: data.password,
    })
    
    // Crear empresa en Firestore
    // ...
  }
)
```

**Cambiar frontend**:
```typescript
// src/services/adminCompanies.ts
export async function createCompany(payload: CreateCompanyPayload) {
  const createCompanyFn = httpsCallable(functions, 'adminCreateCompany')
  const result = await createCompanyFn(payload)
  return result.data
}
```

---

### 2. 🟡 MEDIO: API Keys Expuestas en Frontend

**Archivos afectados**:
- `src/config/firebase.ts` - Firebase config (NORMAL)
- `src/services/adminCompanies.ts` - `VITE_FIREBASE_API_KEY` (PROBLEMA)

#### Estado Actual:
```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
```

#### Análisis:
✅ **Firebase Config Keys son públicas por diseño**
- Es NORMAL que estén en el frontend
- La seguridad viene de las reglas de Firestore/Auth
- Google lo documenta como práctica correcta

❌ **Uso directo de API Key para crear usuarios**
- El problema NO es que la key esté expuesta
- El problema es que se usa para llamar API pública de Auth
- Debería usarse Admin SDK desde backend

#### Solución:
- Las keys de Firebase pueden quedar expuestas (es normal)
- ELIMINAR llamadas directas a API de Auth desde frontend
- Usar Cloud Functions con Admin SDK

---

### 3. 🟢 VERIFICADO: Protección contra Inyección

**Estado**: ✅ **SEGURO**

#### Firestore:
```typescript
// ✅ SEGURO - Usa parámetros nativos
const loginSnap = await getDoc(doc(db, 'logins', normalized))
const companyBySlug = await getDocs(
  query(collection(db, 'companies'), where('slug', '==', normalized))
)
```

**Conclusión**: Firebase Firestore usa queries parametrizadas nativas. NO es vulnerable a inyección SQL/NoSQL.

---

### 4. 🟢 VERIFICADO: Operaciones de Pago

**Archivos revisados**:
- `src/services/reservationDepositApi.ts`
- `src/services/publicDepositApi.ts`
- `src/components/booking/ReservationDepositPayment.tsx`

#### Análisis:
✅ **Stripe se maneja correctamente**:
- ✅ `clientSecret` viene del backend (no se crea en frontend)
- ✅ Pagos procesados por Stripe.js (seguro)
- ✅ Confirmación de pago valida en backend

```typescript
// ✅ CORRECTO - El backend crea el PaymentIntent
const { clientSecret } = await fetch('/api/create-payment-intent')

// ✅ CORRECTO - Solo se confirma en frontend
await stripe.confirmCardPayment(clientSecret)
```

**Conclusión**: Los pagos están bien implementados.

---

### 5. 🟡 MEDIO: Cálculos de Precios en Frontend

**Archivo**: `src/utils/minimumSpendVerification.ts`

#### Código:
```typescript
export function sumProductCartCents(
  quantities: ProductCartQuantities,
  products: Array<{ id: string; priceCents: number | null }>,
): number {
  let total = 0
  for (const [nodeId, quantity] of Object.entries(quantities)) {
    const product = products.find((item) => item.id === nodeId)
    total += product.priceCents * quantity
  }
  return total
}
```

#### Análisis:
⚠️ **Depende de dónde se use**:
- Si es solo para UI (mostrar total) → OK
- Si se envía al backend para validar → DEBE re-calcularse en backend

#### Recomendación:
**VERIFICAR** que el backend siempre recalcule totales y NO confíe en valores del frontend.

---

## 📋 Otras Observaciones

### Variables de Entorno Expuestas

#### ✅ NORMALES (pueden estar en frontend):
```env
VITE_FIREBASE_API_KEY=...           # Público por diseño
VITE_FIREBASE_PROJECT_ID=...        # Público por diseño
VITE_STRIPE_PUBLISHABLE_KEY=pk_...  # Clave PÚBLICA de Stripe
VITE_CLOUDINARY_CLOUD_NAME=...      # Público
VITE_CLOUDINARY_UPLOAD_PRESET=...   # Si es unsigned, OK
VITE_MAPTILER_API_KEY=...           # Limitado por dominio
```

#### ❌ NUNCA en frontend:
```env
STRIPE_SECRET_KEY=sk_...            # Solo backend ✅ (no está en frontend)
RESEND_API_KEY=...                  # Solo backend ✅ (no está en frontend)
```

**Estado**: ✅ Correcto, las keys secretas NO están en frontend.

---

### Operaciones Directas a Firestore

**Total de operaciones**: 10 archivos usan `setDoc/updateDoc/deleteDoc`

#### Análisis:
✅ **Todas están protegidas por reglas de Firestore**
- `match /companies/{companyId}` - `allow create: if isAdmin()`
- `match /users/{userId}` - `allow create: if isSelf(userId) && isValidCustomerCreate()`
- `match /reservations/{reservationId}` - Solo dueño o admin

**Conclusión**: Las reglas de Firestore proporcionan seguridad adecuada.

---

## 🎯 Plan de Acción Recomendado

### Prioridad ALTA (hacer AHORA):
1. **Mover creación de empresas a Cloud Function**
   - [ ] Crear `functions/src/adminCreateCompany.ts`
   - [ ] Implementar verificación de admin
   - [ ] Usar Admin SDK para crear usuario
   - [ ] Actualizar `src/services/adminCompanies.ts` para llamar a Cloud Function
   - [ ] Eliminar función `createAuthUser()` del frontend

### Prioridad MEDIA (próxima iteración):
2. **Verificar recálculo de precios en backend**
   - [ ] Auditar endpoints que reciben totales
   - [ ] Asegurar que backend recalcula todo
   - [ ] Nunca confiar en montos del frontend

### Prioridad BAJA (mejora futura):
3. **Rate limiting adicional**
   - [ ] Limitar llamadas a Cloud Functions
   - [ ] Considerar CAPTCHA para formularios públicos

---

## ✅ Aspectos Seguros (NO requieren cambios)

1. ✅ Contraseñas hasheadas (Firebase Auth)
2. ✅ Sistema de bloqueo de cuenta implementado
3. ✅ Protección contra inyección SQL/NoSQL
4. ✅ Pagos con Stripe (clientSecret desde backend)
5. ✅ Reglas de Firestore bien configuradas
6. ✅ Keys secretas NO expuestas en frontend
7. ✅ Mensajes de error unificados

---

## 📊 Resumen Ejecutivo

| Categoría | Estado | Acción |
|-----------|--------|--------|
| **Creación de empresas** | 🔴 CRÍTICO | Mover a Cloud Function |
| **API Keys** | 🟢 OK | Público por diseño Firebase |
| **Inyección SQL/NoSQL** | 🟢 SEGURO | No requiere acción |
| **Pagos Stripe** | 🟢 SEGURO | Bien implementado |
| **Cálculos de precio** | 🟡 REVISAR | Verificar backend recalcula |
| **Reglas Firestore** | 🟢 SEGURO | Bien configuradas |
| **Secretos expuestos** | 🟢 SEGURO | Ninguno expuesto |

**Conclusión General**: El sistema es mayormente seguro, con **1 vulnerabilidad crítica** que debe corregirse (creación de empresas desde frontend).
