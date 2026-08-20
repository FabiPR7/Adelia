# 🔥 Auditoría Completa de Optimización de Firestore

**Fecha:** 20 Agosto 2026  
**Estado:** En Progreso  
**Objetivo:** Reducir costos de lectura/escritura y mejorar performance

---

## 📊 Resumen Ejecutivo

- **56 archivos** con queries de Firestore
- **19+ queries** sin límite detectadas
- **Problema principal:** Leer colecciones completas sin paginación
- **Costo estimado actual:** 10,000+ lecturas por carga de dashboard admin
- **Costo objetivo:** <100 lecturas por carga

---

## 🚨 Problemas Críticos Encontrados

### 1. ❌ **CRÍTICO: Admin Analytics (src/services/adminAnalytics.ts)**

**Líneas 121-124:**
```typescript
const [usersSnap, companiesSnap] = await Promise.all([
  getDocs(collection(db, 'users')),      // Lee TODOS los usuarios
  getDocs(collection(db, 'companies')),  // Lee TODAS las empresas
])
```

**Impacto:**
- Con 10,000 usuarios: **10,000 lecturas**
- Con 1,000 empresas: **1,000 lecturas**
- **Total: 11,000 lecturas cada vez que se abre el dashboard admin** 💸

**Solución:**
- Crear colección `/stats/counters` con contadores agregados
- Actualizar contadores con Cloud Functions triggers
- Leer solo 1 documento en lugar de miles

---

### 2. ❌ **CRÍTICO: Más queries sin límite en adminAnalytics.ts**

**Línea 219:** `getDocs(collection(db, 'users'))` - Lee todos los usuarios  
**Línea 240:** `getDocs(collection(db, 'companies'))` - Lee todas las empresas  
**Línea 314:** `getDocs(collection(db, 'users'))` - Otra vez todos los usuarios  
**Línea 315:** `getDocs(collection(db, 'companies'))` - Otra vez todas las empresas

**Total:** 4 funciones diferentes leyendo colecciones completas

---

### 3. ❌ **ALTO: Company Reviews sin límite**

**Archivo:** `src/services/companyReviews.ts`  
**Línea 261:**
```typescript
const snapshot = await getDocs(collection(db, 'companies', companyId, 'reviews'))
```

**Impacto:**
- Si una empresa tiene 500 reviews: **500 lecturas cada vez**
- Se llama cada vez que se ve el perfil de una empresa

**Solución:**
- Añadir `.limit(20)` por defecto
- Implementar paginación con `startAfter()`
- Mostrar "Cargar más" button

---

### 4. ❌ **ALTO: Query N+1 en Reviews**

**Archivo:** `src/services/companyReviews.ts`  
**Líneas 298-306:**
```typescript
uniqueCompanyIds.map(async (companyId) => {
  const review = await getCustomerReviewForCompany(companyId, customerUid)
  return review ? ([companyId, review] as const) : null
})
```

**Impacto:**
- Si hay 50 empresas: **50+ queries separadas**
- Cada query tiene latencia de red

**Solución:**
- Usar `where('companyId', 'in', companyIds)` con batches de 10
- Reducir 50 queries a 5 queries

---

### 5. ❌ **MEDIO: Server-side queries sin límite**

**Archivos detectados:**
- `server/routes/public.ts` - Múltiples queries sin límite
- `server/routes/customerFriends.ts` - Lee todos los amigos
- `server/routes/customerReviews.ts` - Lee todas las reviews
- `server/data/restaurantIndex.ts` - Búsquedas sin límite

**Pendiente:** Análisis detallado

---

### 6. ❌ **MEDIO: Cloud Functions queries**

**Archivos detectados:**
- `server/reservations/challenges.ts` - Queries de retos sin límite
- `server/notifications/service.ts` - Notificaciones sin límite

**Pendiente:** Análisis detallado

---

## ✅ Soluciones a Implementar

### Fase 1: Contadores Agregados (Crítico)

**Crear nueva colección:**
```
/stats
  /counters
    - totalUsers: number
    - totalCustomers: number
    - totalCompanies: number
    - totalReservations: number
    - totalReviews: number
    - lastUpdated: timestamp
```

**Implementar Cloud Functions triggers:**
- `onUserCreate` → incrementar counters
- `onCompanyCreate` → incrementar counters
- `onReservationCreate` → incrementar counters

**Beneficio:** 11,000 lecturas → 1 lectura ✅

---

### Fase 2: Paginación en Listados

**Implementar en:**
1. `getCompanyReviews()` - Añadir paginación con cursor
2. `getUserGrowthData()` - Limitar a últimos 365 días
3. `getCompanyGrowthData()` - Limitar a últimos 365 días

**API de paginación:**
```typescript
interface PaginatedResult<T> {
  items: T[]
  nextCursor?: string
  hasMore: boolean
  total?: number
}
```

---

### Fase 3: Optimizar Queries N+1

**Implementar batching:**
```typescript
// Antes: 50 queries
for (const id of ids) {
  await getDoc(doc(db, 'collection', id))
}

// Después: 5 queries (batches de 10)
const batches = chunk(ids, 10)
for (const batch of batches) {
  await getDocs(query(
    collection(db, 'collection'),
    where(documentId(), 'in', batch)
  ))
}
```

---

### Fase 4: Caching Estratégico

**Implementar cache en memoria para:**
1. Stats counters (TTL: 5 minutos)
2. Company data (TTL: 10 minutos)
3. User profiles (TTL: 5 minutos)

**Librería:** Simple Map con timestamps

---

### Fase 5: Índices Compuestos

**Verificar índices necesarios para:**
1. Analytics queries con rangos de fechas
2. Búsquedas de restaurants
3. Listados de reviews ordenados

---

## 📈 Estimación de Reducción de Costos

### Antes:
- Dashboard admin: **11,000 lecturas**
- Perfil de empresa (500 reviews): **500 lecturas**
- Lista de 50 empresas con reviews: **50+ queries**
- **Total estimado por sesión:** ~12,000 lecturas

### Después:
- Dashboard admin: **1 lectura** (counters)
- Perfil de empresa (primeras 20 reviews): **20 lecturas**
- Lista de 50 empresas con reviews (batching): **5 queries**
- **Total estimado por sesión:** ~30 lecturas

**Reducción:** ~99.75% ✅  
**Ahorro mensual estimado:** Depende del tráfico, pero significativo

---

## 🚀 Plan de Implementación

### Prioridad 1 (HOY):
- [ ] Implementar contadores agregados
- [ ] Migrar admin analytics a contadores
- [ ] Añadir límites a queries críticas

### Prioridad 2 (Esta semana):
- [ ] Implementar paginación en reviews
- [ ] Optimizar queries N+1
- [ ] Añadir caching básico

### Prioridad 3 (Próxima semana):
- [ ] Auditar server-side queries
- [ ] Optimizar Cloud Functions
- [ ] Verificar todos los índices

---

## ⚠️ Consideraciones Importantes

1. **No romper funcionalidad existente** - Hacer cambios incrementales
2. **Testing exhaustivo** - Verificar cada cambio
3. **Backward compatibility** - Mantener APIs existentes
4. **Monitoreo** - Añadir logs de performance

---

**Status:** 🚧 Auditoría completada, implementación en progreso...
