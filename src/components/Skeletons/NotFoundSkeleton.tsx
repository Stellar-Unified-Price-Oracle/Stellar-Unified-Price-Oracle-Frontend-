import { type ReactElement } from 'react'

export function NotFoundSkeleton(): ReactElement {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center py-32 text-center min-h-[calc(100vh-8rem)] animate-pulse"
      aria-label="Loading page"
      aria-busy="true"
    >
      <div className="h-16 w-24 rounded bg-gray-200 dark:bg-gray-800 mb-4" />
      <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-800 mb-8" />
      <div className="h-10 w-36 rounded-lg bg-gray-200 dark:bg-gray-800" />
    </div>
  )
}
