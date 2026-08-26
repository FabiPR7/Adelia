/**
 * Sistema de logging de eventos de seguridad
 */

export type SecurityEventType =
  | 'unauthorized_access'
  | 'privilege_escalation_attempt'
  | 'injection_attempt'
  | 'rate_limit_exceeded'
  | 'invalid_token'
  | 'suspicious_activity'
  | 'account_locked'
  | 'failed_login'
  | 'mass_assignment_attempt'

export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface SecurityEvent {
  type: SecurityEventType
  severity: SecurityEventSeverity
  userId?: string
  email?: string
  ip?: string
  userAgent?: string
  resource?: string
  action?: string
  details: Record<string, unknown>
  timestamp: Date
}

/**
 * Registra un evento de seguridad en Firestore
 * Solo se ejecuta en producción para no saturar la base de datos
 */
export async function logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): Promise<void> {
  try {
    // En desarrollo, solo loguear en consola
    if (import.meta.env.DEV) {
      console.warn('🛡️ [SECURITY EVENT]', {
        ...event,
        timestamp: new Date().toISOString(),
      })
      return
    }

    console.warn('🛡️ [SECURITY EVENT]', event.type, event.severity)
    if (event.severity === 'critical' || event.severity === 'high') {
      console.error('🚨 [SECURITY ALERT]', event.type, event.userId)
    }
  } catch (error) {
    // No queremos que un error de logging rompa la app
    console.error('Error logging security event:', error)
  }
}

/**
 * Registra un intento de acceso no autorizado
 */
export async function logUnauthorizedAccess(
  userId: string | undefined,
  resource: string,
  attemptedAction: string,
): Promise<void> {
  await logSecurityEvent({
    type: 'unauthorized_access',
    severity: 'high',
    userId,
    resource,
    action: attemptedAction,
    details: {
      url: window.location.href,
      referrer: document.referrer,
    },
  })
}

/**
 * Registra un intento de escalación de privilegios
 */
export async function logPrivilegeEscalation(
  userId: string,
  attemptedRole: string,
  currentRole: string,
): Promise<void> {
  await logSecurityEvent({
    type: 'privilege_escalation_attempt',
    severity: 'critical',
    userId,
    details: {
      attemptedRole,
      currentRole,
      url: window.location.href,
    },
  })
}

/**
 * Registra un intento de inyección
 */
export async function logInjectionAttempt(
  userId: string | undefined,
  field: string,
  value: string,
): Promise<void> {
  await logSecurityEvent({
    type: 'injection_attempt',
    severity: 'high',
    userId,
    details: {
      field,
      value: value.slice(0, 100), // Truncar para no guardar payloads completos
      url: window.location.href,
    },
  })
}

/**
 * Registra cuando se excede el rate limit
 */
export async function logRateLimitExceeded(
  identifier: string,
  action: string,
): Promise<void> {
  await logSecurityEvent({
    type: 'rate_limit_exceeded',
    severity: 'medium',
    details: {
      identifier,
      action,
      url: window.location.href,
    },
  })
}

/**
 * Registra actividad sospechosa genérica
 */
export async function logSuspiciousActivity(
  userId: string | undefined,
  description: string,
  details: Record<string, unknown>,
): Promise<void> {
  await logSecurityEvent({
    type: 'suspicious_activity',
    severity: 'medium',
    userId,
    details: {
      description,
      ...details,
      url: window.location.href,
    },
  })
}

/**
 * Registra cuando se bloquea una cuenta
 */
export async function logAccountLocked(
  userId: string,
  reason: string,
  lockedUntil: Date,
): Promise<void> {
  await logSecurityEvent({
    type: 'account_locked',
    severity: 'high',
    userId,
    details: {
      reason,
      lockedUntil: lockedUntil.toISOString(),
    },
  })
}

/**
 * Registra un intento de mass assignment
 */
export async function logMassAssignmentAttempt(
  userId: string | undefined,
  attemptedFields: string[],
  allowedFields: readonly string[],
): Promise<void> {
  const forbidden = attemptedFields.filter(f => !allowedFields.includes(f))
  
  if (forbidden.length > 0) {
    await logSecurityEvent({
      type: 'mass_assignment_attempt',
      severity: 'high',
      userId,
      details: {
        attemptedFields: forbidden,
        allowedFields: [...allowedFields],
        url: window.location.href,
      },
    })
  }
}
