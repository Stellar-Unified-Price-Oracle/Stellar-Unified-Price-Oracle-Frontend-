import { type ReactElement } from 'react'

interface SkeletonBoneProps {
  /** Tailwind sizing/shape classes, e.g. "h-4 w-24 rounded". */
  className?: string
}

/**
 * A single shimmering placeholder block. Sizing is caller-controlled via
 * `className` so each skeleton can mirror the dimensions of the real content
 * it stands in for.
 */
export function SkeletonBone({ className = '' }: SkeletonBoneProps): ReactElement {
  return <div className={`skeleton-shimmer ${className}`} />
}
