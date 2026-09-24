/**
 * @file Governance dashboard.
 *
 * Two questions for community governance, side by side:
 *   1. what decisions are being voted on, and
 *   2. how each oracle source has actually performed.
 *
 * ## Trust posture
 *
 * These figures are political ammunition, so the page is written to be hard to
 * misread:
 *
 * - Vote tallies come verbatim from `GET /api/governance/proposals`. An
 *   unreported value renders as "not reported" — never as zero.
 * - Source metrics are shared with the Dashboard via `deriveSourceHealths` so
 *   the two views cannot disagree, and they are labelled as *client-observed*
 *   rather than authoritative monitoring (see the provenance panel).
 * - The page is a read-only mirror. It casts no votes and is not the source of
 *   truth; proposals that fail schema validation are withheld, not shown.
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { GovernanceProposalCard } from '../components/GovernanceProposalCard'
import { ReliabilityLeaderboard } from '../components/ReliabilityLeaderboard'
import { usePriceContext } from '../context/PriceContext'
import { useSwr } from '../hooks/useSwr'
import { fetchGovernanceProposals, fetchPriceHistory } from '../api/rest'
import { VALID_PAIRS, type PriceHistoryEntry } from '../types'
import { deriveSourceHealths } from '../utils/sourceHealth'
import { orderProposals } from '../utils/governance'

/** Enough history per pair to fill the leaderboard's widest (30 d) window. */
const HISTORY_LIMIT = 1000

export function Governance(): ReactElement {
  const { prices } = usePriceContext()

  const {
    data: proposals,
    error: proposalsError,
    loading: proposalsLoading,
    refetch: refetchProposals,
  } = useSwr('governance/proposals', (signal) => fetchGovernanceProposals(signal), {
    refreshInterval: 60_000,
    staleTime: 30_000,
  })

  // History drives the leaderboard's uptime/trend columns. If it is missing we
  // withhold the leaderboard rather than let every source render at 0 % uptime
  // (which reads as "all sources are down").
  const { data: historyByPair, error: historyError } = useSwr(
    'governance/source-history',
    async (signal) => {
      const results = await Promise.all(
        VALID_PAIRS.map((pair) => fetchPriceHistory(pair, HISTORY_LIMIT, 0, undefined, undefined, signal)),
      )
      const byPair: Record<string, PriceHistoryEntry[]> = {}
      for (const result of results) byPair[result.pair] = result.history
      return byPair
    },
    { staleTime: 120_000, refreshInterval: 300_000 },
  )

  const sourceHealths = useMemo(() => deriveSourceHealths(prices), [prices])

  const ordered = useMemo(() => orderProposals(proposals ?? []), [proposals])

  // A single ticking clock, rather than a per-card `Date.now()`: every card in a
  // render then agrees about "now" (so two cards can't straddle a deadline),
  // and the value keeps a stable identity between ticks so the memoised cards
  // actually skip re-rendering.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-100">Governance</h1>
        <p className="text-sm text-gray-400">
          What the community is voting on, and how each oracle source has performed.
        </p>
      </header>

      {/* ── Provenance ─────────────────────────────────────────────────── */}
      <section
        aria-label="How to read these figures"
        className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-3"
      >
        <h2 className="text-sm font-semibold text-gray-100">How to read these figures</h2>
        <dl className="grid gap-3 sm:grid-cols-2 text-xs text-gray-400">
          <div className="flex flex-col gap-1">
            <dt className="font-medium text-gray-300">Source performance</dt>
            <dd>
              Computed in this browser from the price history it has observed — <strong>not</strong> the
              aggregator&rsquo;s own monitoring, and not an on-chain record. &ldquo;Observed lag&rdquo; is derived from
              the age of the last tick this browser saw, not a measured round trip. Treat these as indicative; export
              the CSV if you need to cite them.
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="font-medium text-gray-300">Votes</dt>
            <dd>
              Reported verbatim by the governance API. Nothing is inferred client-side: an unreported value is shown as
              &ldquo;not reported&rdquo;, never as zero. Proposals that fail schema validation are withheld rather than
              displayed.
            </dd>
          </div>
        </dl>
        <p className="text-xs text-gray-500 border-t border-gray-800 pt-3">
          This page is a read-only mirror. It cannot cast votes and is not the source of truth for any figure shown.
        </p>
      </section>

      {/* ── Proposals ──────────────────────────────────────────────────── */}
      <section aria-labelledby="proposals-heading" className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="proposals-heading" className="text-lg font-semibold text-gray-100">
            Decisions under vote
          </h2>
          {!proposalsLoading && proposalsError === null && (
            <span className="text-xs text-gray-500">
              {ordered.length} proposal{ordered.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <ErrorBoundary boundaryId="governance-proposals" featureLabel="Governance proposals">
          {proposalsLoading && ordered.length === 0 && (
            <p className="text-sm text-gray-500 py-8 text-center" role="status">
              Loading proposals…
            </p>
          )}

          {!proposalsLoading && proposalsError !== null && (
            <div
              role="alert"
              className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 flex flex-col items-start gap-3"
            >
              <p className="text-sm text-red-300">
                Could not load governance proposals, so none are shown. This is a load failure — not a report that there
                are no decisions pending.
              </p>
              <button
                type="button"
                onClick={refetchProposals}
                className="min-h-[44px] px-4 py-2 text-sm font-medium bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!proposalsLoading && proposalsError === null && ordered.length === 0 && (
            <p className="text-sm text-gray-500 py-8 text-center">The governance API returned no proposals.</p>
          )}

          {ordered.length > 0 && (
            <ul className="flex flex-col gap-4 list-none p-0">
              {ordered.map((proposal) => (
                <li key={proposal.id}>
                  <GovernanceProposalCard proposal={proposal} now={now} />
                </li>
              ))}
            </ul>
          )}
        </ErrorBoundary>
      </section>

      {/* ── Source performance ─────────────────────────────────────────── */}
      <section aria-labelledby="source-performance-heading" className="flex flex-col gap-4">
        <h2 id="source-performance-heading" className="text-lg font-semibold text-gray-100">
          Source performance
        </h2>
        <ErrorBoundary boundaryId="governance-source-performance" featureLabel="Source performance">
          {historyByPair !== undefined ? (
            <ReliabilityLeaderboard
              sourceHealths={sourceHealths}
              priceHistory={historyByPair}
              latencyLabel="Observed lag (ms)"
              caption="Client-observed from this browser's feed history — provisional, not authoritative monitoring."
            />
          ) : historyError !== null ? (
            <p role="alert" className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 text-sm text-red-300">
              Source performance history could not be loaded. Uptime and trend are withheld rather than shown as zero,
              which would read as every source being down.
            </p>
          ) : (
            <p className="text-sm text-gray-500 py-8 text-center" role="status">
              Loading source performance…
            </p>
          )}
        </ErrorBoundary>
      </section>
    </div>
  )
}
