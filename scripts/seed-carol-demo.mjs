import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { cert, initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const databaseId = process.env.VITE_FIREBASE_DATABASE_ID || 'adelia'
const COMPANY_SLUG = process.env.SEED_COMPANY_SLUG || 'carol'

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(readFileSync('serviceAccountKey.json', 'utf8'))),
  })
}

const db = getFirestore(undefined, databaseId)

function defaultSchedule() {
  const openDay = { open: '13:00', close: '23:00', active: true }
  const closedDay = { open: '', close: '', active: false }

  return {
    monday: { ...openDay },
    tuesday: { ...openDay },
    wednesday: { ...closedDay },
    thursday: { ...openDay },
    friday: { open: '13:00', close: '23:30', active: true },
    saturday: { open: '13:00', close: '23:30', active: true },
    sunday: { open: '13:00', close: '16:00', active: true },
  }
}

function atTime(baseDate, hours, minutes) {
  const date = new Date(baseDate)
  date.setHours(hours, minutes, 0, 0)
  return date
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000)
}

const companiesSnap = await db
  .collection('companies')
  .where('slug', '==', COMPANY_SLUG)
  .get()

if (companiesSnap.empty) {
  console.error(`No se encontró empresa con slug "${COMPANY_SLUG}".`)
  process.exit(1)
}

const companyDoc = companiesSnap.docs[0]
const companyId = companyDoc.id
const companyName = companyDoc.data().name

console.log(`Sembrando demo en: ${companyName} (${companyId})`)

await companyDoc.ref.set(
  {
    contactEmail: 'reservas@carol-restaurant.com',
    logoUrl: '',
    timeSlotMinutes: 90,
    turns: [
      { name: 'Comida', start: '13:00', end: '16:00' },
      { name: 'Cena', start: '20:00', end: '23:00' },
    ],
    schedule: defaultSchedule(),
    updatedAt: Timestamp.now(),
  },
  { merge: true },
)

const existingTables = await db
  .collection('tables')
  .where('companyId', '==', companyId)
  .get()

for (const docSnap of existingTables.docs) {
  await docSnap.ref.delete()
}

const tableDefs = [
  { name: 'Mesa 1 — Ventana', capacity: 2 },
  { name: 'Mesa 2 — Ventana', capacity: 2 },
  { name: 'Mesa 3 — Salón', capacity: 4 },
  { name: 'Mesa 4 — Salón', capacity: 4 },
  { name: 'Mesa 5 — Terraza', capacity: 6 },
  { name: 'Mesa 6 — Terraza', capacity: 6 },
  { name: 'Mesa 7 — Privado', capacity: 8 },
  { name: 'Mesa 8 — Barra', capacity: 4 },
]

const tableIds = []

for (let index = 0; index < tableDefs.length; index += 1) {
  const ref = db.collection('tables').doc()
  await ref.set({
    companyId,
    name: tableDefs[index].name,
    capacity: tableDefs[index].capacity,
    sortOrder: index,
  })
  tableIds.push(ref.id)
}

const existingReservations = await db
  .collection('reservations')
  .where('companyId', '==', companyId)
  .get()

for (const docSnap of existingReservations.docs) {
  await docSnap.ref.delete()
}

const today = new Date()
const reservationDefs = [
  {
    dayOffset: 0,
    hour: 13,
    minute: 30,
    tableIndex: 0,
    clientName: 'Laura Méndez',
    clientEmail: 'laura.mendez@email.com',
    clientPhone: '+34 612 345 678',
    pax: 2,
    status: 'confirmed',
  },
  {
    dayOffset: 0,
    hour: 14,
    minute: 0,
    tableIndex: 2,
    clientName: 'Carlos Ruiz',
    clientEmail: 'carlos.ruiz@email.com',
    clientPhone: '+34 698 111 222',
    pax: 4,
    status: 'confirmed',
  },
  {
    dayOffset: 0,
    hour: 20,
    minute: 30,
    tableIndex: 4,
    clientName: 'Familia Torres',
    clientEmail: 'torres.family@email.com',
    clientPhone: '+34 677 888 999',
    pax: 5,
    status: 'confirmed',
  },
  {
    dayOffset: 0,
    hour: 21,
    minute: 0,
    tableIndex: 6,
    clientName: 'Grupo Nexus',
    clientEmail: 'eventos@nexus.io',
    clientPhone: '+34 655 432 100',
    pax: 7,
    status: 'confirmed',
  },
  {
    dayOffset: 1,
    hour: 13,
    minute: 0,
    tableIndex: 1,
    clientName: 'Ana Beltrán',
    clientEmail: 'ana.beltran@email.com',
    clientPhone: '+34 611 222 333',
    pax: 2,
    status: 'confirmed',
  },
  {
    dayOffset: 1,
    hour: 20,
    minute: 0,
    tableIndex: 5,
    clientName: 'Pablo Iglesias',
    clientEmail: 'pablo.i@email.com',
    clientPhone: '+34 644 555 666',
    pax: 4,
    status: 'confirmed',
  },
  {
    dayOffset: 2,
    hour: 14,
    minute: 30,
    tableIndex: 3,
    clientName: 'Marina Soler',
    clientEmail: 'marina.soler@email.com',
    clientPhone: '+34 633 777 888',
    pax: 3,
    status: 'completed',
  },
  {
    dayOffset: -1,
    hour: 21,
    minute: 15,
    tableIndex: 7,
    clientName: 'Diego Vidal',
    clientEmail: 'diego.vidal@email.com',
    clientPhone: '+34 622 999 000',
    pax: 2,
    status: 'completed',
  },
]

const slotMinutes = 90
const now = Timestamp.now()

for (const [index, item] of reservationDefs.entries()) {
  const day = new Date(today)
  day.setDate(day.getDate() + item.dayOffset)
  const start = atTime(day, item.hour, item.minute)
  const end = addMinutes(start, slotMinutes)

  await db.collection('reservations').add({
    companyId,
    tableId: tableIds[item.tableIndex],
    clientName: item.clientName,
    clientEmail: item.clientEmail,
    clientPhone: item.clientPhone,
    pax: item.pax,
    startTime: Timestamp.fromDate(start),
    endTime: Timestamp.fromDate(end),
    status: item.status,
    cancelToken: `demo-${companyId}-${index}`,
    createdAt: now,
  })
}

console.log(`\nListo para "${companyName}":`)
console.log(`- ${tableIds.length} mesas`)
console.log(`- ${reservationDefs.length} reservas (${reservationDefs.filter((r) => r.dayOffset === 0).length} hoy)`)
console.log('\nEntra como carol y mira la pestaña Reservas.')
