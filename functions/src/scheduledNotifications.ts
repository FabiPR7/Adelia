import { onSchedule } from 'firebase-functions/v2/scheduler'
import { processDueNotificationJobs } from '../server/notifications/service.ts'

async function runDueNotificationJobs() {
  try {
    const processed = await processDueNotificationJobs()
    if (processed > 0) {
      console.log(`Processed ${processed} scheduled notifications`)
    }
  } catch (error) {
    console.error('Scheduled notification processor failed:', error)
  }
}

export const processScheduledNotifications = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: 'europe-west1',
    timeZone: 'Europe/Madrid',
  },
  runDueNotificationJobs,
)

export const processDueNotifications = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: 'europe-west1',
    timeZone: 'Europe/Madrid',
  },
  runDueNotificationJobs,
)
