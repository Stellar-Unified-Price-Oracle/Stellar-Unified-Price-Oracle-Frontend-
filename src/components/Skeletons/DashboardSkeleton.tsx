import { type ReactElement } from 'react'
import { PriceCardSkeleton } from '../PriceCardSkeleton'
import { SkeletonBone } from './SkeletonBone'

const SKELETON_COUNT = 8

export function DashboardSkeleton(): ReactElement {
  return (
    <div role="status" className="min-h-[calc(100vh-8rem)]" aria-label="Loading dashboard" aria-busy="true">
      <div className="flex items-center justify-between mb-6">
        <div>
          <SkeletonBone className="h-8 w-64 rounded mb-2" />
          <SkeletonBone className="h-4 w-80 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <SkeletonBone className="h-9 w-48 rounded-lg" />
          <SkeletonBone className="h-9 w-20 rounded-lg" />
          <SkeletonBone className="h-9 w-20 rounded-lg" />
          <SkeletonBone className="h-9 w-16 rounded-lg" />
          <SkeletonBone className="h-9 w-20 rounded-lg hidden sm:block" />
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
