import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock environment variables
vi.stubEnv('VITE_RECAPTCHA_SITE_KEY', 'test_site_key')
vi.stubEnv('VITE_FIREBASE_API_KEY', 'test_api_key')
vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project')

// Mock window.grecaptcha
global.window.grecaptcha = {
  ready: vi.fn((callback) => callback()),
  execute: vi.fn(() => Promise.resolve('test_token')),
  render: vi.fn(() => 1),
}

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
}
