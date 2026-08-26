export function normalizeSpanishPhoneDigits(input: string): string | null {
  let digits = input.trim().replace(/[\s.\-/()]/g, '')

  if (digits.startsWith('+')) {
    digits = digits.slice(1)
  }

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  if (digits.startsWith('34') && digits.length >= 11) {
    digits = digits.slice(2)
  }

  if (!/^[6789]\d{8}$/.test(digits)) {
    return null
  }

  return digits
}

export function formatSpanishPhoneForStorage(input: string): string {
  const digits = normalizeSpanishPhoneDigits(input)
  if (!digits) {
    return input.trim()
  }
  return `+34 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
}

export function requireSpanishPhone(input: unknown): string {
  if (typeof input !== 'string') {
    throw new Error('Indica un teléfono válido de España (9 dígitos).')
  }
  const digits = normalizeSpanishPhoneDigits(input)
  if (!digits) {
    throw new Error('Indica un teléfono válido de España (9 dígitos).')
  }
  return formatSpanishPhoneForStorage(input)
}
