// ---------------------------------------------------------------------------
// Scheduler — lightweight client-side job runner
// ---------------------------------------------------------------------------
//
// Provides a simple interval-based scheduler that can be driven either by
// a real `setInterval` loop or by explicit `tick()` calls (useful in tests).
//
// Usage:
//   const id = clientScheduler.addJob({
//     intervalMs: 60_000,
//     nextRunAt: Date.now(),
//     label: 'hourly-report',
//     run: async () => { /* ... */ },
//   })
//   clientScheduler.removeJob(id)

/** A single scheduled job. */
export interface SchedulerJob {
  /** Unique identifier returned by {@link ClientScheduler.addJob}. */
  id: string
  /** How often the job should run, in milliseconds. */
  intervalMs: number
  /** Unix timestamp (ms) when the job is next due to run. */
  nextRunAt: number
  /** Human-readable label for debugging and display. */
  label: string
  /** The work to perform. May be async; errors are caught and logged. */
  run: () => void | Promise<void>
}

// ---------------------------------------------------------------------------
// ClientScheduler
// ---------------------------------------------------------------------------

let _counter = 0

/** Generate a monotonically incrementing string id. */
function nextId(): string {
  _counter += 1
  return `scheduler-job-${_counter}`
}

export class ClientScheduler {
  private _jobs: Map<string, SchedulerJob> = new Map()

  /**
   * Register a new job. An `id` is generated and returned.
   * The job is stored internally and will fire on the next `tick()` call
   * when `now >= nextRunAt`.
   */
  addJob(job: Omit<SchedulerJob, 'id'>): string {
    const id = nextId()
    this._jobs.set(id, { ...job, id })
    return id
  }

  /**
   * Unregister a job by id.
   * Silently ignores unknown ids.
   */
  removeJob(id: string): void {
    this._jobs.delete(id)
  }

  /**
   * Advance the scheduler to `now` (defaults to `Date.now()`).
   *
   * Any job whose `nextRunAt <= now` is executed immediately and its
   * `nextRunAt` is advanced by `intervalMs`. Jobs that error are logged
   * but do not block the remaining jobs from running.
   */
  tick(now: number = Date.now()): void {
    for (const job of this._jobs.values()) {
      if (now >= job.nextRunAt) {
        // Advance before running so a long async job doesn't double-fire
        // if tick() is called again before the promise resolves.
        job.nextRunAt = now + job.intervalMs

        try {
          const result = job.run()
          if (result instanceof Promise) {
            result.catch((err: unknown) => {
              console.error(`[ClientScheduler] job "${job.label}" (${job.id}) failed:`, err)
            })
          }
        } catch (err) {
          console.error(`[ClientScheduler] job "${job.label}" (${job.id}) threw synchronously:`, err)
        }
      }
    }
  }

  /**
   * Return a snapshot of all currently registered jobs.
   * The returned array is a copy; mutations do not affect the scheduler.
   */
  getJobs(): SchedulerJob[] {
    return Array.from(this._jobs.values())
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/** Shared scheduler instance. Import and use this throughout the app. */
export const clientScheduler = new ClientScheduler()
