# Adelia

Plataforma de reservas para restaurantes construida con React, Vite, Express y
Firestore.

## Desarrollo

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev:all
```

La web se sirve en `http://localhost:5173` y la API local usa el puerto 3001.
También se pueden ejecutar por separado con `npm run dev:web` y
`npm run dev:api`.

## Variables de entorno

Configura las variables sin incluir credenciales en el repositorio:

- Firebase web: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
  `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
  `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` y
  `VITE_FIREBASE_DATABASE_ID`.
- API/web: `VITE_API_URL`, `APP_URL`, `API_PORT` y `CORS_ORIGINS` (orígenes
  adicionales separados por comas).
- Firebase Admin local: `FIREBASE_SERVICE_ACCOUNT_PATH`.
- Correo: `RESEND_API_KEY`, `EMAIL_FROM` y `EMAIL_REPLY_TO`.
- Stripe: `VITE_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY` y
  `STRIPE_WEBHOOK_SECRET`.
- Multimedia/mapas: `VITE_CLOUDINARY_CLOUD_NAME`,
  `VITE_CLOUDINARY_UPLOAD_PRESET` y `VITE_MAPTILER_API_KEY`.

## Compilación y despliegue

```bash
npm run build
npm run deploy
```

Para despliegues parciales usa `npm run deploy:hosting`, `npm run deploy:rules`
o `npm run deploy:api`. Antes de desplegar, configura los secretos del entorno
de Functions y prueba las reglas de Firestore.

Tras desplegar rules/API, migra PINs y rellena las colecciones nuevas:

```bash
npm run migrate-promotion-pins
npm run backfill-collections
```

Coloca `serviceAccountKey.json` en la raíz (está en `.gitignore`) para la API
local con Admin SDK.
