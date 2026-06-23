export function PriceCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 animate-pulse" aria-hidden="true">
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 w-28 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="h-9 w-36 bg-gray-200 dark:bg-gray-800 rounded mb-3" />
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="h-3 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-800 rounded" />
      </div>
    </div>
  )
}
