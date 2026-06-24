const SOURCE_INFO: Record<string, { label: string; color: string }> = {
  chainlink: { label: 'Chainlink', color: 'bg-blue-500' },
  redstone: { label: 'Redstone', color: 'bg-red-500' },
  band: { label: 'Band', color: 'bg-purple-500' },
  reflector: { label: 'Reflector', color: 'bg-cyan-500' },
}

interface SourceHealthProps {
  sources: readonly string[]
}

export function SourceHealthBadge({ sources }: SourceHealthProps) {
  if (!sources.length) {
    return <span className="text-xs text-gray-400 dark:text-gray-500">No sources</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {sources.map((src) => {
        const info = SOURCE_INFO[src]
        if (!info) return null
        return (
          <span
            key={src}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${info.color}`} />
            {info.label}
          </span>
        )
      })}
    </div>
  )
}
