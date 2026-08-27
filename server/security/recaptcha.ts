interface RecaptchaVerificationResponse {
  success: boolean
  score: number
  action: string
  'error-codes'?: string[]
}

function isCloudOrProduction(): boolean {
  return Boolean(
    process.env.K_SERVICE
    || process.env.FUNCTION_TARGET
    || process.env.NODE_ENV === 'production',
  )
}

export async function verifyRecaptchaToken(
  token: string,
  expectedAction: string,
  minScore = 0.5,
): Promise<{ valid: boolean; reason?: string }> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY?.trim() ?? ''
  const production = isCloudOrProduction()

  if (token === 'dev_mode_no_captcha' && !production) {
    return { valid: true }
  }

  if (!secretKey) {
    return { valid: true, reason: 'captcha_not_configured' }
  }

  if (!token.trim()) {
    return { valid: false, reason: 'missing_token' }
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
    })

    if (!response.ok) {
      return { valid: false, reason: 'api_error' }
    }

    const data = (await response.json()) as RecaptchaVerificationResponse
    if (!data.success) {
      return { valid: false, reason: 'google_error' }
    }
    if (data.action !== expectedAction) {
      return { valid: false, reason: 'action_mismatch' }
    }
    if (data.score < minScore) {
      return { valid: false, reason: 'low_score' }
    }
    return { valid: true }
  } catch {
    return { valid: false, reason: 'unknown_error' }
  }
}

export async function requireRecaptcha(
  token: unknown,
  expectedAction: string,
  minScore = 0.7,
): Promise<void> {
  const value = typeof token === 'string' ? token : ''
  const result = await verifyRecaptchaToken(value, expectedAction, minScore)
  if (!result.valid) {
    throw new Error('No se pudo verificar que no eres un robot. Recarga e inténtalo de nuevo.')
  }
}
