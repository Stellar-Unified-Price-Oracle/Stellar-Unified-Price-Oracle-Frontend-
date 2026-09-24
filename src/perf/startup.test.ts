import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  STARTUP_BUDGETS,
  STARTUP_STAGES,
  afterFirstPaint,
  getStartupReport,
  markBoot,
  markStage,
  onStartupStage,
  resetStartup,
  runWhenIdle,
} from './startup'

let clock = 0

/** Drive `performance.now()` from a mutable clock so call count cannot skew timings. */
function useMockClock(): void {
  clock = 0
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
}

beforeEach(() => {
  resetStartup()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  resetStartup()
})

describe('startup budgets', () => {
  it('defines a budget for every stage', () => {
    for (const stage of STARTUP_STAGES) {
      expect(STARTUP_BUDGETS[stage].budgetMs).toBeGreaterThan(0)
      expect(STARTUP_BUDGETS[stage].description).not.toBe('')
    }
  })

  it('orders budgets shell < first-price < live < idle', () => {
    expect(STARTUP_BUDGETS.shell.budgetMs).toBeLessThan(STARTUP_BUDGETS['first-price'].budgetMs)
    expect(STARTUP_BUDGETS['first-price'].budgetMs).toBeLessThan(STARTUP_BUDGETS.live.budgetMs)
    expect(STARTUP_BUDGETS.live.budgetMs).toBeLessThan(STARTUP_BUDGETS.idle.budgetMs)
  })
})

describe('markStage', () => {
  it('records a stage relative to boot', () => {
    useMockClock()
    markBoot()
    clock = 200

    const record = markStage('shell')

    expect(record.stage).toBe('shell')
    expect(record.at).toBe(200)
    expect(record.budgetMs).toBe(STARTUP_BUDGETS.shell.budgetMs)
    expect(record.overBudget).toBe(false)
  })

  it('flags a stage that exceeds its budget and warns in dev', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    useMockClock()
    markBoot()
    clock = STARTUP_BUDGETS.shell.budgetMs + 1

    const record = markStage('shell')

    expect(record.overBudget).toBe(true)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"shell"'), expect.anything())
  })

  it('keeps the earliest mark for a stage', () => {
    useMockClock()
    markBoot()
    clock = 100
    const first = markStage('live')
    clock = 900
    const second = markStage('live')

    expect(second).toBe(first)
    expect(second.at).toBe(100)
  })

  it('boots implicitly if markBoot was never called', () => {
    const record = markStage('idle')
    expect(record.stage).toBe('idle')
    expect(record.at).toBeGreaterThanOrEqual(0)
  })
})

describe('getStartupReport', () => {
  it('is empty before boot and reports booted after', () => {
    expect(getStartupReport()).toEqual({
      booted: false,
      stages: [],
      overBudget: [],
      elapsedMs: 0,
    })

    markBoot()
    expect(getStartupReport().booted).toBe(true)
  })

  it('summarises stages and over-budget entries in canonical order', () => {
    useMockClock()
    markBoot()
    clock = 500
    markStage('shell')
    clock = 9000
    markStage('live')

    const report = getStartupReport()
    expect(report.stages.map((s) => s.stage)).toEqual(['shell', 'live'])
    expect(report.overBudget).toEqual(['live'])
  })

  it('notifies subscribers with the fresh report', () => {
    const listener = vi.fn()
    const unsubscribe = onStartupStage(listener)

    markBoot()
    markStage('shell')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].stages[0].stage).toBe('shell')

    unsubscribe()
    markStage('idle')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('runWhenIdle', () => {
  it('uses requestIdleCallback when available', () => {
    const ric = vi.fn((cb: () => void) => {
      cb()
      return 1
    })
    vi.stubGlobal('requestIdleCallback', ric)
    const callback = vi.fn()

    runWhenIdle(callback)

    expect(ric).toHaveBeenCalledWith(callback, { timeout: 2000 })
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('falls back to setTimeout when requestIdleCallback is unavailable', () => {
    vi.stubGlobal('requestIdleCallback', undefined)
    const timeout = vi.fn((cb: () => void) => {
      cb()
      return 0
    })
    vi.stubGlobal('setTimeout', timeout)
    const callback = vi.fn()

    runWhenIdle(callback)

    expect(timeout).toHaveBeenCalledWith(callback, 1)
    expect(callback).toHaveBeenCalledTimes(1)
  })
})

describe('afterFirstPaint', () => {
  it('invokes the callback after two animation frames', () => {
    const callbacks: FrameRequestCallback[] = []
    const raf = vi.fn((cb: FrameRequestCallback) => {
      callbacks.push(cb)
      return callbacks.length
    })
    vi.stubGlobal('requestAnimationFrame', raf)
    const callback = vi.fn()

    afterFirstPaint(callback)

    expect(raf).toHaveBeenCalledTimes(1)
    expect(callback).not.toHaveBeenCalled()

    callbacks.shift()!(0)
    expect(raf).toHaveBeenCalledTimes(2)
    expect(callback).not.toHaveBeenCalled()

    callbacks.shift()!(0)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('falls back to setTimeout when requestAnimationFrame is unavailable', () => {
    vi.stubGlobal('requestAnimationFrame', undefined)
    const timeout = vi.fn((cb: () => void) => {
      cb()
      return 0
    })
    vi.stubGlobal('setTimeout', timeout)
    const callback = vi.fn()

    afterFirstPaint(callback)

    expect(timeout).toHaveBeenCalledWith(callback, 1)
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
