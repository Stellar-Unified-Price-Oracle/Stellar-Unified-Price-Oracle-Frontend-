/** Developer insights: retention curves and feature adoption heatmap (#641). First-party, local data only. */
import { useMemo, type ReactElement } from 'react'
import { computeCohorts, loadDeveloperEvents, DEVELOPER_FEATURES, MIN_COHORT_SIZE } from '../analytics/developerCohorts'

const pct = (v: number | null): string => (v === null ? '—' : `${Math.round(v * 100)}%`)
const shade = (v: number | null): string => (v === null ? 'transparent' : `rgba(59,130,246,${0.1 + v * 0.7})`)

export function DeveloperInsights(): ReactElement {
  const cohorts = useMemo(() => computeCohorts(loadDeveloperEvents(), Date.now()), [])
  return (
    <main className="max-w-5xl mx-auto p-6 text-gray-100">
      <h1 className="text-xl font-semibold">Developer insights</h1>
      <p className="text-xs text-gray-400 mb-4">
        Anonymous first-seen-week cohorts, computed locally. Cohorts under {MIN_COHORT_SIZE} accounts are suppressed.
      </p>
      {cohorts.length === 0 ? (
        <p className="text-sm text-gray-400">No developer activity recorded yet.</p>
      ) : (
        <table className="w-full text-sm" aria-label="Cohort retention and adoption">
          <thead>
            <tr>
              <th scope="col" className="text-left">Cohort week</th>
              <th scope="col">Size</th>
              <th scope="col">Retention by week</th>
              {DEVELOPER_FEATURES.map((f) => <th key={f} scope="col">{f}</th>)}
            </tr>
          </thead>
          <tbody>
            {cohorts.map((c) => (
              <tr key={c.cohortStart}>
                <td>{new Date(c.cohortStart).toISOString().slice(0, 10)}</td>
                <td className="text-center">{c.size}</td>
                {c.suppressed ? (
                  <td colSpan={1 + DEVELOPER_FEATURES.length} className="text-gray-500 text-center">
                    Suppressed: fewer than {MIN_COHORT_SIZE} accounts, too small to report reliably.
                  </td>
                ) : (
                  <>
                    <td className="text-center font-mono">{c.retention.map(pct).join(' → ')}</td>
                    {DEVELOPER_FEATURES.map((f) => (
                      <td key={f} className="text-center" style={{ background: shade(c.adoption[f]) }}>{pct(c.adoption[f])}</td>
                    ))}
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
