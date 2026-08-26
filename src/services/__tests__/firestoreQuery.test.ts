import { describe, expect, it } from 'vitest'
import {
  ADMIN_COMPANY_LIST_LIMIT,
  COMPANY_PROMOTION_LIMIT,
  COMPANY_RESERVATION_QUERY_LIMIT,
  COMPANY_RESERVATION_RANGE_LIMIT,
  COMPANY_REVIEW_PAGE_SIZE,
  COMPANY_TABLE_LIMIT,
  CUSTOMER_RESERVATION_LIMIT,
} from '../firestoreQuery'

describe('firestore query caps', () => {
  it('keeps list queries bounded so one tenant cannot dump the database', () => {
    expect(CUSTOMER_RESERVATION_LIMIT).toBeLessThanOrEqual(80)
    expect(COMPANY_REVIEW_PAGE_SIZE).toBeLessThanOrEqual(60)
    expect(COMPANY_RESERVATION_QUERY_LIMIT).toBeLessThanOrEqual(400)
    expect(COMPANY_RESERVATION_RANGE_LIMIT).toBeLessThanOrEqual(800)
    expect(COMPANY_TABLE_LIMIT).toBeLessThanOrEqual(80)
    expect(COMPANY_PROMOTION_LIMIT).toBeLessThanOrEqual(40)
    expect(ADMIN_COMPANY_LIST_LIMIT).toBeLessThanOrEqual(200)
  })
})
