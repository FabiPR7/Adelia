import { defineSecret } from 'firebase-functions/params'

/** Solo el nombre; el valor está en Secret Manager, no en el repo. */
export const resendApiKey = defineSecret('RESEND_API_KEY')
