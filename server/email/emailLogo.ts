import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ADELIA_EMAIL_LOGO_CID = 'adelia-logo'

const moduleDir = path.dirname(fileURLToPath(import.meta.url))

const LOGO_CANDIDATE_PATHS = [
  path.join(moduleDir, 'assets', 'adelia-logo-email.png'),
  path.join(moduleDir, '..', 'assets', 'adelia-logo-email.png'),
  path.join(moduleDir, 'adelia-logo-email.png'),
  path.join(moduleDir, '..', 'adelia-logo-email.png'),
  path.join(moduleDir, '..', '..', 'public', 'adelia-logo-email.png'),
  path.join(process.cwd(), 'lib', 'adelia-logo-email.png'),
  path.join(process.cwd(), 'public', 'adelia-logo-email.png'),
  path.join(process.cwd(), 'server', 'assets', 'adelia-logo-email.png'),
]

let cachedLogoBase64: string | null | undefined

function loadLogoBase64(): string | null {
  if (cachedLogoBase64 !== undefined) {
    return cachedLogoBase64
  }

  for (const candidate of LOGO_CANDIDATE_PATHS) {
    try {
      cachedLogoBase64 = readFileSync(candidate).toString('base64')
      return cachedLogoBase64
    } catch {
      // Try next location.
    }
  }

  cachedLogoBase64 = null
  return null
}

export function getAdeliaEmailLogoAttachment():
  | { filename: string; content: Buffer; contentId: string }
  | null {
  for (const candidate of LOGO_CANDIDATE_PATHS) {
    try {
      const content = readFileSync(candidate)
      return {
        filename: 'adelia-logo-email.png',
        content,
        contentId: ADELIA_EMAIL_LOGO_CID,
      }
    } catch {
      // Try next location.
    }
  }

  return null
}

export function getAdeliaEmailLogoImgSrc(mode: 'cid' | 'data' | 'remote', remoteUrl?: string): string {
  if (mode === 'cid') {
    return `cid:${ADELIA_EMAIL_LOGO_CID}`
  }

  const base64 = loadLogoBase64()

  if (mode === 'data' && base64) {
    return `data:image/png;base64,${base64}`
  }

  return remoteUrl ?? ''
}

export function getAdeliaEmailLogoAttachmentsForSend():
  | Array<{ filename: string; content: Buffer; contentId: string }>
  | undefined {
  const attachment = getAdeliaEmailLogoAttachment()
  return attachment ? [attachment] : undefined
}
