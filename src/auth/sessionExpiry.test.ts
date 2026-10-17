import { describe, it, expect } from 'vitest'
import { isSessionExpiry } from './sessionExpiry'

describe('isSessionExpiry', () => {
  it('flags a session that was authenticated and is now unauthenticated', () => {
    expect(isSessionExpiry('authenticated', 'unauthenticated')).toBe(true)
  })

  it('does not flag a session that stays authenticated', () => {
    expect(isSessionExpiry('authenticated', 'authenticated')).toBe(false)
  })

  it('does not flag the first check resolving to signed-out', () => {
    expect(isSessionExpiry('loading', 'unauthenticated')).toBe(false)
  })

  it('does not flag a sign-in completing', () => {
    expect(isSessionExpiry('unauthenticated', 'authenticated')).toBe(false)
    expect(isSessionExpiry('loading', 'authenticated')).toBe(false)
  })

  it('does not flag a session that stays signed-out', () => {
    expect(isSessionExpiry('unauthenticated', 'unauthenticated')).toBe(false)
  })
})
