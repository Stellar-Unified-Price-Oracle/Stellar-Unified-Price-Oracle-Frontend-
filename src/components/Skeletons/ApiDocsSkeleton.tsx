import { type ReactElement } from 'react'

const ENDPOINT_PLACEHOLDERS = 6

export function ApiDocsSkeleton(): ReactElement {
  return (
    <div
      role="status"
      className="max-w-3xl mx-auto min-h-[calc(100vh-8rem)] animate-pulse"
      aria-label="Loading API documentation"
      aria-busy="true"
    >
      <div className="mb-8">
        <div className="h-8 w-56 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
        <div className="h-4 w-full max-w-xl rounded bg-gray-200 dark:bg-gray-800 mb-3" />
        <div className="h-9 w-40 rounded-lg bg-gray-200 dark:bg-gray-800" />
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-800" />
      </div>

      <div className="space-y-4" aria-hidden="true">
        {Array.from({ length: ENDPOINT_PLACEHOLDERS }, (_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900/50 p-4">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="h-6 w-12 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-5 w-48 rounded bg-gray-200 dark:bg-gray-800" />
            </div>
            <div className="h-4 w-full max-w-md rounded bg-gray-200 dark:bg-gray-800 mb-4" />
            <div className="h-24 w-full rounded-lg bg-gray-200 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    </div>
  )
}
