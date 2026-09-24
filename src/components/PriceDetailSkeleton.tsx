import { type ReactElement } from 'react'
import { SkeletonBone } from './Skeletons/SkeletonBone'

export function PriceDetailSkeleton(): ReactElement {
  return (
    <div role="status" aria-label="Loading price detail" aria-busy="true">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <SkeletonBone className="h-8 w-8 rounded-lg" />
        <SkeletonBone className="h-7 w-40 rounded" />
        <SkeletonBone className="h-5 w-10 rounded-full ml-2" />
      </div>

      {/* Price block */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <SkeletonBone className="h-4 w-24 rounded mb-3" />
        <SkeletonBone className="h-12 w-52 rounded mb-4" />
        <div className="flex items-center justify-between">
          <SkeletonBone className="h-3 w-32 rounded" />
          <SkeletonBone className="h-3 w-28 rounded" />
        </div>
      </div>

      {/* Sources */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <SkeletonBone className="h-4 w-20 rounded mb-4" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <SkeletonBone key={i} className="h-6 w-20 rounded" />
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="skeleton-offscreen bg-gray-900 border border-gray-800 rounded-xl p-6">
        <SkeletonBone className="h-4 w-28 rounded mb-4" />
        <SkeletonBone className="h-48 w-full rounded" />
      </div>
    </div>
  )
}
