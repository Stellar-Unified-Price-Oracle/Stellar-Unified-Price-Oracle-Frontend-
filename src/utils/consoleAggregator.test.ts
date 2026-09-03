import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearWarnings,
  exportWarnings,
  getWarnings,
  installConsoleAggregator,
  subscribeWarnings,
  suppressPattern,
} from './consoleAggregator'

// Reset module state between tests via clearWarnings + fresh install
beforeEach(() => {
  clearWarnings()
})

afterEach(() => {
  clearWarnings()
  vi.restoreAllMocks()
})

describe('consoleAggregator', () => {
  it('captures console.warn and aggregates', () => {
    installConsoleAggregator()
    console.warn('test warning')
    console.warn('test warning')
    const w = getWarnings()
    const match = w.find((x) => x.pattern.includes('test warning'))
    expect(match).toBeDefined()
    expect(match!.count).toBeGreaterThanOrEqual(2)
    expect(match!.level).toBe('warn')
  })

  it('captures console.error', () => {
    installConsoleAggregator()
    console.error('test error')
    const w = getWarnings()
    const match = w.find((x) => x.pattern.includes('test error'))
    expect(match).toBeDefined()
    expect(match!.level).toBe('error')
  })

  it('deduplicates identical messages', () => {
    installConsoleAggregator()
    console.warn('dedupe me')
    console.warn('dedupe me')
    const w = getWarnings().filter((x) => x.pattern.includes('dedupe me'))
    expect(w.length).toBe(1)
    expect(w[0].count).toBeGreaterThanOrEqual(2)
  })

  it('suppresses a pattern', () => {
    clearWarnings()
    installConsoleAggregator()
    suppressPattern(/suppress-this/)
    console.warn('suppress-this message')
    const w = getWarnings().filter((x) => x.pattern.includes('suppress-this'))
    expect(w.length).toBe(0)
  })

  it('notifies subscribers', () => {
    installConsoleAggregator()
    const listener = vi.fn()
    const unsub = subscribeWarnings(listener)
    console.warn('subscriber test')
    expect(listener).toHaveBeenCalled()
    unsub()
  })

  it('exports as valid JSON', () => {
    installConsoleAggregator()
    console.warn('export test')
    const json = exportWarnings()
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('clearWarnings empties the list', () => {
    installConsoleAggregator()
    console.warn('to be cleared')
    clearWarnings()
    expect(getWarnings().length).toBe(0)
  })
})
