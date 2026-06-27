import { type ReactElement } from 'react'
import { PriceCardSkeleton } from '../PriceCardSkeleton'

const SKELETON_COUNT = 8

export function DashboardSkeleton(): ReactElement {
  return (
    <div role="status" className="min-h-[calc(100vh-8rem)]" aria-label="Loading dashboard" aria-busy="true">
      <div className="flex items-center justify-between mb-6 animate-pulse">
        <div>
          <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
          <div className="h-4 w-80 rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-48 rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="h-9 w-20 rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="h-9 w-24 rounded-lg bg-gray-200 dark:bg-gray-800" />
          <div className="h-9 w-16 rounded-lg bg-gray-200 dark:bg-gray-800" />
        </div>
      </div>

      <section
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        aria-hidden="true"
      >
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <PriceCardSkeleton key={i} />
        ))}
      </section>
    </div>
  )
}
