import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ClientScheduler } from './scheduler'

describe('ClientScheduler', () => {
  let scheduler: ClientScheduler

  beforeEach(() => {
    vi.useFakeTimers()
    scheduler = new ClientScheduler()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // ── addJob / getJobs ──────────────────────────────────────────────────────

  it('adds a job and returns a string id', () => {
    const id = scheduler.addJob({
      intervalMs: 1_000,
      nextRunAt: Date.now() + 1_000,
      label: 'test-job',
      run: vi.fn(),
    })
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('returns unique ids for each job', () => {
    const id1 = scheduler.addJob({ intervalMs: 1_000, nextRunAt: Date.now() + 1_000, label: 'a', run: vi.fn() })
    const id2 = scheduler.addJob({ intervalMs: 1_000, nextRunAt: Date.now() + 1_000, label: 'b', run: vi.fn() })
    expect(id1).not.toBe(id2)
  })

  it('getJobs reflects added jobs', () => {
    scheduler.addJob({ intervalMs: 1_000, nextRunAt: Date.now() + 1_000, label: 'job-1', run: vi.fn() })
    expect(scheduler.getJobs()).toHaveLength(1)
    expect(scheduler.getJobs()[0].label).toBe('job-1')
  })

  it('getJobs returns a copy — mutations do not affect internals', () => {
    scheduler.addJob({ intervalMs: 1_000, nextRunAt: Date.now() + 1_000, label: 'j', run: vi.fn() })
    const jobs = scheduler.getJobs()
    jobs.splice(0)
    expect(scheduler.getJobs()).toHaveLength(1)
  })

  // ── removeJob ─────────────────────────────────────────────────────────────

  it('removes a job by id', () => {
    const id = scheduler.addJob({ intervalMs: 1_000, nextRunAt: Date.now() + 1_000, label: 'r', run: vi.fn() })
    scheduler.removeJob(id)
    expect(scheduler.getJobs()).toHaveLength(0)
  })

  it('silently ignores unknown ids', () => {
    expect(() => scheduler.removeJob('nonexistent')).not.toThrow()
  })

  // ── tick ──────────────────────────────────────────────────────────────────

  it('does not run a job whose nextRunAt is in the future', () => {
    const run = vi.fn()
    const now = Date.now()
    scheduler.addJob({ intervalMs: 1_000, nextRunAt: now + 5_000, label: 'future', run })
    scheduler.tick(now)
    expect(run).not.toHaveBeenCalled()
  })

  it('runs a job whose nextRunAt has passed', () => {
    const run = vi.fn()
    const now = Date.now()
    scheduler.addJob({ intervalMs: 1_000, nextRunAt: now - 1, label: 'due', run })
    scheduler.tick(now)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('advances nextRunAt by intervalMs after running', () => {
    const run = vi.fn()
    const now = 1_000
    const id = scheduler.addJob({ intervalMs: 500, nextRunAt: now - 1, label: 'reschedule', run })
    scheduler.tick(now)
    const job = scheduler.getJobs().find((j) => j.id === id)
    // nextRunAt should be now + intervalMs = 1_500
    expect(job?.nextRunAt).toBe(now + 500)
  })

  it('runs multiple due jobs in a single tick', () => {
    const run1 = vi.fn()
    const run2 = vi.fn()
    const now = Date.now()
    scheduler.addJob({ intervalMs: 1_000, nextRunAt: now - 100, label: 'a', run: run1 })
    scheduler.addJob({ intervalMs: 1_000, nextRunAt: now - 200, label: 'b', run: run2 })
    scheduler.tick(now)
    expect(run1).toHaveBeenCalledTimes(1)
    expect(run2).toHaveBeenCalledTimes(1)
  })

  it('does not run a job that was removed before tick', () => {
    const run = vi.fn()
    const now = Date.now()
    const id = scheduler.addJob({ intervalMs: 1_000, nextRunAt: now - 1, label: 'removed', run })
    scheduler.removeJob(id)
    scheduler.tick(now)
    expect(run).not.toHaveBeenCalled()
  })

  it('catches and does not rethrow synchronous errors in run()', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const now = Date.now()
    scheduler.addJob({
      intervalMs: 1_000,
      nextRunAt: now - 1,
      label: 'throwing',
      run: () => {
        throw new Error('boom')
      },
    })
    expect(() => scheduler.tick(now)).not.toThrow()
    consoleSpy.mockRestore()
  })

  it('continues running other jobs after one throws', () => {
    const run = vi.fn()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const now = Date.now()
    scheduler.addJob({
      intervalMs: 1_000,
      nextRunAt: now - 1,
      label: 'throwing',
      run: () => {
        throw new Error('boom')
      },
    })
    scheduler.addJob({ intervalMs: 1_000, nextRunAt: now - 1, label: 'ok', run })
    scheduler.tick(now)
    expect(run).toHaveBeenCalledTimes(1)
    consoleSpy.mockRestore()
  })

  it('uses Date.now() as default when tick() is called without arguments', () => {
    const run = vi.fn()
    vi.setSystemTime(5_000)
    // nextRunAt is in the past relative to now (5_000)
    scheduler.addJob({ intervalMs: 1_000, nextRunAt: 1_000, label: 'now-default', run })
    scheduler.tick()
    expect(run).toHaveBeenCalledTimes(1)
  })
})
