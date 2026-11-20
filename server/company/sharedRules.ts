// Reglas de los datos del local compartidas con la web: el servidor usa EXACTAMENTE
// las mismas funciones que el panel para limpiar y validar (no hay una segunda copia).
export {
  normalizeCompanySettingsPayload,
  validateCompanySettingsPayload,
} from '../../src/utils/companyValidation.ts'
export { normalizeCompanyEmailTemplates } from '../../src/utils/emailTemplates.ts'
export {
  normalizeQrBrandingConfig,
  parseCompanyQrBranding,
  serializeCompanyQrBranding,
} from '../../src/utils/qrBranding.ts'
export {
  parseFloorPlan,
  primaryFloorPlan,
  serializeFloorPlanForFirestore,
  serializeFloorPlansForFirestore,
} from '../../src/types/company.ts'
