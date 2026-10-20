import { useState, useTransition, useCallback } from 'react'
import {
  type MobileBenchmarkSuiteSummary,
  type BenchmarkResult,
  TIER_2_MOBILE_REFERENCE,
} from '../types/mobileBenchmarks'
import { runAllMobileBenchmarks, benchmarkSummaryToJson } from '../perf/mobileBenchmarks'
import { triggerFileDownload } from '../utils/governanceEvents'

interface MobileBenchmarkPanelProps {
  readonly initialSummary?: MobileBenchmarkSuiteSummary | null
  readonly onRunCompleted?: (summary: MobileBenchmarkSuiteSummary) => void
  readonly className?: string
}

export function MobileBenchmarkPanel({
  initialSummary = null,
  onRunCompleted,
  className = '',
}: MobileBenchmarkPanelProps) {
  const [summary, setSummary] = useState<MobileBenchmarkSuiteSummary | null>(initialSummary)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState<string>('')
  const [, startTransition] = useTransition()

  const handleRunBenchmarks = useCallback(() => {
    setIsRunning(true)
    setError(null)
    setAnnouncement('Executing mobile device tier benchmarks against SLA budgets...')

    // Use requestAnimationFrame / setTimeout so UI renders running state
    setTimeout(() => {
      try {
        const nextSummary = runAllMobileBenchmarks()
        setSummary(nextSummary)
        setIsRunning(false)
        setAnnouncement(
          `Mobile benchmarks completed with status ${nextSummary.overallStatus}. ${nextSummary.passed} of ${nextSummary.totalBenchmarks} passed SLA budget.`,
        )
        onRunCompleted?.(nextSummary)
      } catch (err) {
        setIsRunning(false)
        const msg = err instanceof Error ? err.message : 'Benchmark execution failed'
        setError(msg)
        setAnnouncement(`Error running benchmarks: ${msg}`)
      }
    }, 50)
  }, [onRunCompleted])

  const handleExportJson = useCallback(() => {
    if (!summary) return
    const content = benchmarkSummaryToJson(summary)
    const timestamp = new Date(summary.executedAt).getTime()
    triggerFileDownload(content, `mobile-benchmarks-tier2-${timestamp}.json`, 'application/json')
  }, [summary])

  return (
    <section
      aria-labelledby="mobile-bench-heading"
      className={`bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-6 ${className}`}
    >
      {/* Live Region for Screen-Reader Announcements */}
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>

      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="mobile-bench-heading" className="text-lg font-semibold text-gray-100">
              Mobile Interaction Benchmarks
            </h2>
            <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-0.5 rounded-full font-medium">
              Tier-2 Reference
            </span>
            {summary && (
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                  summary.overallStatus === 'pass'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : summary.overallStatus === 'warn'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : 'bg-red-500/15 text-red-300 border-red-500/30'
                }`}
              >
                {summary.overallStatus.toUpperCase()}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Standardized latency evaluation of key interactions against documented mobile device budgets (Moto G4 / 4× CPU slowdown / 2 GB RAM).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRunBenchmarks}
            disabled={isRunning}
            aria-label="Execute mobile interaction benchmarks against documented SLA budgets"
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRunning ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Benchmarking…</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Run Benchmarks</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            disabled={!summary || isRunning}
            aria-label="Export mobile benchmark results as JSON"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Tier Specification Details */}
      <details className="text-xs bg-gray-800/40 border border-gray-800 rounded-lg p-3">
        <summary className="cursor-pointer font-medium text-gray-300 hover:text-white flex items-center justify-between">
          <span>Tier-2 Mobile Reference Profile Specification</span>
          <span className="text-[10px] text-gray-500">Hardware & Network Simulation</span>
        </summary>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-700/40 text-gray-400">
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-gray-500">Device</span>
            <span className="text-gray-200 font-medium">{TIER_2_MOBILE_REFERENCE.deviceModel}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-gray-500">CPU Throttling</span>
            <span className="text-gray-200 font-medium">{TIER_2_MOBILE_REFERENCE.cpuSlowdownFactor}× Slowdown</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-gray-500">RAM Budget</span>
            <span className="text-gray-200 font-medium">{TIER_2_MOBILE_REFERENCE.memoryBudgetMb} MB JS Heap</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-gray-500">Network Simulation</span>
            <span className="text-gray-200 font-medium">{TIER_2_MOBILE_REFERENCE.networkProfile}</span>
          </div>
        </div>
      </details>

      {/* Error State */}
      {error && (
        <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
          <p className="text-xs text-red-300">{error}</p>
          <button
            type="button"
            onClick={handleRunBenchmarks}
            className="text-xs font-semibold text-red-200 hover:text-white underline ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!summary && !isRunning && !error && (
        <div className="border border-dashed border-gray-800 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-2">
          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <p className="text-xs text-gray-400">No benchmark run recorded.</p>
          <p className="text-[11px] text-gray-500 max-w-sm">
            Click &quot;Run Benchmarks&quot; to measure key interactions against the documented mobile tier SLA latency budgets.
          </p>
        </div>
      )}

      {/* Results Table */}
      {summary && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-3">
              <span className="text-[11px] text-gray-400">Total Tested</span>
              <p className="text-lg font-bold text-gray-100">{summary.totalBenchmarks}</p>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
              <span className="text-[11px] text-emerald-400">Within Budget (Pass)</span>
              <p className="text-lg font-bold text-emerald-300">{summary.passed}</p>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              <span className="text-[11px] text-amber-400">Near Limit (Warn)</span>
              <p className="text-lg font-bold text-amber-300">{summary.warned}</p>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
              <span className="text-[11px] text-red-400">Exceeded Budget (Fail)</span>
              <p className="text-lg font-bold text-red-300">{summary.failed}</p>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-800 rounded-xl">
            <table className="w-full text-xs text-left" aria-label="Mobile Interaction Benchmark Results">
              <thead className="bg-gray-800/60 text-gray-400 border-b border-gray-800">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Interaction & Description</th>
                  <th scope="col" className="px-4 py-3 font-medium">SLA Target</th>
                  <th scope="col" className="px-4 py-3 font-medium">P95 Latency</th>
                  <th scope="col" className="px-4 py-3 font-medium">Performance vs Budget</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {summary.results.map((res: BenchmarkResult) => {
                  const ratio = Math.min(100, Math.round((res.p95Ms / res.budgetMs) * 100))
                  return (
                    <tr key={res.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-100">{res.name}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{res.description}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-300 whitespace-nowrap">
                        ≤ {res.budgetMs} ms
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-cyan-300 whitespace-nowrap">
                        {res.p95Ms} ms
                        <span className="text-[10px] text-gray-500 block font-sans">
                          (median: {res.medianMs} ms)
                        </span>
                      </td>
                      <td className="px-4 py-3 min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                res.status === 'pass'
                                  ? 'bg-emerald-500'
                                  : res.status === 'warn'
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                              }`}
                              style={{ width: `${ratio}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-gray-400 w-9 text-right">
                            {ratio}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                            res.status === 'pass'
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : res.status === 'warn'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-red-500/15 text-red-300 border-red-500/30'
                          }`}
                        >
                          {res.status === 'pass' ? 'PASSED' : res.status === 'warn' ? 'WARNING' : 'FAILED'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
