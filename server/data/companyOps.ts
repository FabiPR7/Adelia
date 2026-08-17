import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../firebase-admin.ts'

export const COMPANY_OPS_DOC = 'ops'

export function companyOpsRef(companyId: string) {
  return adminDb.collection('companies').doc(companyId).collection('private').doc(COMPANY_OPS_DOC)
}

export async function readCompanyOps(
  companyId: string,
): Promise<FirebaseFirestore.DocumentData | null> {
  const [companySnap, opsSnap] = await Promise.all([
    adminDb.collection('companies').doc(companyId).get(),
    companyOpsRef(companyId).get(),
  ])
  if (!companySnap.exists) {
    return null
  }
  return {
    ...companySnap.data(),
    ...(opsSnap.data() ?? {}),
  }
}

export async function writeCompanyOps(
  companyId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await companyOpsRef(companyId).set(
    {
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
}
