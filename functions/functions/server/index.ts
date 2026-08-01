import 'dotenv/config'
import { createApp } from './createApp.ts'
import { canUseAdminSdk, hasServiceAccount } from './firebase-admin.ts'

const app = createApp()
const PORT = Number(process.env.API_PORT ?? 3001)

app.listen(PORT, () => {
  console.log(`API Adelia en http://localhost:${PORT}`)
  console.log(
    canUseAdminSdk
      ? hasServiceAccount
        ? 'Auth: Firebase Admin SDK (serviceAccountKey.json)'
        : 'Auth: Firebase Admin SDK (entorno cloud o ADC)'
      : 'Auth: REST (sin serviceAccountKey — crear empresas OK, eliminar Auth limitado)',
  )
})
