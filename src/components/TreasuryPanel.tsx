/**
 * @file TreasuryPanel — Treasury & incentive accounting (#696).
 *
 * Displays per-operator accrued, claimed, and pending rewards alongside
 * uptime and accuracy contribution scores. Amounts are strings from the API
 * and never re-computed client-side to avoid float drift.
 */
import { memo, type ReactElement } from 'react'
import { useSwr } from '../hooks/useSwr'
import { fetchTreasury } from '../api/rest'
import type { TreasuryEntry } from '../types'
import { netUnclaimedRewards, contributionScore } from '../utils/governance'

interface TreasuryRowProps {
  entry: TreasuryEntry
}

const TreasuryRow = memo(function TreasuryRow({ entry }: TreasuryRowProps): ReactElement {
  const netUnclaimed = netUnclaimedRewards(entry)
  const contrib = contributionScore(entry)
  const lastSettled = entry.lastSettledAt
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(entry.lastSettledAt),
      )
    : null

  return (
    <li className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="font-medium text-gray-100 capitalize">{entry.sourceId}</span>
        {contrib !== null && (
          <span className="text-xs text-gray-400">
            Contribution score:{' '}
            <span className="font-mono text-gray-100">{(contrib * 100).toFixed(1)} %</span>
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        <div className="flex flex-col gap-0.5">
          <dt className="text-gray-500">Accrued</dt>
          <dd className="font-mono text-gray-100">{entry.accruedRewards}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-gray-500">Claimed</dt>
          <dd className="font-mono text-gray-100">{entry.claimedRewards}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-gray-500">Net unclaimed</dt>
          <dd className="font-mono text-gray-100">
            {netUnclaimed !== null ? netUnclaimed : 'Unavailable'}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-gray-500">Pending (next cycle)</dt>
          <dd className="font-mono text-gray-100">
            {entry.pendingRewards !== null ? entry.pendingRewards : 'Not yet computed'}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-gray-500">Uptime</dt>
          <dd className="font-mono text-gray-100">{(entry.uptimeScore * 100).toFixed(1)} %</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-gray-500">Accuracy</dt>
          <dd className="font-mono text-gray-100">{(entry.accuracyScore * 100).toFixed(1)} %</dd>
        </div>
      </dl>

      {lastSettled && <p className="text-xs text-gray-500">Last settled: {lastSettled}</p>}
      {!lastSettled && <p className="text-xs text-gray-500">No settlement recorded yet.</p>}
    </li>
  )
})

export function TreasuryPanel(): ReactElement {
  const { data, loading, error, refetch } = useSwr(
    'governance/treasury',
    (signal) => fetchTreasury(signal),
    { refreshInterval: 120_000, staleTime: 60_000 },
  )

  return (
    <section aria-labelledby="treasury-heading" className="flex flex-col gap-4">
      <h2 id="treasury-heading" className="text-lg font-semibold text-gray-100">
        Treasury &amp; incentives
      </h2>

      <p className="text-xs text-gray-500">
        Reward accounting for each source operator, based on their uptime and accuracy contributions. Amounts are
        in protocol-native units and come verbatim from the API — nothing is scaled or inferred client-side.
      </p>

      {loading && !data && (
        <p className="text-sm text-gray-500 py-6 text-center" role="status">
          Loading treasury data…
        </p>
      )}

      {!loading && error !== null && (
        <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 flex flex-col items-start gap-3">
          <p className="text-sm text-red-300">Could not load treasury data.</p>
          <button
            type="button"
            onClick={refetch}
            className="min-h-[44px] px-4 py-2 text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && error === null && (!data || data.length === 0) && (
        <p className="text-sm text-gray-500 py-6 text-center">No treasury records available.</p>
      )}

      {data && data.length > 0 && (
        <ul className="flex flex-col gap-3 list-none p-0">
          {[...data].sort((a, b) => Number(b.accruedRewards) - Number(a.accruedRewards)).map((entry) => (
            <TreasuryRow key={entry.sourceId} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  )
}
