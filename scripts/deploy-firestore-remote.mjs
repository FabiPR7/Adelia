/**
 * Publica reglas e índices en la base nombrada `adelia` sin pasar por
 * serviceusage.googleapis.com (el CLI de Firebase falla ahí con la SA).
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GoogleAuth } from 'google-auth-library'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ?? path.join(root, 'serviceAccountKey.json')
const projectId = 'adelia-ccdaf'
const databaseId = 'adelia'

if (!existsSync(keyFile)) {
  console.error('Falta serviceAccountKey.json')
  process.exit(1)
}

const auth = new GoogleAuth({
  keyFile,
  scopes: [
    'https://www.googleapis.com/auth/firebase',
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/datastore',
  ],
})

const client = await auth.getClient()

async function api(method, url, body) {
  const res = await client.request({
    url,
    method,
    data: body,
    headers: { 'Content-Type': 'application/json' },
    validateStatus: () => true,
  })
  return { status: res.status, data: res.data }
}

const rulesContent = readFileSync(path.join(root, 'firestore.rules'), 'utf8')
const indexes = JSON.parse(readFileSync(path.join(root, 'firestore.indexes.json'), 'utf8'))

const created = await api(
  'POST',
  `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
  {
    source: {
      files: [{ name: 'firestore.rules', content: rulesContent }],
    },
  },
)

if (created.status >= 300) {
  console.error('No se pudo crear el ruleset:', created.status, JSON.stringify(created.data))
  process.exit(1)
}

const rulesetName = created.data.name
console.log('Ruleset creado:', rulesetName)

const releaseName = `projects/${projectId}/releases/cloud.firestore/${databaseId}`
const releaseResource = { name: releaseName, rulesetName }

let released = await api(
  'PATCH',
  `https://firebaserules.googleapis.com/v1/${releaseName}`,
  {
    release: releaseResource,
    updateMask: 'rulesetName',
  },
)

if (released.status === 404) {
  released = await api(
    'POST',
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`,
    releaseResource,
  )
}

if (released.status >= 300) {
  console.error('No se pudo publicar el release:', released.status, JSON.stringify(released.data))
  process.exit(1)
}

console.log('Reglas publicadas en', releaseName)

const indexUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/collectionGroups`

async function ensureCompositeIndex(index) {
  const collection = index.collectionGroup
  const payload = {
    queryScope: index.queryScope === 'COLLECTION_GROUP' ? 'COLLECTION_GROUP' : 'COLLECTION',
    fields: index.fields.map((field) => {
      if (field.arrayConfig) {
        return { fieldPath: field.fieldPath, arrayConfig: field.arrayConfig }
      }
      return { fieldPath: field.fieldPath, order: field.order }
    }),
  }
  const result = await api('POST', `${indexUrl}/${encodeURIComponent(collection)}/indexes`, payload)
  if (result.status === 409 || result.status === 200 || result.status === 201) {
    return 'ok'
  }
  if (result.status === 400 && JSON.stringify(result.data).includes('already exists')) {
    return 'exists'
  }
  if (result.status >= 300) {
    console.warn(`Índice ${collection}:`, result.status, JSON.stringify(result.data))
    return 'error'
  }
  return 'ok'
}

async function ensureFieldOverride(override) {
  const fieldPath = override.fieldPath.replace(/\//g, '_')
  const name = `projects/${projectId}/databases/${databaseId}/collectionGroups/${encodeURIComponent(override.collectionGroup)}/fields/${encodeURIComponent(override.fieldPath)}`
  const indexesPayload = (override.indexes ?? []).map((item) => ({
    queryScope: item.queryScope === 'COLLECTION_GROUP' ? 'COLLECTION_GROUP' : 'COLLECTION',
    order: item.order,
    arrayConfig: item.arrayConfig,
  }))
  const result = await api('PATCH', `https://firestore.googleapis.com/v1/${name}?updateMask=indexConfig.indexes`, {
    name,
    indexConfig: { indexes: indexesPayload },
  })
  if (result.status >= 300) {
    console.warn(`Field override ${override.collectionGroup}.${fieldPath}:`, result.status, JSON.stringify(result.data))
  }
}

let indexOk = 0
for (const index of indexes.indexes ?? []) {
  const status = await ensureCompositeIndex(index)
  if (status !== 'error') {
    indexOk += 1
  }
}
for (const override of indexes.fieldOverrides ?? []) {
  await ensureFieldOverride(override)
}

console.log(`Índices procesados: ${indexOk}/${(indexes.indexes ?? []).length}`)
console.log('Firestore remoto actualizado')
