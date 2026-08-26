import type { NextFunction, Request, Response } from 'express'

const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor'])
const MAX_DEPTH = 8
const MAX_ARRAY = 80
const MAX_KEYS = 80
const MAX_STRING = 8_000
const MAX_EMAIL_HTML = 120_000

function maxStringForPath(path: string): number {
  if (path.includes('/email-preview') || path.includes('/email')) {
    return MAX_EMAIL_HTML
  }
  return MAX_STRING
}

export function sanitizeString(value: string, max = MAX_STRING): string {
  return value
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max)
}

export function stripHtml(value: string): string {
  return sanitizeString(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sanitizeUnknown(value: unknown, depth: number, maxString: number): unknown {
  if (depth > MAX_DEPTH || value === undefined) {
    return undefined
  }
  if (value === null) {
    return null
  }
  if (typeof value === 'string') {
    return sanitizeString(value, maxString)
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value === 'boolean') {
    return value
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY)
      .map((item) => sanitizeUnknown(item, depth + 1, maxString))
      .filter((item) => item !== undefined)
  }
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {}
    let count = 0
    for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
      if (count >= MAX_KEYS || DANGEROUS_KEYS.has(rawKey) || rawKey.includes('.')) {
        continue
      }
      const key = sanitizeString(rawKey, 80)
      if (!key) {
        continue
      }
      const next = sanitizeUnknown(rawValue, depth + 1, maxString)
      if (next !== undefined) {
        output[key] = next
        count += 1
      }
    }
    return output
  }
  return undefined
}

export function sanitizeRequest(req: Request, _res: Response, next: NextFunction) {
  const maxString = maxStringForPath(req.originalUrl || req.path || '')
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    req.body = sanitizeUnknown(req.body, 0, maxString)
  }
  if (req.params && typeof req.params === 'object') {
    for (const key of Object.keys(req.params)) {
      const value = req.params[key]
      if (typeof value === 'string') {
        req.params[key] = sanitizeString(value, 200)
      }
    }
  }
  if (req.query && typeof req.query === 'object') {
    const query = req.query as Record<string, string | string[] | undefined>
    for (const key of Object.keys(query)) {
      const value = query[key]
      if (typeof value === 'string') {
        query[key] = sanitizeString(value, 200)
      } else if (Array.isArray(value) && typeof value[0] === 'string') {
        query[key] = sanitizeString(value[0], 200)
      }
    }
  }
  next()
}
