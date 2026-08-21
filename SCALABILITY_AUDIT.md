# 🚀 Auditoría de Escalabilidad - Adelia

## 📊 Análisis de Capacidad Actual

### Estado Actual del Sistema

#### ✅ **LO QUE YA TENEMOS (Bueno)**

1. **Transacciones Atómicas** ✅
   - `createReservation` usa `runTransaction` para prevenir race conditions
   - Previene overbooking efectivamente
   - **Límite**: ~500-1000 transacciones/segundo por colección

2. **Cloud Functions con Auto-scaling** ✅
   - `maxInstances: 100` en `createReservation`
   - Firebase escala automáticamente
   - **Límite**: 100 instancias concurrentes = ~1,000-3,000 req/s

3. **Firestore (Serverless)** ✅
   - Escala automáticamente
   - **Límites**:
     - 10,000 escrituras/segundo por colección
     - 50,000 lecturas/segundo
     - 1,000,000 conexiones simultáneas

4. **Firebase Auth** ✅
   - Escala automáticamente
   - **Sin límite** de usuarios simultáneos

---

## ⚠️ **PROBLEMAS CRÍTICOS (Cuellos de Botella)**

### 1. 🔴 **NO HAY RATE LIMITING BACKEND**

**Problema:**
```typescript
// ❌ Cualquiera puede llamar Cloud Functions sin límite
export const createReservation = onCall({ ... }, async (request) => {
  // Sin rate limiting
})
```

**Impacto:**
- Un atacante puede hacer **1000+ requests/segundo** y:
  - Consumir toda tu cuota de Firebase ($$$ factura enorme)
  - Saturar Firestore (10,000 escrituras/s límite)
  - Bloquear usuarios legítimos (DoS attack)

**Solución:** Implementar rate limiting en Cloud Functions

---

### 2. 🔴 **NO HAY CACHING**

**Problema:**
```typescript
// ❌ Cada request lee Firestore directamente
const companySnap = await companyRef.get() // Lee Firestore SIEMPRE
```

**Impacto:**
- Miles de usuarios consultando empresas = miles de lecturas Firestore
- **Ejemplo**: 10,000 usuarios buscando restaurantes = 10,000 lecturas Firestore
- **Coste**: $0.36 por millón de lecturas (sin cache)

**Solución:** Implementar Redis o Firestore cache

---

### 3. 🟡 **FALTA DE ÍNDICES COMPUESTOS**

**Problema:**
```typescript
// ❌ Query sin índice compuesto
const reservationsSnap = await db
  .collection('reservations')
  .where('companyId', '==', companyId)
  .where('date', '==', dateIso)
  .where('time', '==', time)
  .where('status', 'in', ['pending', 'confirmed'])
  .get()
// Sin índice compuesto = LENTO (>1s con 10,000+ docs)
```

**Impacto:**
- Queries lentas (>1-3 segundos)
- Timeout en Cloud Functions (540s límite, pero UX mala)

**Solución:** Crear índices compuestos en Firestore

---

### 4. 🟡 **NO HAY SISTEMA DE COLAS**

**Problema:**
```typescript
// ❌ Operaciones pesadas directamente en Cloud Functions
await sendEmail(reservation) // Bloquea la función
await sendNotification(user)  // Bloquea la función
```

**Impacto:**
- Cloud Function espera a que termine email + notificación
- Timeout si servicio externo es lento
- **Facturación alta**: pagas por tiempo de espera

**Solución:** Queue system (Cloud Tasks / Pub/Sub)

---

### 5. 🟡 **FALTA CIRCUIT BREAKERS**

**Problema:**
```typescript
// ❌ Si Stripe falla, toda la función falla
await stripe.paymentIntents.create({ ... })
// Sin retry, sin fallback
```

**Impacto:**
- Si Stripe/Cloudinary/Sendgrid caen, tu app cae
- Usuarios ven errores innecesarios

**Solución:** Circuit breakers + retry logic

---

### 6. 🟡 **NO HAY MONITOREO DE PERFORMANCE**

**Problema:**
- No sabemos qué Cloud Functions son lentas
- No sabemos qué queries Firestore son caras
- No hay alertas si hay spike de tráfico

**Solución:** Firebase Performance Monitoring + Cloud Monitoring

---

### 7. 🟡 **HOT SPOTS EN FIRESTORE**

**Problema:**
```typescript
// ❌ Todos escriben en el mismo documento de stats
transaction.update(statsRef, {
  totalReservations: admin.firestore.FieldValue.increment(1)
})
// Si 1000 usuarios reservan simultáneamente = contention
```

**Impacto:**
- **Límite de escrituras**: 1 documento = max 500 escrituras/segundo
- Con más tráfico = errores de contention

**Solución:** Distributed counters (sharding)

---

## 📈 **CAPACIDAD ESTIMADA**

### Escenario 1: Sin Mejoras (Estado Actual)

| Métrica | Límite | Comentario |
|---------|--------|------------|
| **Usuarios simultáneos** | ~500-1,000 | Limitado por rate limiting frontend |
| **Logins/segundo** | ~100 | Firebase Auth OK, pero sin rate limiting backend |
| **Reservas/segundo** | ~50-100 | Limitado por transacciones Firestore + hot spots |
| **Lecturas/segundo** | ~10,000 | Firestore OK, pero sin cache = caro |
| **Escrituras/segundo** | ~500 | Hot spot en stats = bottleneck |

**Coste estimado con 10,000 usuarios activos/día:**
- Lecturas: 1,000,000/día × $0.36/millón = **$0.36/día** = $10.80/mes
- Escrituras: 50,000/día × $1.08/millón = **$0.054/día** = $1.62/mes
- Cloud Functions: 100,000 invocaciones/día × $0.40/millón = **$0.04/día** = $1.20/mes
- **Total: ~$14/mes** (sin cache)

**Con spike de tráfico (DoS attack):**
- Sin rate limiting = **factura ilimitada** ⚠️

---

### Escenario 2: Con Mejoras (Después de implementar)

| Métrica | Límite | Mejora |
|---------|--------|--------|
| **Usuarios simultáneos** | ~50,000-100,000 | 100x más |
| **Logins/segundo** | ~1,000+ | Rate limiting + cache |
| **Reservas/segundo** | ~500-1,000 | Distributed counters |
| **Lecturas/segundo** | ~100,000+ | Cache (90% hit rate) |
| **Escrituras/segundo** | ~5,000+ | Sharding counters |

**Coste estimado con 10,000 usuarios activos/día:**
- Lecturas: 100,000/día (90% cache) × $0.36/millón = **$0.036/día** = $1.08/mes
- Escrituras: 50,000/día × $1.08/millón = **$0.054/día** = $1.62/mes
- Cloud Functions: 100,000 invocaciones/día × $0.40/millón = **$0.04/día** = $1.20/mes
- Redis cache: **$15/mes** (Upstash free tier = $0, luego $15/mes)
- **Total: ~$18/mes** (con cache, pero 10x más rápido)

**Con spike de tráfico:**
- Rate limiting = **máximo $50/día** controlado

---

## 🎯 **PLAN DE ACCIÓN (Priorizado)**

### 🔴 **PRIORIDAD ALTA** (Implementar YA)

#### 1. Rate Limiting Backend (2-3 horas)
**Por qué:** Previene DoS y controla costes
**Impacto:** Evita factura de $10,000+ en caso de ataque

```typescript
// functions/src/middleware/rateLimiter.ts
import { Redis } from '@upstash/redis'

export async function checkRateLimit(
  userId: string,
  endpoint: string,
  max: number,
  window: number
): Promise<boolean> {
  // Implementar con Redis o Firestore
}
```

#### 2. Índices Compuestos Firestore (1 hora)
**Por qué:** Queries 10-100x más rápidas
**Impacto:** Mejora UX + reduce timeouts

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "reservations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "companyId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "ASCENDING" },
        { "fieldPath": "time", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    }
  ]
}
```

#### 3. Distributed Counters (2 horas)
**Por qué:** Elimina hot spots en stats
**Impacto:** 10x más escrituras/segundo

```typescript
// Dividir counter en 10 shards
const shardId = Math.floor(Math.random() * 10)
const statsRef = db.doc(`companies/${companyId}/stats/reservations_${shardId}`)
```

---

### 🟡 **PRIORIDAD MEDIA** (Implementar esta semana)

#### 4. Caching con Redis/Upstash (3-4 horas)
**Por qué:** Reduce lecturas Firestore 80-90%
**Impacto:** 10x más rápido + reduce costes

```typescript
// Cache company data (changes rarely)
const cachedCompany = await redis.get(`company:${companyId}`)
if (cachedCompany) return cachedCompany
```

#### 5. Queue System con Cloud Tasks (3 horas)
**Por qué:** Offload operaciones pesadas
**Impacto:** Reduce tiempo de respuesta + retry automático

```typescript
// Enviar emails en background
await cloudTasks.createTask({
  queue: 'email-queue',
  payload: { type: 'reservation_confirmation', reservationId }
})
```

#### 6. Firebase Performance Monitoring (1 hora)
**Por qué:** Visibilidad de bottlenecks
**Impacto:** Detect issues proactivamente

```typescript
const trace = firebase.performance().trace('create_reservation')
trace.start()
// ... operation
trace.stop()
```

---

### 🟢 **PRIORIDAD BAJA** (Nice to have)

#### 7. Circuit Breakers (2 horas)
#### 8. Connection Pooling (1 hora)
#### 9. CDN para assets estáticos (30 min)
#### 10. Database read replicas (si usáramos SQL)

---

## 📊 **LÍMITES DE FIREBASE/FIRESTORE**

### Firestore Limits (Plan Blaze)

| Recurso | Límite | Comentario |
|---------|--------|------------|
| **Escrituras/segundo** | 10,000/colección | Con sharding = 100,000+ |
| **Lecturas/segundo** | 50,000/colección | Con cache = ilimitado |
| **Conexiones simultáneas** | 1,000,000 | Más que suficiente |
| **Tamaño máximo documento** | 1 MB | Suficiente |
| **Transacciones/segundo** | 500-1,000/doc | Hot spot = problema |
| **Query results** | 1 MB/query | Usar pagination |

### Cloud Functions Limits

| Recurso | Límite | Comentario |
|---------|--------|------------|
| **Invocaciones/día** | Ilimitado | Pagas por uso |
| **Instancias concurrentes** | 1,000 (default) | Configurable |
| **Tiempo máximo** | 540s (9 min) | 60s gen2, 540s gen1 |
| **Memoria** | 8 GB max | 256MB-512MB suficiente |
| **Cold start** | 1-3s | Usar min instances |

---

## 🎯 **RECOMENDACIÓN FINAL**

### Para 1,000-10,000 usuarios/día:
✅ **Implementar SOLO prioridad ALTA** (5-6 horas trabajo)
- Rate limiting backend
- Índices compuestos
- Distributed counters

**Resultado:** Sistema aguanta 50,000+ usuarios simultáneos

---

### Para 100,000+ usuarios/día:
✅ **Implementar TODO (prioridad ALTA + MEDIA)** (15-20 horas)
- + Caching Redis
- + Queue system
- + Performance monitoring

**Resultado:** Sistema aguanta 500,000+ usuarios simultáneos

---

## 💡 **ARQUITECTURA RECOMENDADA**

```
┌──────────────┐
│   Cliente    │
│  (React)     │
└──────┬───────┘
       │
       │ HTTPS
       ▼
┌──────────────────────┐
│  Firebase Hosting    │ ← CDN (cache estático)
└──────┬───────────────┘
       │
       │ REST/WebSocket
       ▼
┌──────────────────────────────────────────┐
│         Cloud Functions                   │
│  ┌────────────────────────────────────┐  │
│  │  Rate Limiter (Redis/Firestore)    │  │ ← Protección DoS
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  Cache Layer (Redis/Upstash)       │  │ ← 90% cache hit
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  Business Logic                    │  │
│  └────────────────────────────────────┘  │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│         Firestore (Database)             │
│  ┌────────────────────────────────────┐  │
│  │  Compound Indexes                  │  │ ← Fast queries
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  Distributed Counters (sharding)   │  │ ← No hot spots
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  Atomic Transactions               │  │ ← Race condition safe
│  └────────────────────────────────────┘  │
└───────────────────────────────────────────┘

Background Jobs:
┌──────────────────────┐
│  Cloud Tasks Queue   │ ← Emails, notifications
└──────────────────────┘

Monitoring:
┌──────────────────────┐
│  Firebase Performance│ ← Traces, metrics
│  Cloud Monitoring    │ ← Alerts, dashboards
└──────────────────────┘
```

---

## 🚀 **EMPEZAMOS?**

**¿Qué quieres implementar primero?**

1. ✅ **Rate Limiting Backend** (2-3h) - CRÍTICO
2. ✅ **Índices Compuestos** (1h) - RÁPIDO
3. ✅ **Distributed Counters** (2h) - IMPORTANTE
4. ⏸️ **Caching Redis** (3-4h) - NICE TO HAVE
5. ⏸️ **Queue System** (3h) - NICE TO HAVE

**Recomendación:** Empezar por 1, 2, 3 (5-6 horas) = sistema aguanta 50,000+ usuarios
