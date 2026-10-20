/**
 * @file Governance dashboard.
 *
 * Surfaces four governance concerns together:
 *   1. Community proposals under vote.
 *   2. Source performance (client-observed, provisional).
 *   3. Parameter registry — who owns each tunable, full change log (#698).
 *   4. Reputation scores with decay and sybil resistance (#697).
 *   5. Incentive and treasury accounting (#696).
 *   6. Price dispute register (#695).
 *
 * ## Trust posture
 *
 * - Vote tallies come verbatim from the API. An unreported value renders as
 *   "not reported" — never as zero.
 * - Source metrics are labelled as *client-observed* (provisional).
 * - The page is a read-only mirror. It casts no votes and is not the source of
 *   truth; proposals that fail schema validation are withheld, not shown.
 * - Parameter, reputation, incentive, and dispute data are all rendered verbatim
 *   as reported by the API. Nothing is inferred or fabricated.
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { GovernanceProposalCard } from '../components/GovernanceProposalCard'
import { ReliabilityLeaderboard } from '../components/ReliabilityLeaderboard'
import { ReportButton } from '../components/ReportButton'
import { ParameterRegistryPanel } from '../components/ParameterRegistryPanel'
import { ReputationScorePanel } from '../components/ReputationScorePanel'
import { IncentiveLedgerPanel } from '../components/IncentiveLedgerPanel'
import { DisputePanel } from '../components/DisputePanel'
import { SourceCertificationPanel } from '../components/SourceCertificationPanel'
import { usePriceContext } from '../context/PriceContext'
import { useSwr } from '../hooks/useSwr'
import {
  fetchGovernanceProposals,
  fetchPriceHistory,
  fetchParameterRegistry,
  fetchReputationScores,
  fetchIncentiveSummaries,
  fetchPriceDisputes,
  fetchOperatorDisclosures,
  fetchGovernanceEvents,
} from '../api/rest'
import { ParameterRegistryPanel } from '../components/ParameterRegistryPanel'
import { ReputationScorePanel } from '../components/ReputationScorePanel'
import { IncentiveLedgerPanel } from '../components/IncentiveLedgerPanel'
import { DisputePanel } from '../components/DisputePanel'
import { OperatorDisclosuresPanel } from '../components/OperatorDisclosuresPanel'
import { GovernanceEventLogPanel } from '../components/GovernanceEventLogPanel'
import { GovernanceRoleBadge, GovernanceActionGate } from '../components/GovernanceActionGate'
import { useGovernancePermissions } from '../hooks/useGovernancePermissions'
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

  // #698 — Parameter registry
  const { data: parameterRecords } = useSwr(
    'governance/parameter-registry',
    (signal) => fetchParameterRegistry(signal),
    { staleTime: 120_000, refreshInterval: 300_000 },
  )

  // #697 — Reputation scores
  const { data: reputationScores } = useSwr(
    'governance/reputation-scores',
    (signal) => fetchReputationScores(signal),
    { staleTime: 60_000, refreshInterval: 120_000 },
  )

  // #696 — Incentive summaries
  const { data: incentiveSummaries } = useSwr(
    'governance/incentive-summaries',
    (signal) => fetchIncentiveSummaries(signal),
    { staleTime: 120_000, refreshInterval: 300_000 },
  )

  // #695 — Price disputes
  const { data: disputes } = useSwr(
    'governance/disputes',
    (signal) => fetchPriceDisputes(signal),
    { staleTime: 60_000, refreshInterval: 120_000 },
  )

  // #856 — Operator conflict-of-interest disclosures
  const {
    data: disclosures,
    loading: disclosuresLoading,
    error: disclosuresError,
    refetch: refetchDisclosures,
  } = useSwr(
    'governance/operator-disclosures',
    (signal) => fetchOperatorDisclosures(signal),
    { staleTime: 60_000, refreshInterval: 120_000 },
  )

  // #858 — Governance event log & audit trail
  const {
    data: governanceEvents,
    loading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents,
  } = useSwr(
    'governance/events',
    (signal) => fetchGovernanceEvents(signal),
    { staleTime: 30_000, refreshInterval: 60_000 },
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

  const { currentRole, activeNetwork } = useGovernancePermissions()

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-100">Governance</h1>
          <p className="text-sm text-gray-400">
            What the community is voting on, source performance, system parameters, reputation scores, incentive
            accounting, and formal dispute records.
          </p>
        </div>

        {/* ── #857 Role and Network Permission Badge & Action ── */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-gray-800/80 border border-gray-700/60 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-gray-400">Network:</span>
            <span className="font-semibold text-cyan-400 uppercase font-mono">{activeNetwork}</span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">Role:</span>
            <GovernanceRoleBadge role={currentRole} />
          </div>

          <GovernanceActionGate action="proposal:create">
            {({ allowed, disabledReason }) => (
              <button
                type="button"
                disabled={!allowed}
                aria-disabled={!allowed}
                title={disabledReason ?? 'Create a new community proposal'}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                + New Proposal
              </button>
            )}
          </GovernanceActionGate>
        </div>
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
          <div className="flex flex-col gap-1">
            <dt className="font-medium text-gray-300">Parameters, reputation, incentives, disputes</dt>
            <dd>
              All reported verbatim by the aggregator API. Nothing is derived, inferred, or fabricated client-side. A
              missing value is shown as &ldquo;not reported&rdquo;.
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
                  <div className="text-end mt-1">
                    <ReportButton surface="governance" targetId={proposal.id} />
                  </div>
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
            <>
              <ReliabilityLeaderboard
                sourceHealths={sourceHealths}
                priceHistory={historyByPair}
                latencyLabel="Observed lag (ms)"
                caption="Client-observed from this browser's feed history — provisional, not authoritative monitoring."
              />
              <div className="text-end mt-1">
                <ReportButton surface="leaderboard" targetId="reliability-leaderboard" />
              </div>
            </>
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

      {/* ── #698 Parameter registry ────────────────────────────────────── */}
      <ErrorBoundary boundaryId="governance-parameter-registry" featureLabel="Parameter registry">
        <ParameterRegistryPanel records={parameterRecords ?? []} now={now} />
      </ErrorBoundary>

      {/* ── #697 Reputation scores ─────────────────────────────────────── */}
      <ErrorBoundary boundaryId="governance-reputation-scores" featureLabel="Reputation scores">
        <ReputationScorePanel scores={reputationScores ?? []} now={now} />
      </ErrorBoundary>

      {/* ── #696 Incentive accounting ──────────────────────────────────── */}
      <ErrorBoundary boundaryId="governance-incentive-accounting" featureLabel="Incentive accounting">
        <IncentiveLedgerPanel summaries={incentiveSummaries ?? []} />
      </ErrorBoundary>

      {/* ── #695 Price disputes ────────────────────────────────────────── */}
      <ErrorBoundary boundaryId="governance-disputes" featureLabel="Price disputes">
        <DisputePanel disputes={disputes ?? []} now={now} />
      </ErrorBoundary>

      {/* ── #856 Operator conflict-of-interest disclosures ───────────────── */}
      <ErrorBoundary
        boundaryId="governance-operator-disclosures"
        featureLabel="Operator conflict-of-interest disclosures"
      >
        <OperatorDisclosuresPanel
          disclosures={disclosures ?? []}
          loading={disclosuresLoading}
          error={disclosuresError ? String(disclosuresError) : null}
          onRetry={refetchDisclosures}
          now={now}
        />
      </ErrorBoundary>

      {/* ── #858 Governance event log & audit trail ─────────────────────── */}
      <ErrorBoundary
        boundaryId="governance-events"
        featureLabel="Governance event log and audit trail"
      >
        <GovernanceEventLogPanel
          events={governanceEvents ?? []}
          loading={eventsLoading}
          error={eventsError ? String(eventsError) : null}
          onRetry={refetchEvents}
          now={now}
        />
      </ErrorBoundary>
    </div>
  )
}
