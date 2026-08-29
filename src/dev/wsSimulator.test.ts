import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applySimulation,
  buildSampleSequence,
  configureSimulation,
  getRecordedFrames,
  getSimulationConfig,
  isRecording,
  replaySequence,
  resetSimulation,
  seedSimulationRandom,
  startRecording,
  stopRecording,
  subscribeSimulation,
  type RecordedFrame,
} from './wsSimulator'
import type { WsMessage, WsPriceUpdate } from '../types'

function priceUpdate(overrides: Partial<WsPriceUpdate> = {}): WsPriceUpdate {
  return {
    type: 'price_update',
    assetPair: 'BTC/USD',
    price: 50_000,
    timestamp: Date.now(),
    confidence: 0.95,
    sources: ['chainlink', 'redstone'],
    ...overrides,
  }
}

afterEach(() => {
  resetSimulation()
  vi.useRealTimers()
})

describe('wsSimulator config', () => {
  it('defaults to disabled/off', () => {
    const c = getSimulationConfig()
    expect(c.enabled).toBe(false)
    expect(c.mode).toBe('off')
  })

  it('configureSimulation patches and notifies subscribers', () => {
    const listener = vi.fn()
    const unsub = subscribeSimulation(listener)
    listener.mockClear()
    configureSimulation({ enabled: true, mode: 'drop' })
    expect(getSimulationConfig()).toMatchObject({ enabled: true, mode: 'drop' })
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, mode: 'drop' }))
    unsub()
  })

  it('resetSimulation restores defaults', () => {
    configureSimulation({ enabled: true, mode: 'flood', dropRate: 0.9 })
    resetSimulation()
    expect(getSimulationConfig()).toMatchObject({ enabled: false, mode: 'off' })
  })
})

describe('applySimulation — passthrough', () => {
  it('dispatches unchanged when disabled', () => {
    const dispatch = vi.fn()
    const msg = priceUpdate()
    applySimulation(msg, dispatch)
    expect(dispatch).toHaveBeenCalledWith(msg)
  })

  it('dispatches unchanged when enabled with mode off', () => {
    configureSimulation({ enabled: true, mode: 'off' })
    const dispatch = vi.fn()
    const msg = priceUpdate()
    applySimulation(msg, dispatch)
    expect(dispatch).toHaveBeenCalledWith(msg)
  })
})

describe('applySimulation — drop mode', () => {
  it('drops roughly dropRate of messages given a fixed seed', () => {
    seedSimulationRandom(1)
    configureSimulation({ enabled: true, mode: 'drop', dropRate: 1 }) // always drop
    const dispatch = vi.fn()
    for (let i = 0; i < 10; i++) applySimulation(priceUpdate(), dispatch)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('never drops when dropRate is 0', () => {
    configureSimulation({ enabled: true, mode: 'drop', dropRate: 0 })
    const dispatch = vi.fn()
    for (let i = 0; i < 10; i++) applySimulation(priceUpdate(), dispatch)
    expect(dispatch).toHaveBeenCalledTimes(10)
  })
})

describe('applySimulation — throttle mode', () => {
  it('delays dispatch by throttleMs without dispatching synchronously', () => {
    vi.useFakeTimers()
    configureSimulation({ enabled: true, mode: 'throttle', throttleMs: 1000 })
    const dispatch = vi.fn()
    applySimulation(priceUpdate(), dispatch)
    expect(dispatch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(999)
    expect(dispatch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(dispatch).toHaveBeenCalledTimes(1)
  })
})

describe('applySimulation — flood mode', () => {
  it('dispatches the original plus floodCopies duplicates', () => {
    configureSimulation({ enabled: true, mode: 'flood', floodCopies: 4 })
    const dispatch = vi.fn()
    applySimulation(priceUpdate(), dispatch)
    expect(dispatch).toHaveBeenCalledTimes(5) // 1 original + 4 copies
  })
})

describe('applySimulation — source targeting', () => {
  it('downtime removes the target source and lowers confidence', () => {
    configureSimulation({
      enabled: true,
      mode: 'off',
      sourceTargets: [{ source: 'chainlink', effect: 'downtime', magnitude: 0 }],
    })
    const dispatch = vi.fn()
    applySimulation(priceUpdate({ sources: ['chainlink', 'redstone'], confidence: 0.9 }), dispatch)
    const [sent] = dispatch.mock.calls[0] as [WsPriceUpdate]
    expect(sent.sources).toEqual(['redstone'])
    expect(sent.confidence).toBeLessThan(0.9)
  })

  it('drops the message entirely when every contributing source is down', () => {
    configureSimulation({
      enabled: true,
      mode: 'off',
      sourceTargets: [{ source: 'chainlink', effect: 'downtime', magnitude: 0 }],
    })
    const dispatch = vi.fn()
    applySimulation(priceUpdate({ sources: ['chainlink'] }), dispatch)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('divergence perturbs price within ±magnitude, deterministically for a fixed seed', () => {
    seedSimulationRandom(7)
    configureSimulation({
      enabled: true,
      mode: 'off',
      sourceTargets: [{ source: 'chainlink', effect: 'divergence', magnitude: 0.1 }],
    })
    const dispatch = vi.fn()
    applySimulation(priceUpdate({ price: 100, sources: ['chainlink'] }), dispatch)
    const [sent] = dispatch.mock.calls[0] as [WsPriceUpdate]
    expect(sent.price).toBeGreaterThanOrEqual(90)
    expect(sent.price).toBeLessThanOrEqual(110)
    expect(sent.price).not.toBe(100)
  })

  it('leaves messages from untargeted sources untouched', () => {
    configureSimulation({
      enabled: true,
      mode: 'off',
      sourceTargets: [{ source: 'band', effect: 'downtime', magnitude: 0 }],
    })
    const dispatch = vi.fn()
    const msg = priceUpdate({ sources: ['chainlink', 'redstone'] })
    applySimulation(msg, dispatch)
    expect(dispatch).toHaveBeenCalledWith(msg)
  })

  it('welcome (non price_update) messages pass through source targeting untouched', () => {
    configureSimulation({
      enabled: true,
      mode: 'off',
      sourceTargets: [{ source: 'chainlink', effect: 'downtime', magnitude: 0 }],
    })
    const dispatch = vi.fn()
    const welcome: WsMessage = { type: 'welcome', protocolVersion: 1 }
    applySimulation(welcome, dispatch)
    expect(dispatch).toHaveBeenCalledWith(welcome)
  })
})

describe('recording', () => {
  beforeEach(() => vi.useFakeTimers().setSystemTime(0))

  it('captures frames with offsets relative to recording start', () => {
    startRecording()
    expect(isRecording()).toBe(true)
    applySimulation(priceUpdate({ price: 1 }), vi.fn())
    vi.setSystemTime(250)
    applySimulation(priceUpdate({ price: 2 }), vi.fn())
    const frames = stopRecording()
    expect(isRecording()).toBe(false)
    expect(frames.map((f) => f.offsetMs)).toEqual([0, 250])
    expect(getRecordedFrames()).toEqual(frames)
  })

  it('does not record while inactive', () => {
    applySimulation(priceUpdate(), vi.fn())
    expect(getRecordedFrames()).toEqual([])
  })
})

describe('replaySequence', () => {
  it('dispatches each frame at its recorded offset, anchored to a single start time (no drift)', () => {
    vi.useFakeTimers()
    const frames: RecordedFrame[] = [
      { msg: priceUpdate({ price: 1 }), offsetMs: 0 },
      { msg: priceUpdate({ price: 2 }), offsetMs: 500 },
      { msg: priceUpdate({ price: 3 }), offsetMs: 1000 },
    ]
    const dispatch = vi.fn()
    replaySequence(frames, dispatch)

    vi.advanceTimersByTime(0)
    expect(dispatch).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(500)
    expect(dispatch).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(500)
    expect(dispatch).toHaveBeenCalledTimes(3)
  })

  it('stop() cancels any frames not yet dispatched', () => {
    vi.useFakeTimers()
    const frames: RecordedFrame[] = [
      { msg: priceUpdate({ price: 1 }), offsetMs: 0 },
      { msg: priceUpdate({ price: 2 }), offsetMs: 1000 },
    ]
    const dispatch = vi.fn()
    const handle = replaySequence(frames, dispatch)
    vi.advanceTimersByTime(0)
    expect(dispatch).toHaveBeenCalledTimes(1)
    handle.stop()
    vi.advanceTimersByTime(1000)
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('is deterministic across repeated runs given the same frames', () => {
    vi.useFakeTimers()
    const frames = buildSampleSequence('ETH/USD')
    const order1: number[] = []
    const order2: number[] = []

    replaySequence(frames, (m) => order1.push((m as WsPriceUpdate).price))
    vi.advanceTimersByTime(10_000)

    replaySequence(frames, (m) => order2.push((m as WsPriceUpdate).price))
    vi.advanceTimersByTime(10_000)

    expect(order1).toEqual(order2)
  })
})

describe('buildSampleSequence', () => {
  it('returns frames sorted by non-decreasing offset for the given pair', () => {
    const frames = buildSampleSequence('XLM/USD')
    expect(frames.length).toBeGreaterThan(0)
    expect(frames.every((f) => f.msg.type === 'price_update' && f.msg.assetPair === 'XLM/USD')).toBe(true)
    const offsets = frames.map((f) => f.offsetMs)
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets)
  })
})
