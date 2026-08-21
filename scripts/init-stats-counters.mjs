/**
 * Script para inicializar los contadores agregados de stats
 * Ejecutar UNA VEZ después del deploy de los triggers
 * 
 * Uso: node scripts/init-stats-counters.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFunctions } from 'firebase-admin/functions'
import 'dotenv/config'

// Inicializar Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')

initializeApp({
  credential: cert(serviceAccount),
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
})

const auth = getAuth()

async function main() {
  console.log('🚀 Inicializando contadores de stats...\n')

  try {
    // Obtener un token de admin para llamar la Cloud Function
    // Nota: Necesitas ser admin en la app para ejecutar esto
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com'
    
    console.log(`📧 Buscando usuario admin: ${adminEmail}`)
    const adminUser = await auth.getUserByEmail(adminEmail)
    
    if (!adminUser) {
      throw new Error(`Usuario admin no encontrado: ${adminEmail}`)
    }

    // Crear custom token
    const customToken = await auth.createCustomToken(adminUser.uid, {
      role: 'admin',
    })

    console.log('✅ Token de admin generado\n')
    console.log('🔄 Llamando a recalculateAllCounters...\n')

    // Nota: Esta es una alternativa. En producción, llama a la Cloud Function directamente
    // desde Firebase Console o usando el Firebase CLI
    console.log('⚠️  IMPORTANTE:')
    console.log('   Ejecuta manualmente desde Firebase Console:')
    console.log('   1. Ve a Firebase Console > Functions')
    console.log('   2. Busca "recalculateAllCounters"')
    console.log('   3. Ejecuta la función (requiere permisos de admin)')
    console.log('')
    console.log('   O usa el Firebase CLI:')
    console.log('   firebase functions:shell')
    console.log('   > recalculateAllCounters()')
    console.log('')
    console.log('   O usa curl con el token:')
    console.log(`   curl -X POST https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/recalculateAllCounters \\`)
    console.log(`     -H "Authorization: Bearer ${customToken}" \\`)
    console.log(`     -H "Content-Type: application/json"`)
    console.log('')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

main()
