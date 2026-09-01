# Operaciones y pasos manuales

Cosas que **no** están en el código y hay que hacer una vez en la consola de
Google Cloud / Firebase / Stripe. Marca cada casilla cuando la dejes hecha.

---

## 1. Copias de seguridad de Firestore (base de datos `adelia`)

La base de datos tiene pagos y datos personales. Necesita recuperación ante
borrados accidentales y ante incidentes.

### 1.1 Point-in-Time Recovery (PITR)

Permite volver a cualquier instante de los últimos 7 días.

```bash
gcloud firestore databases update \
  --database=adelia \
  --enable-pitr \
  --project=adelia-ccdaf
```

Comprobar:

```bash
gcloud firestore databases describe --database=adelia --project=adelia-ccdaf
# pointInTimeRecoveryEnablement debe ser POINT_IN_TIME_RECOVERY_ENABLED
```

### 1.2 Exportaciones programadas a Cloud Storage

PITR solo cubre 7 días. Para retención larga, export semanal a un bucket.

```bash
# Bucket de backups (una vez), en la misma región que la BD
gcloud storage buckets create gs://adelia-ccdaf-firestore-backups \
  --location=europe-southwest1 \
  --project=adelia-ccdaf

# Regla de ciclo de vida: borra backups de más de 90 días
cat > /tmp/lifecycle.json <<'JSON'
{ "rule": [ { "action": {"type":"Delete"}, "condition": {"age": 90} } ] }
JSON
gcloud storage buckets update gs://adelia-ccdaf-firestore-backups \
  --lifecycle-file=/tmp/lifecycle.json

# Export programado semanal (domingos 04:00) con retención de 14 semanas
gcloud firestore databases backup-schedules create \
  --database=adelia \
  --recurrence=weekly \
  --day-of-week=SUN \
  --retention=14w \
  --project=adelia-ccdaf
```

> Si `backup-schedules` no está disponible en tu versión de `gcloud`, alternativa:
> un Cloud Scheduler que llame a `gcloud firestore export gs://.../$(date)` .

- [ ] PITR activado
- [ ] Bucket de backups creado con ciclo de vida
- [ ] Export programado creado
- [ ] Probada una restauración en un proyecto de pruebas

---

## 2. Webhook de Stripe

El endpoint es `POST /api/stripe/webhook` (función `api`). En el dashboard de
Stripe → Developers → Webhooks, el endpoint debe estar suscrito **exactamente** a:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `invoice.paid`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `account.updated`  *(Stripe Connect: estado de las cuentas de restaurante)*

`STRIPE_WEBHOOK_SECRET` en `functions/.env.adelia-ccdaf` tiene que ser el
`whsec_...` de **ese** endpoint concreto.

Idempotencia: cada evento se registra en la colección `stripeEvents/{event.id}`
antes de procesarse; si Stripe reenvía el mismo evento, se responde 200 sin
volver a tocar planes ni correos. Esos documentos caducan a los 45 días y los
limpia `cleanupRateLimitsScheduled`.

- [ ] Endpoint suscrito solo a esos eventos
- [ ] `STRIPE_WEBHOOK_SECRET` correcto
- [ ] Enviado un evento de prueba y visto `{ received: true }`

---

## 3. Rendimiento de la API en producción

`functions/src/api.ts` lee `API_MIN_INSTANCES`. Para evitar cold starts en la
ruta de reserva, en `functions/.env.adelia-ccdaf`:

```
API_MIN_INSTANCES=1
```

Cuesta ~una instancia siempre encendida. Súbelo si el tráfico crece.

- [ ] `API_MIN_INSTANCES=1` en el `.env` de functions de producción

---

## 4. Desplegar reglas de Firestore

Se han endurecido reglas (`reviews`, `reviewIndex` ya no son mundo-legibles;
nueva colección `stripeEvents`). Hay que desplegarlas:

```bash
npm run deploy:rules
```

El sitio público sigue funcionando porque lee las reseñas por la API
(`/api/public/booking/:slug/reviews`), que las sanea. Verifícalo tras desplegar.

- [ ] `firestore.rules` desplegadas
- [ ] Página pública de un restaurante con reseñas se ve igual que antes
- [ ] Panel de empresa sigue viendo sus reseñas

---

## 5. Cabeceras de caché en endpoints públicos

Los GET públicos (`/api/public/booking/:slug`, `.../reviews`, `.../availability`,
`/api/public/promotions*`, `/api/public/cities/search`) ahora mandan
`Cache-Control: public, ...`. Firebase Hosting cachea esas respuestas en su CDN.
Si algún dato público tarda en refrescarse más de la cuenta, ajusta los segundos
en las llamadas a `allowPublicCache(...)` de `server/routes/*.ts`.

---

## 6. Endurecimiento de seguridad (variables de entorno)

En `functions/.env.adelia-ccdaf` (producción):

```
RECAPTCHA_REQUIRED=true          # rechaza registros si falta RECAPTCHA_SECRET_KEY
VITE_CLOUDINARY_CLOUD_NAME=<tu-cloud>   # restringe medios a tu cuenta Cloudinary
# SYNC_XP_DAILY_CEILING=5000     # opcional; tope XP/día vía /gamification/sync
```

Cambios de código que ya van incluidos (no requieren acción):

- **Enumeración de empresas**: `/api/auth/resolve-login` ahora cuenta también los
  intentos con nombre inexistente, así se bloquean igual que uno real.
- **Fuerza bruta del PIN de 4 dígitos**: los endpoints que validan PIN
  (`verify-minimum-spend`, `validate-pin`, `register-consumption`) pasan por un
  límite distribuido (12 / 5 min por sesión). El PIN se genera con CSPRNG.
  Pendiente opcional: PIN de más dígitos o bloqueo por reintentos.
- **Inflado de XP**: `/api/customer/gamification/sync` tiene (a) límite
  distribuido 30 / 5 min, (b) tope de XP/día (`SYNC_XP_DAILY_CEILING`), y
  (c) **techo absoluto** calculado en servidor a partir de datos de confianza
  (nº de reservas/consumos + antigüedad de la cuenta): la XP nunca puede superar
  la de un jugador perfecto que completa todas las misiones en todos los
  periodos. No es una recomputación exacta del motor de misiones (eso exigiría
  portar ~1000 líneas con lógica de zona horaria de Madrid), pero cierra el
  agujero: el navegador solo puede proponer la XP exacta dentro de ese sobre.
  Desactivable con `GAMIFICATION_XP_CEILING_ENABLED=false` si hiciera falta.
- **Reutilización de fianza**: una reserva rechaza un `depositPaymentIntentId`
  que ya esté asociado a otra reserva.
- **Reglas Firestore**: recuerda `npm run deploy:rules` (sección 4).

## 7. Limpieza pendiente (deuda técnica, no urgente)

- Colección `userFavorites` y helpers cliente (`src/services/userFavorites.ts`,
  `setCustomerFavorite`/`updateCustomerFavorites` en `src/services/customerAuth.ts`):
  ya no se escriben. Se pueden borrar cuando se confirme en producción que todos
  los clientes activos tienen el array `users/{uid}.favoriteSlugs` poblado.
- `serviceAccountKey.json`: solo para dev local. Rótalo si alguna vez se ha
  compartido. En Cloud se usa ADC, no este fichero.
