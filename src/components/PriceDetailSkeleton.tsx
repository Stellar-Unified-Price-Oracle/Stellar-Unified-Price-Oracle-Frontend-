export function PriceDetailSkeleton() {
  return (
    <div role="status" className="animate-pulse" aria-label="Loading price detail" aria-busy="true">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-8 w-8 rounded-lg bg-gray-800" />
        <div className="h-7 w-40 rounded bg-gray-800" />
        <div className="h-5 w-10 rounded-full bg-gray-800 ml-2" />
      </div>

      {/* Price block */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="h-4 w-24 rounded bg-gray-800 mb-3" />
        <div className="h-12 w-52 rounded bg-gray-800 mb-4" />
        <div className="flex items-center justify-between">
          <div className="h-3 w-32 rounded bg-gray-800" />
          <div className="h-3 w-28 rounded bg-gray-800" />
        </div>
      </div>

      {/* Sources */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <div className="h-4 w-20 rounded bg-gray-800 mb-4" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 w-20 rounded bg-gray-800" />
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="h-4 w-28 rounded bg-gray-800 mb-4" />
        <div className="h-48 rounded bg-gray-800" />
      </div>
    </div>
  )
}
