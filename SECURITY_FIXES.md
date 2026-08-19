# Correcciones de Seguridad en Firestore Rules

## Resumen
Se han corregido 4 vulnerabilidades de seguridad identificadas en las reglas de Firestore.

## 🔴 CRÍTICO: PromotionPin expuesto públicamente

### Problema
El campo `promotionPin` estaba en el documento principal `/companies/{companyId}` con `allow read: if true`, permitiendo que cualquiera leyera el PIN de verificación de promociones.

### Solución
- ✅ El código **ya usaba** `/companies/{companyId}/private/promotionPin` (subcolecci ón protegida)
- ✅ Eliminadas referencias legacy a `promotionPin` en las reglas de validación
- ✅ El sistema migra automáticamente PINs antiguos a la ubicación segura

### Impacto
- Antes: Cualquiera podía leer el PIN → canjear promociones fraudulentamente
- Ahora: Solo dueño/admin pueden acceder al PIN

---

## 🟡 MEDIO: /logins expone emails públicamente

### Problema
`/logins/{loginId}` tenía `allow get: if true`, exponiendo el campo `authEmail` de las empresas a cualquiera que adivinara el loginId.

### Solución
```firestore
// Antes
allow get: if true;

// Ahora
allow get, list: if false;
```

### Impacto
- Antes: Emails de empresas expuestos → spam, phishing
- Ahora: Resolución loginName → authEmail **solo vía Cloud Functions backend**

### Nota
El backend debe implementar una Cloud Function para resolver loginName → authEmail de forma segura durante el login.

---

## 🟢 MENOR: Función isValidPublicReservation() sin usar

### Problema
Función definida pero nunca utilizada en las reglas, código muerto que confunde.

### Solución
- ✅ Eliminada la función completa

### Impacto
- Código más limpio y mantenible

---

## 🟢 MENOR: Empresas pueden borrar sus propias reviews

### Problema
```firestore
allow delete: if isCompanyOwner(companyId) || isAdmin();
```

Permitía que restaurantes eliminaran reseñas negativas legítimas.

### Solución
```firestore
// Solo admin puede borrar reviews para mantener credibilidad
allow delete: if isAdmin();
```

### Impacto
- Antes: Restaurantes podían censurar críticas negativas
- Ahora: Solo administradores pueden moderar reviews
- Restaurantes **pueden responder** reviews (mantiene `allow update`)

---

## Cambios en firestore.rules

### 1. /logins/{loginId}
- ❌ `allow get: if true;`
- ✅ `allow get, list: if false;`
- 📝 Backend debe resolver loginName → authEmail vía Cloud Functions

### 2. isValidCompanyOwnerUpdate()
- ❌ Validaba campo `promotionPin`
- ✅ Campo eliminado (ya está en /private/)

### 3. /companies/{companyId} update
- ❌ Lógica especial para eliminar `promotionPin`
- ✅ Simplificada, PIN ya no está aquí

### 4. /companies/{companyId}/reviews/{reviewId}
- ❌ `allow delete: if isCompanyOwner(companyId) || isAdmin();`
- ✅ `allow delete: if isAdmin();`

---

## Testing Recomendado

### PromotionPin
```typescript
// ✅ Dueño puede leer PIN
await getPromotionPinSettings(companyId) // OK

// ❌ Usuario anónimo NO puede leer PIN
await db.collection('companies').doc(companyId).get() 
// NO contiene promotionPin

await db.collection('companies').doc(companyId)
  .collection('private').doc('promotionPin').get()
// Permission denied
```

### Logins
```typescript
// ❌ NO se puede leer directamente
await db.collection('logins').doc(loginId).get()
// Permission denied

// ✅ Backend Cloud Function resuelve
const result = await functions.httpsCallable('resolveLogin')({ 
  loginName: 'mi-restaurante' 
})
// { authEmail: 'restaurante@example.com' }
```

### Reviews
```typescript
// ✅ Dueño puede responder
await db.collection('companies').doc(companyId)
  .collection('reviews').doc(reviewId)
  .update({ ownerReply: { text: 'Gracias!' } })

// ❌ Dueño NO puede borrar
await db.collection('companies').doc(companyId)
  .collection('reviews').doc(reviewId).delete()
// Permission denied

// ✅ Admin puede borrar
// (con privilegios de admin)
```

---

## Deployment

Para aplicar estos cambios:

```bash
# Deploy solo las reglas
firebase deploy --only firestore:rules

# O deploy completo
firebase deploy
```

---

## Notas Importantes

1. **PromotionPin**: La migración automática funciona, pero considera ejecutar el script de migración explícitamente:
   ```bash
   npm run migrate-promotion-pins
   ```

2. **Logins**: Verifica que tu Cloud Function de login no dependa de lectura directa del documento `/logins/{id}`. Debe usar privilegios de admin.

3. **Reviews**: Si necesitas un flujo de "solicitar borrado", implementa una Cloud Function que:
   - Empresa solicita borrado
   - Admin revisa y aprueba/rechaza
   - System elimina la review si se aprueba
