import { type ReactElement } from 'react'
import { SkeletonBone } from './SkeletonBone'

const ENDPOINT_PLACEHOLDERS = 6

export function ApiDocsSkeleton(): ReactElement {
  return (
    <div
      role="status"
      className="max-w-3xl mx-auto min-h-[calc(100vh-8rem)]"
      aria-label="Loading API documentation"
      aria-busy="true"
    >
      <div className="mb-8">
        <SkeletonBone className="h-8 w-56 rounded mb-2" />
        <SkeletonBone className="h-4 w-full max-w-xl rounded mb-3" />
        <SkeletonBone className="h-9 w-40 rounded-lg" />
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <SkeletonBone className="h-4 w-48 rounded" />
        <SkeletonBone className="h-4 w-40 rounded" />
      </div>

      <div className="space-y-4" aria-hidden="true">
        {Array.from({ length: ENDPOINT_PLACEHOLDERS }, (_, i) => (
          <div
            key={i}
            className="skeleton-offscreen rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900/50 p-4"
          >
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <SkeletonBone className="h-6 w-12 rounded" />
              <SkeletonBone className="h-5 w-48 rounded" />
            </div>
            <SkeletonBone className="h-4 w-full max-w-md rounded mb-4" />
            <SkeletonBone className="h-24 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
