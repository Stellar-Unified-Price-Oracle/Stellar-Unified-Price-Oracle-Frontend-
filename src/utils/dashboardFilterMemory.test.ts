import { describe, it, expect, beforeEach } from 'vitest'
import { STORAGE_KEYS, writeRaw } from './storage'
import {
  forgetFilters,
  hasFilterParams,
  isRememberingFilters,
  pickFilterParams,
  readRememberedFilters,
  rememberFilters,
} from './dashboardFilterMemory'

beforeEach(() => {
  localStorage.clear()
})

describe('pickFilterParams', () => {
  it('keeps filter params and drops search text, workspace, and empty values', () => {
    const picked = pickFilterParams(new URLSearchParams('sources=chainlink&search=btc&workspace=abc&sort=&minConf=40'))
    expect(picked.toString()).toBe('sources=chainlink&minConf=40')
  })
})

describe('hasFilterParams', () => {
  it('is false for a URL with no filter params', () => {
    expect(hasFilterParams(new URLSearchParams('search=btc'))).toBe(false)
  })

  it('is true when any filter param is present', () => {
    expect(hasFilterParams(new URLSearchParams('updatedWithin=1h'))).toBe(true)
  })
})

describe('remember and forget', () => {
  it('does nothing until the user opts in', () => {
    expect(isRememberingFilters()).toBe(false)
    expect(readRememberedFilters()).toBeNull()
  })

  it('stores only filter params and reads them back', () => {
    expect(rememberFilters(new URLSearchParams('sources=band&search=eth&sortDir=asc'))).toBe(true)
    expect(isRememberingFilters()).toBe(true)
    expect(readRememberedFilters()?.toString()).toBe('sources=band&sortDir=asc')
  })

  it('forgets the entry', () => {
    rememberFilters(new URLSearchParams('sort=recent'))
    forgetFilters()
    expect(isRememberingFilters()).toBe(false)
    expect(readRememberedFilters()).toBeNull()
  })

  it('treats malformed JSON as not remembered', () => {
    writeRaw(STORAGE_KEYS.dashboardFilters, '{nope')
    expect(readRememberedFilters()).toBeNull()
    expect(isRememberingFilters()).toBe(false)
  })

  it('treats a wrongly shaped entry as not remembered', () => {
    writeRaw(STORAGE_KEYS.dashboardFilters, JSON.stringify({ query: 42 }))
    expect(readRememberedFilters()).toBeNull()
  })

  it('rejects an oversized stored query instead of parsing it', () => {
    writeRaw(STORAGE_KEYS.dashboardFilters, JSON.stringify({ query: `sort=${'x'.repeat(2000)}` }))
    expect(readRememberedFilters()).toBeNull()
  })
})
