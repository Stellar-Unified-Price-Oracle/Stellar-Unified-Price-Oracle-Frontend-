import { QueryClient } from '@tanstack/react-query'

/**
 * Shared QueryClient instance for the application.
 *
 * Default configuration:
 * - `staleTime`: 5 seconds — data is considered fresh for 5 s after the last fetch.
 * - `gcTime`: 5 minutes — unused cached data is garbage-collected after 5 min.
 * - `retry`: 3 — failed queries retry up to 3 times with exponential back-off.
 * - `refetchOnWindowFocus`: true — queries refetch when the browser tab regains focus.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      gcTime: 5 * 60 * 1_000,
      retry: 3,
      refetchOnWindowFocus: true,
    },
  },
})
