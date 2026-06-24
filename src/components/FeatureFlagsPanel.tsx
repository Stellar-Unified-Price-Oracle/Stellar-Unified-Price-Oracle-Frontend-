import { useFeatureFlags } from '../features/FeatureFlagsContext'

export function FeatureFlagsPanel() {
  const { flags, loading, error, override, clearAllOverrides } = useFeatureFlags()

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading feature flags...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        Error: {error}
      </div>
    )
  }

  const entries = Object.entries(flags)
  if (entries.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No feature flags configured
      </div>
    )
  }

  const hasOverrides = entries.some(([, flag]) => flag.source === 'override')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-200">Feature Flags</h3>
        {hasOverrides && (
          <button
            onClick={clearAllOverrides}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            Clear all overrides
          </button>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-400 mb-2">{error}</div>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {entries.map(([name, flag]) => (
          <div
            key={name}
            className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-200 truncate">{name}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    flag.source === 'override'
                      ? 'bg-purple-900/50 text-purple-300'
                      : flag.source === 'local'
                        ? 'bg-blue-900/50 text-blue-300'
                        : 'bg-green-900/50 text-green-300'
                  }`}
                >
                  {flag.source}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{flag.description}</p>
            </div>
            <label className="relative ml-4 flex-shrink-0">
              <input
                type="checkbox"
                className="sr-only"
                checked={flag.enabled}
                onChange={(e) => override(name, e.target.checked)}
              />
              <div
                className={`w-10 h-5 rounded-full transition-colors duration-200 ${
                  flag.enabled ? 'bg-cyan-500' : 'bg-gray-700'
                }`}
              />
              <div
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  flag.enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}