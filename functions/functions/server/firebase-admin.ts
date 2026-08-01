import 'dotenv/config'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
  path.join(__dirname, '..', 'serviceAccountKey.json')

export const hasServiceAccount = existsSync(serviceAccountPath)
export const isCloudRuntime = Boolean(process.env.K_SERVICE || process.env.FUNCTION_TARGET)
export const canUseAdminSdk = hasServiceAccount || isCloudRuntime
export const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || 'adelia'
export const projectId =
  process.env.VITE_FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? ''
export const apiKey = process.env.VITE_FIREBASE_API_KEY ?? ''

if (!getApps().length) {
  if (hasServiceAccount) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))
    initializeApp({
      credential: cert(serviceAccount),
    })
  } else {
    initializeApp({
      projectId: projectId || undefined,
    })
  }
}

export const adminAuth = getAuth()
export const adminDb = getFirestore(undefined, databaseId)
