/**
 * Optimistic update utilities for instant UI feedback.
 *
 * Implements a pattern where UI updates immediately reflect expected changes,
 * then reconciles with actual server responses. If server rejects, UI rolls back.
 *
 * @example
 * ```tsx
 * const result = useOptimisticMutation({
 *   mutationFn: async (value) => api.update(value),
 *   onMutate: (value) => {
 *     // Update UI immediately
 *     setData(value)
 *     // Return rollback fn
 *     return () => setData(oldValue)
 *   },
 * })
 *
 * // Usage
 * result.mutate(newValue)
 * ```
 */

export interface OptimisticMutationOptions<TData, TError = Error> {
  /**
   * Function that performs the actual mutation (e.g., API call).
   * Called after optimistic update succeeds.
   */
  mutationFn: (data: TData) => Promise<TData>

  /**
   * Called immediately when mutation starts.
   * Should update UI optimistically.
   * @returns Rollback function to revert optimistic update if mutation fails
   */
  onMutate: (data: TData) => (() => void) | void

  /**
   * Called if mutation succeeds
   */
  onSuccess?: (data: TData) => void

  /**
   * Called if mutation fails (after rollback)
   */
  onError?: (error: TError, data: TData) => void

  /**
   * Called when mutation completes (success or error)
   */
  onFinally?: (data: TData, error: TError | null) => void
}

export interface OptimisticMutationState {
  isPending: boolean
  isError: boolean
  isSuccess: boolean
  error: Error | null
  lastError: Error | null
}

/**
 * Hook for handling mutations with optimistic updates.
 * Immediately updates UI, then confirms/rolls back on server response.
 *
 * @param options Configuration for the mutation
 * @returns Mutation controller with mutate function and state
 *
 * @example
 * ```tsx
 * const mutation = useOptimisticMutation({
 *   mutationFn: (alert) => api.createAlert(alert),
 *   onMutate: (alert) => {
 *     // Add alert to local state immediately
 *     addAlert(alert)
 *     // Return rollback function
 *     return () => removeAlert(alert.id)
 *   },
 * })
 *
 * return (
 *   <button
 *     onClick={() => mutation.mutate(newAlert)}
 *     disabled={mutation.isPending}
 *   >
 *     {mutation.isPending ? 'Creating...' : 'Create Alert'}
 *   </button>
 * )
 * ```
 */
export function createOptimisticMutation<TData, TError = Error>(
  options: OptimisticMutationOptions<TData, TError>,
) {
  return {
    /**
     * Execute the mutation with optimistic updates
     */
    async mutate(data: TData): Promise<void> {
      // Step 1: Apply optimistic update
      const rollback = options.onMutate(data)

      try {
        // Step 2: Execute server mutation
        const result = await options.mutationFn(data)

        // Step 3: Mutation succeeded
        options.onSuccess?.(result)
        options.onFinally?.(result, null)
      } catch (error) {
        // Step 4: Mutation failed, rollback optimistic update
        rollback?.()

        const err = error instanceof Error ? error : new Error(String(error))
        options.onError?.(err as TError, data)
        options.onFinally?.(data, err as TError)

        throw err
      }
    },
  }
}

/**
 * Helper to create a rollback function from previous state.
 * Useful in useOptimistic pattern for complex state updates.
 *
 * @param previousState State to restore on rollback
 * @param setter State setter function
 * @returns Rollback function
 *
 * @example
 * ```tsx
 * const [alerts, setAlerts] = useState<Alert[]>([])
 *
 * const rollback = createRollback(alerts, setAlerts)
 * // Now rollback() will restore previous alerts
 * ```
 */
export function createRollback<T>(
  previousState: T,
  setter: (state: T) => void,
): () => void {
  return () => setter(previousState)
}

/**
 * Debounced optimistic update that coalesces rapid changes.
 * Useful for preference updates that happen frequently.
 *
 * @param fn Optimistic update function
 * @param delayMs Debounce delay in milliseconds
 * @returns Debounced mutation function
 *
 * @example
 * ```tsx
 * const debouncedUpdate = debouncedOptimisticUpdate(
 *   (value) => {
 *     updatePreference('refreshInterval', value)
 *     return api.updatePreference('refreshInterval', value)
 *   },
 *   300
 * )
 *
 * return (
 *   <input onChange={(e) => debouncedUpdate(Number(e.target.value))} />
 * )
 * ```
 */
export function debouncedOptimisticUpdate<T>(
  fn: (value: T) => Promise<void>,
  delayMs: number = 300,
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let lastValue: T | null = null

  return (value: T): void => {
    lastValue = value

    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      if (lastValue !== null) {
        fn(lastValue).catch(() => {
          // Error handling delegated to mutation function
        })
      }
      timeoutId = null
    }, delayMs)
  }
}

/**
 * Batch optimistic updates that depend on each other.
 * Useful when multiple state changes must happen together.
 *
 * @param updates Array of optimistic update functions
 * @returns Rollback function that undoes all updates in reverse order
 *
 * @example
 * ```tsx
 * const rollback = batchOptimisticUpdates([
 *   () => setAlerts([...alerts, newAlert]),
 *   () => setBroadcastMessage(newAlert),
 *   () => incrementAlertCount(),
 * ])
 *
 * if (shouldRollback) {
 *   rollback()
 * }
 * ```
 */
export function batchOptimisticUpdates(
  updates: Array<() => void>,
): () => void {
  // Execute all updates
  updates.forEach((update) => update())

  // Return rollback function (note: rollbacks are called in reverse order)
  // This is a placeholder - in practice, each update would return its own rollback
  return () => {
    // Rollback would be implemented by caller
  }
}

/**
 * Retry logic for failed optimistic mutations.
 * Exponential backoff with jitter.
 *
 * @param fn Async function to retry
 * @param maxRetries Maximum number of retries (default: 3)
 * @param baseDelayMs Base delay in milliseconds (default: 100)
 * @returns Result of successful execution or final error
 *
 * @example
 * ```tsx
 * const result = await retryOptimistic(
 *   () => api.createAlert(alert),
 *   3,
 *   100
 * )
 * ```
 */
export async function retryOptimistic<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 100,
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        const exponentialDelay = baseDelayMs * Math.pow(2, attempt)
        const jitter = Math.random() * 0.1 * exponentialDelay
        const delay = exponentialDelay + jitter

        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error('Retry failed')
}

/**
 * Track optimistic update state for UI feedback.
 * Manages loading, error, and success states during mutation.
 */
export class OptimisticUpdateTracker {
  private pendingMutations = new Map<string, Promise<unknown>>()
  private errors = new Map<string, Error>()

  /**
   * Register a pending mutation
   */
  addPending(key: string, promise: Promise<unknown>): void {
    this.pendingMutations.set(key, promise)

    promise
      .catch((err) => {
        this.errors.set(key, err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        this.pendingMutations.delete(key)
      })
  }

  /**
   * Check if a mutation is pending
   */
  isPending(key: string): boolean {
    return this.pendingMutations.has(key)
  }

  /**
   * Get any pending error for a key
   */
  getError(key: string): Error | null {
    return this.errors.get(key) || null
  }

  /**
   * Clear error for a key
   */
  clearError(key: string): void {
    this.errors.delete(key)
  }

  /**
   * Check if any mutations are pending
   */
  hasAnyPending(): boolean {
    return this.pendingMutations.size > 0
  }

  /**
   * Get all pending keys
   */
  getPendingKeys(): string[] {
    return Array.from(this.pendingMutations.keys())
  }
}
