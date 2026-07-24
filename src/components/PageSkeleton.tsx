import { type ReactElement } from 'react'

/**
 * Full-page loading skeleton shown by Suspense during lazy route transitions.
 * Uses the same card skeleton pattern as the rest of the app so there's no
 * flash-of-empty-content between route changes.
 */
export function PageSkeleton(): ReactElement {
  return (
    <div
      role="status"
      aria-label="Loading page"
      aria-busy="true"
      className="animate-pulse space-y-6 py-4"
    >
      {/* Simulated page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded-lg bg-gray-800" />
          <div className="h-4 w-80 rounded bg-gray-800" />
        </div>
        <div className="h-8 w-24 rounded-lg bg-gray-800" />
      </div>

      {/* Simulated content grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3"
            aria-hidden="true"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 w-28 rounded bg-gray-800" />
              <div className="h-2 w-2 rounded-full bg-gray-800" />
            </div>
            <div className="h-9 w-36 rounded bg-gray-800" />
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded bg-gray-800" />
              <div className="h-3 w-24 rounded bg-gray-800" />
            </div>
            <div className="flex gap-1.5">
              <div className="h-5 w-16 rounded bg-gray-800" />
              <div className="h-5 w-16 rounded bg-gray-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
