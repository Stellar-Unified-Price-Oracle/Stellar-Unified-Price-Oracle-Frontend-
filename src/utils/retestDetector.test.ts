import { describe, it, expect } from 'vitest'
import { initialRetestState, stepRetest, type RetestState } from './retestDetector'

const T0 = 1_000_000

function inZone(prev: RetestState, price: number, delta = 1000): { state: RetestState; event: ReturnType<typeof stepRetest>['event'] } {
  const res = stepRetest(prev, true, price, T0 + delta)
  return { state: res.state, event: res.event }
}
function out(prev: RetestState, price: number, delta = 2000): { state: RetestState; event: ReturnType<typeof stepRetest>['event'] } {
  const res = stepRetest(prev, false, price, T0 + delta)
  return { state: res.state, event: res.event }
}

describe('stepRetest (#491)', () => {
  it('emits breach on first entry into the zone', () => {
    const { state, event } = inZone(initialRetestState(T0), 70000)
    expect(event?.kind).toBe('breach')
    expect(state.phase).toBe('inBreach')
    expect(state.cycles).toBe(1)
  })

  it('does not re-emit breach while remaining inside the zone', () => {
    const entered = inZone(initialRetestState(T0), 70000).state
    const again = inZone(entered, 71000, 100)
    expect(again.event).toBeNull()
    expect(again.state.phase).toBe('inBreach')
  })

  it('emits exit when leaving the zone and increments cycles', () => {
    const entered = inZone(initialRetestState(T0), 70000).state
    const { state, event } = out(entered, 60000)
    expect(event?.kind).toBe('exit')
    expect(event?.cycle).toBe(1)
    expect(state.phase).toBe('exited')
    expect(state.cycles).toBe(1)
  })

  it('emits retest on re-entry after an exit', () => {
    const entered = inZone(initialRetestState(T0), 70000).state
    const exited = out(entered, 60000).state
    const { state, event } = inZone(exited, 70000, 3000)
    expect(event?.kind).toBe('retest')
    expect(state.phase).toBe('inBreach')
  })

  it('tracks the full breach → exit → retest sequence', () => {
    let state = initialRetestState(T0)

    let e = inZone(state, 70000).event
    state = inZone(state, 70000).state
    expect(e?.kind).toBe('breach')

    e = out(state, 60000).event
    state = out(state, 60000).state
    expect(e?.kind).toBe('exit')
    expect(state.cycles).toBe(1)

    e = inZone(state, 70000, 3000).event
    state = inZone(state, 70000, 3000).state
    expect(e?.kind).toBe('retest')
    expect(e?.cycle).toBe(1)
  })

  it('is deterministic for identical inputs', () => {
    const a = inZone(initialRetestState(T0), 70000)
    const b = inZone(initialRetestState(T0), 70000)
    expect(a.state).toEqual(b.state)
    expect(a.event).toEqual(b.event)
  })

  it('stays idle when never in zone', () => {
    const { state, event } = out(initialRetestState(T0), 50000)
    expect(event).toBeNull()
    expect(state.phase).toBe('idle')
  })
})