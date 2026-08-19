# ✅ Checklist ANTES de Mergear a Main

## 📋 **PLAN DE ACCIÓN (En orden)**

---

## 🎯 **PASO 1: Verificaciones Locales** ✅ COMPLETADO

- [x] Tests pasando (211/211)
- [x] TypeScript sin errores
- [x] Código commiteado y pusheado
- [x] PR #1 actualizado

---

## 🚀 **PASO 2: Deploy de Prueba (HACER ESTO PRIMERO)**

### 2.1. Deploy Cloud Functions a ambiente de staging/test

```bash
# 1. Instalar dependencias
cd functions
npm install

# 2. Compilar
npm run build

# 3. Deploy (NO a producción aún)
# Opción A: Deploy a proyecto de test
firebase use test-project  # Si tienes proyecto de test
firebase deploy --only functions

# Opción B: Deploy con flag experimental
firebase deploy --only functions --debug
```

**⚠️ IMPORTANTE:** 
- Si no tienes proyecto de test, puedes hacer deploy directo pero con cautela
- Revisa los logs: `firebase functions:log`

---

### 2.2. Deploy Firestore Indexes

```bash
# Deploy índices (tarda 5-10 min en construirse)
firebase deploy --only firestore:indexes

# Verificar progreso
firebase firestore:indexes
# Esperar hasta que TODOS digan: Status = READY
```

**Mientras se construyen:**
- ⏳ Aparecerán como `CREATING`
- ✅ Cuando estén listos: `READY`
- ⚠️ Si alguno falla: revisar y corregir

---

### 2.3. Verificar que Functions funcionen

```bash
# Ver lista de funciones deployed
firebase functions:list

# Ver logs en tiempo real
firebase functions:log --only createReservation

# Probar manualmente (desde frontend o con curl)
curl -X POST https://REGION-PROJECT_ID.cloudfunctions.net/createReservation \
  -H "Content-Type: application/json" \
  -d '{ ... test data ... }'
```

---

## 🧪 **PASO 3: Testing Manual (30 minutos)**

### 3.1. Funcionalidades Críticas a Probar

**Dashboard Admin:**
- [ ] KPIs cargan correctamente
- [ ] Filtros funcionan (día, mes, año)
- [ ] Gráficos se renderizan
- [ ] Export CSV funciona

**Security:**
- [ ] Login con rate limiting (intentar 6 veces seguidas → debe bloquear)
- [ ] Registro con reCAPTCHA (debe aparecer badge)
- [ ] Cambio de contraseña funciona

**Reservas:**
- [ ] Crear reserva funciona
- [ ] No permite overbooking
- [ ] Stats se actualizan (distributed counters)
- [ ] Rate limiting funciona (hacer 15 reservas rápidas → debe bloquear)

**Performance:**
- [ ] Queries rápidas (<500ms)
- [ ] No hay errores en consola
- [ ] Firebase Performance muestra traces

---

### 3.2. Verificar Logs de Seguridad

```javascript
// En Firebase Console o con script:
db.collection('securityEvents')
  .orderBy('timestamp', 'desc')
  .limit(10)
  .get()

// Deberías ver:
// - reservation_created
// - rate_limit_exceeded (si probaste rate limiting)
```

---

### 3.3. Verificar Rate Limits

```javascript
// En Firestore:
db.collection('rateLimits')
  .limit(5)
  .get()

// Deberías ver documentos con:
// - count (número de requests)
// - resetAt (timestamp)
// - blockedUntil (si alguien fue bloqueado)
```

---

## 📊 **PASO 4: Monitoreo Primeras 24h**

### Dashboards a revisar:

1. **Firebase Console → Functions**
   - Invocaciones (deben estar funcionando)
   - Errores (idealmente 0%)
   - Latencia (P50, P95, P99)

2. **Firebase Console → Firestore**
   - Usage (lecturas/escrituras)
   - Performance (latencia)
   - Indexes (todos READY)

3. **Firebase Console → Performance**
   - Traces de operaciones
   - Slow operations (idealmente ninguna >3s)

---

## ⚠️ **PASO 5: Rollback Plan (por si algo falla)**

### Si hay problemas después de deploy:

```bash
# Ver versiones anteriores
firebase functions:list

# Rollback functions
firebase deploy --only functions --force

# Rollback indexes (más complicado, mejor prevenir)
# Restaurar firestore.indexes.json anterior y re-deploy
```

### Si rate limiting causa problemas:

```javascript
// Desbloquear usuario específico
const rateLimiter = new FirestoreRateLimiter()
await rateLimiter.resetLimit('createReservation:user@email.com')

// O borrar toda la colección rateLimits (emergency)
```

---

## ✅ **PASO 6: Merge a Main (SOLO DESPUÉS DE TODO LO ANTERIOR)**

### Cuando TODO esté funcionando en production:

```bash
# 1. Actualizar branch con main (por si hay cambios)
git checkout cursor/admin-dcc6
git fetch origin
git rebase origin/main

# 2. Resolver conflictos si hay (probablemente no)

# 3. Push force si hiciste rebase
git push origin cursor/admin-dcc6 --force-with-lease

# 4. En GitHub: Merge PR #1
# - Review el diff
# - Click "Merge pull request"
# - Confirmar

# 5. Actualizar tu local
git checkout main
git pull origin main

# 6. Borrar branch antigua (opcional)
git branch -d cursor/admin-dcc6
git push origin --delete cursor/admin-dcc6
```

---

## 📝 **PASO 7: Post-Merge**

### Después de mergear:

1. **Tag de versión:**
```bash
git tag -a v2.0.0 -m "Major release: Analytics + Security + Scalability"
git push origin v2.0.0
```

2. **Actualizar README principal:**
- Añadir badges
- Actualizar features
- Documentar nuevos comandos

3. **Comunicar a equipo:**
- Nuevas features implementadas
- Cambios en deployment
- Guías de uso

---

## 🚨 **Checklist Final Antes de Merge**

- [ ] Functions deployed y funcionando
- [ ] Indexes construidos (todos READY)
- [ ] Tests manuales completados
- [ ] Sin errores en logs (primeras horas)
- [ ] Performance OK (<500ms queries)
- [ ] Rate limiting funciona correctamente
- [ ] Security events se están logueando
- [ ] Rollback plan documentado
- [ ] Equipo notificado

---

## 💡 **Recomendación Personal**

**NO hagas merge inmediatamente.** Mejor:

1. **HOY:** Deploy functions + indexes
2. **HOY:** Testing manual (30 min)
3. **MAÑANA:** Revisar logs de 24h
4. **PASADO MAÑANA:** Si todo OK → Merge a main

**¿Por qué esperar?**
- Detectar bugs que solo aparecen con uso real
- Ver si rate limiting está bien calibrado
- Confirmar que distributed counters funcionan
- Verificar que no hay problemas de performance

---

## 🎯 **Tu Próximo Paso AHORA:**

```bash
# 1. Deploy functions
cd functions
npm install
npm run build
firebase deploy --only functions

# 2. Deploy indexes
firebase deploy --only firestore:indexes

# 3. Esperar 10 minutos

# 4. Probar manualmente
```

**Después de probar, me avisas si funcionó todo OK! 👍**
