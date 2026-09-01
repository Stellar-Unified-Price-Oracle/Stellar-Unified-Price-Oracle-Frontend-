import { type ReactElement } from 'react'
import { SkeletonBone } from './Skeletons/SkeletonBone'

export function PriceCardSkeleton(): ReactElement {
  return (
    <div
      className="skeleton-offscreen bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between mb-3">
        <SkeletonBone className="h-5 w-28 rounded" />
        <SkeletonBone className="h-2 w-2 rounded-full" />
      </div>
      <SkeletonBone className="h-9 w-36 rounded mb-3" />
      <div className="flex items-center justify-between mb-3">
        <SkeletonBone className="h-3 w-20 rounded" />
        <SkeletonBone className="h-3 w-24 rounded" />
      </div>
      <div className="flex gap-1.5 mb-3">
        <SkeletonBone className="h-5 w-16 rounded" />
        <SkeletonBone className="h-5 w-16 rounded" />
      </div>
      <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
        <SkeletonBone className="h-3.5 w-20 rounded" />
      </div>
    </div>
  )
}
