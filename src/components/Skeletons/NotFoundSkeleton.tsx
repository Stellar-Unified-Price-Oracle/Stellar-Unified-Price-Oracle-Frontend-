import { type ReactElement } from 'react'
import { SkeletonBone } from './SkeletonBone'

export function NotFoundSkeleton(): ReactElement {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center py-32 text-center min-h-[calc(100vh-8rem)]"
      aria-label="Loading page"
      aria-busy="true"
    >
      <SkeletonBone className="h-16 w-24 rounded mb-4" />
      <SkeletonBone className="h-5 w-40 rounded mb-8" />
      <SkeletonBone className="h-10 w-36 rounded-lg" />
    </div>
  )
}
