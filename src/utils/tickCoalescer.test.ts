import { describe, it, expect } from 'vitest'
import { TickCoalescer, createFlushPump, TICK_POLICY } from './tickCoalescer'

/**
 * Deterministic stand-in for the browser: a manually-advanced clock plus a
 * queue of scheduled "animation frames". `advance` moves time without running
 * frames (a hidden tab), `runFrames` runs everything queued without moving time.
 */
function createFakeClock() {
  let now = 0
  let nextId = 1
  const frames = new Map<number, () => void>()

  return {
    now: () => now,
    scheduleFrame: (callback: () => void) => {
      const id = nextId++
      frames.set(id, callback)
      return id
    },
    cancelFrame: (id: number) => {
      frames.delete(id)
    },
    advance: (ms: number) => {
      now += ms
    },
    runFrames: () => {
      const queued = Array.from(frames.values())
      frames.clear()
      queued.forEach((callback) => callback())
    },
    pendingFrames: () => frames.size,
  }
}

function makePump<T>(coalescer: TickCoalescer<T>) {
  const clock = createFakeClock()
  const applied: Array<Array<[string, T]>> = []
  const pump = createFlushPump(coalescer, (batch) => applied.push(batch), {
    now: clock.now,
    scheduleFrame: clock.scheduleFrame,
    cancelFrame: clock.cancelFrame,
  })
  return { clock, applied, pump }
}

describe('TickCoalescer', () => {
  it('keeps only the newest tick per pair', () => {
    const coalescer = new TickCoalescer<number>()

    coalescer.enqueue('BTC/USD', 1)
    coalescer.enqueue('BTC/USD', 2)
    coalescer.enqueue('BTC/USD', 3)

    expect(coalescer.drain()).toEqual([['BTC/USD', 3]])

    const stats = coalescer.getStats()
    expect(stats.received).toBe(3)
    expect(stats.coalesced).toBe(2)
    expect(stats.flushed).toBe(1)
  })

  it('preserves every distinct pair in insertion order', () => {
    const coalescer = new TickCoalescer<number>()
    coalescer.enqueue('ETH/USD', 1)
    coalescer.enqueue('BTC/USD', 2)
    coalescer.enqueue('XLM/USD', 3)

    expect(coalescer.drain()).toEqual([
      ['ETH/USD', 1],
      ['BTC/USD', 2],
      ['XLM/USD', 3],
    ])
  })

  it('returns and records nothing when drained empty', () => {
    const coalescer = new TickCoalescer<number>()
    expect(coalescer.drain()).toEqual([])
    expect(coalescer.getStats().flushes).toBe(0)
    expect(coalescer.getStats().lastFlushAt).toBeNull()
  })

  it('clears the buffer on drain and records the flush time', () => {
    const coalescer = new TickCoalescer<number>()
    coalescer.enqueue('BTC/USD', 1)

    coalescer.drain(1234)

    expect(coalescer.size).toBe(0)
    expect(coalescer.drain()).toEqual([])
    expect(coalescer.getStats().lastFlushAt).toBe(1234)
  })

  describe('overflow policy', () => {
    it('drops a tick for a new pair once the buffer is full, and counts it', () => {
      const coalescer = new TickCoalescer<number>(2)
      coalescer.enqueue('A', 1)
      coalescer.enqueue('B', 1)
      coalescer.enqueue('C', 1)

      const stats = coalescer.getStats()
      expect(stats.dropped).toBe(1)
      expect(stats.pending).toBe(2)
      expect(stats.peakPending).toBe(2)
      // The tracked pairs are never evicted to make room for a new one.
      expect(coalescer.drain().map(([pair]) => pair)).toEqual(['A', 'B'])
    })

    it('still accepts a newer tick for an already-tracked pair at the cap', () => {
      const coalescer = new TickCoalescer<number>(2)
      coalescer.enqueue('A', 1)
      coalescer.enqueue('B', 1)
      coalescer.enqueue('A', 2)

      expect(coalescer.getStats().dropped).toBe(0)
      expect(coalescer.drain()).toEqual([
        ['A', 2],
        ['B', 1],
      ])
    })
  })

  it('reports a zero coalesce ratio before anything arrives', () => {
    expect(new TickCoalescer<number>().getStats().coalesceRatio).toBe(0)
  })

  it('reset clears buffered work and counters', () => {
    const coalescer = new TickCoalescer<number>()
    coalescer.enqueue('BTC/USD', 1)
    coalescer.drain()

    coalescer.reset()

    expect(coalescer.size).toBe(0)
    expect(coalescer.getStats()).toEqual({
      received: 0,
      coalesced: 0,
      dropped: 0,
      flushed: 0,
      flushes: 0,
      pending: 0,
      peakPending: 0,
      coalesceRatio: 0,
      lastFlushAt: null,
    })
  })
})

describe('createFlushPump', () => {
  it('applies the first tick immediately so a slow feed pays no added latency', () => {
    const coalescer = new TickCoalescer<number>()
    const { applied, pump, clock } = makePump(coalescer)

    coalescer.enqueue('BTC/USD', 1)
    pump.request()

    expect(applied).toEqual([[['BTC/USD', 1]]])
    expect(clock.pendingFrames()).toBe(0)
  })

  it('coalesces a burst into a single flush on the next frame', () => {
    const coalescer = new TickCoalescer<number>()
    const { applied, pump, clock } = makePump(coalescer)

    for (let i = 0; i < 50; i++) {
      coalescer.enqueue('BTC/USD', i)
      pump.request()
    }

    // Nothing has been painted yet — the tick storm is sitting in one slot.
    expect(applied).toHaveLength(1)
    expect(coalescer.size).toBe(1)
    expect(clock.pendingFrames()).toBe(1)

    clock.runFrames()

    // One flush for all 50 ticks, carrying the newest value.
    expect(applied).toEqual([[['BTC/USD', 0]], [['BTC/USD', 49]]])
    // 50 ticks in, 2 flushes out: tick 0 applied immediately, tick 49 on the
    // frame, and the 48 in between superseded and counted.
    expect(coalescer.getStats().coalesced).toBe(48)
    expect(coalescer.getStats().flushed + coalescer.getStats().coalesced).toBe(50)
  })

  it('never schedules more than one frame while a flush is pending', () => {
    const coalescer = new TickCoalescer<number>()
    const { pump, clock } = makePump(coalescer)

    pump.request() // flushes immediately
    for (let i = 0; i < 20; i++) {
      coalescer.enqueue(`PAIR${i}`, i)
      pump.request()
    }

    expect(clock.pendingFrames()).toBe(1)
  })

  it('flushNow bypasses the paint-cadence gate', () => {
    const coalescer = new TickCoalescer<number>()
    const { applied, pump } = makePump(coalescer)

    coalescer.enqueue('BTC/USD', 1)
    pump.request() // immediate
    coalescer.enqueue('BTC/USD', 2)
    pump.request() // frame-paced from here

    pump.flushNow()

    expect(applied).toEqual([[['BTC/USD', 1]], [['BTC/USD', 2]]])
  })

  it('stop cancels a pending frame and rejects further work', () => {
    const coalescer = new TickCoalescer<number>()
    const { applied, pump, clock } = makePump(coalescer)

    coalescer.enqueue('BTC/USD', 1)
    pump.request() // immediate flush
    coalescer.enqueue('BTC/USD', 2)
    pump.request() // schedules a frame

    pump.stop()
    clock.advance(1_000)
    clock.runFrames()

    expect(applied).toHaveLength(1)
    expect(clock.pendingFrames()).toBe(0)

    coalescer.enqueue('BTC/USD', 3)
    pump.request()
    pump.flushNow()
    expect(applied).toHaveLength(1)
  })

  it('honours a custom flush interval', () => {
    const coalescer = new TickCoalescer<number>()
    const clock = createFakeClock()
    const applied: Array<Array<[string, number]>> = []
    const pump = createFlushPump(coalescer, (batch) => applied.push(batch), {
      now: clock.now,
      scheduleFrame: clock.scheduleFrame,
      cancelFrame: clock.cancelFrame,
      flushIntervalMs: 5_000,
    })

    coalescer.enqueue('BTC/USD', 1)
    pump.request()
    expect(applied).toHaveLength(1)

    // Well inside the interval — the next tick must wait for the frame.
    clock.advance(100)
    coalescer.enqueue('BTC/USD', 2)
    pump.request()
    expect(applied).toHaveLength(1)

    clock.runFrames()
    expect(applied).toHaveLength(2)
  })
})

describe('tick policy under load', () => {
  /**
   * A 200 ticks/sec flood delivered across `pairCount` pairs into a renderer
   * painting at `frameHz`. Returns the applied batches plus the final stats so
   * each scenario can assert its own invariants.
   */
  function runFlood(options: {
    durationMs: number
    ticksPerSecond: number
    frameHz: number
    pairCount: number
    /** Invoked after every enqueue with the current pending depth. */
    onPending?: (pending: number) => void
  }) {
    const { durationMs, ticksPerSecond, frameHz, pairCount, onPending } = options
    const tickIntervalMs = 1000 / ticksPerSecond
    const frameIntervalMs = 1000 / frameHz

    const pairs = Array.from({ length: pairCount }, (_, i) => `PAIR${i}/USD`)
    const coalescer = new TickCoalescer<number>()
    const clock = createFakeClock()
    const applied: Array<Array<[string, number]>> = []
    const pump = createFlushPump(coalescer, (batch) => applied.push(batch), {
      now: clock.now,
      scheduleFrame: clock.scheduleFrame,
      cancelFrame: clock.cancelFrame,
    })

    const totalTicks = Math.round((durationMs / 1000) * ticksPerSecond)
    let nextFrameAt = 0
    let seq = 0

    for (let i = 0; i < totalTicks; i++) {
      clock.advance(tickIntervalMs)
      const pair = pairs[seq % pairs.length]
      seq++
      coalescer.enqueue(pair, seq)
      pump.request()
      onPending?.(coalescer.size)

      if (clock.now() >= nextFrameAt) {
        nextFrameAt = clock.now() + frameIntervalMs
        clock.runFrames()
      }
    }

    clock.runFrames()

    return { coalescer, applied, stats: coalescer.getStats(), pairs }
  }

  it('keeps memory bounded and flushes at the frame rate, not the tick rate', () => {
    // 200 ticks/sec across 20 pairs into a 30 Hz renderer, sustained for 5s.
    let peakObserved = 0
    const { stats, pairs } = runFlood({
      durationMs: 5_000,
      ticksPerSecond: 200,
      frameHz: 30,
      pairCount: 20,
      onPending: (pending) => {
        peakObserved = Math.max(peakObserved, pending)
      },
    })

    // 5s × 200 ticks/sec actually arrived.
    expect(stats.received).toBe(1_000)

    // The failure mode this replaces: an unbounded queue. Pending work never
    // exceeds the number of pairs being tracked, no matter the tick rate.
    expect(peakObserved).toBeLessThanOrEqual(pairs.length)
    expect(stats.peakPending).toBeLessThanOrEqual(pairs.length)
    expect(stats.dropped).toBe(0)

    // Commits are decoupled from ticks: ~150 flushes for 30 Hz over 5s, not 1000.
    expect(stats.flushes).toBeGreaterThan(100)
    expect(stats.flushes).toBeLessThan(200)

    // Conservation of ticks — every tick is accounted for, none vanish silently.
    expect(stats.flushed + stats.coalesced + stats.dropped + stats.pending).toBe(stats.received)
  })

  it('collapses 200 ticks/sec on a single hot pair down to one value per frame', () => {
    const { applied, stats } = runFlood({
      durationMs: 5_000,
      ticksPerSecond: 200,
      frameHz: 30,
      pairCount: 1,
    })

    expect(stats.received).toBe(1_000)
    // ~6-7 ticks arrive per 30 Hz frame and exactly one survives it, so the
    // coalesce ratio converges on 1 - (frame rate / tick rate).
    expect(stats.coalesceRatio).toBeCloseTo(1 - 30 / 200, 1)
    expect(stats.coalesced).toBeGreaterThan(800)
    expect(stats.peakPending).toBe(1)
    expect(stats.flushed + stats.coalesced + stats.dropped + stats.pending).toBe(stats.received)

    // Latest-wins: the final applied value is the newest tick, not a stale one
    // from the start of the flood.
    const lastBatch = applied[applied.length - 1]
    expect(lastBatch[0][1]).toBe(1_000)

    // Values applied per pair increase monotonically — no tick is applied twice
    // and none arrives out of order.
    const appliedValues = applied.map((batch) => batch[0][1])
    expect(appliedValues).toEqual([...appliedValues].sort((a, b) => a - b))
  })

  it('stays bounded when frames stop firing entirely (backgrounded tab)', () => {
    const pairs = ['A/USD', 'B/USD', 'C/USD']
    const coalescer = new TickCoalescer<number>()
    const clock = createFakeClock()
    const applied: Array<Array<[string, number]>> = []
    const pump = createFlushPump(coalescer, (batch) => applied.push(batch), {
      now: clock.now,
      scheduleFrame: clock.scheduleFrame,
      cancelFrame: clock.cancelFrame,
    })

    // 10k ticks with the clock advancing but no frame ever running.
    for (let i = 0; i < 10_000; i++) {
      clock.advance(5)
      coalescer.enqueue(pairs[i % pairs.length], i)
      pump.request()
    }

    const stats = coalescer.getStats()
    expect(stats.received).toBe(10_000)
    // A hidden tab degrades to "stale but bounded" — never "growing forever".
    expect(stats.pending).toBe(pairs.length)
    expect(stats.peakPending).toBe(pairs.length)
    expect(stats.dropped).toBe(0)

    // The first frame after the tab is visible paints the newest tick per pair.
    clock.runFrames()
    expect(new Map(applied[applied.length - 1])).toEqual(
      new Map([
        ['A/USD', 9_999],
        ['B/USD', 9_997],
        ['C/USD', 9_998],
      ]),
    )
  })

  it('drops the overflow instead of growing once distinct pairs exceed the cap', () => {
    const coalescer = new TickCoalescer<number>(3)
    const { applied, pump } = makePump(coalescer)

    // A misbehaving feed announcing an unbounded number of pairs.
    for (let i = 0; i < 100; i++) {
      coalescer.enqueue(`PAIR${i}/USD`, i)
      pump.request()
    }

    const stats = coalescer.getStats()
    expect(stats.pending).toBeLessThanOrEqual(3)
    expect(stats.dropped).toBeGreaterThan(0)
    expect(stats.flushed + stats.coalesced + stats.dropped + stats.pending).toBe(stats.received)
    expect(applied.flat().length).toBeLessThanOrEqual(3)
  })

  it('exposes a default policy sane enough for a 60 Hz display', () => {
    expect(TICK_POLICY.flushIntervalMs).toBeCloseTo(16.67, 1)
    expect(TICK_POLICY.maxPendingPairs).toBeGreaterThan(0)
    expect(TICK_POLICY.revalidateIntervalMs).toBe(1_000)
  })
})
