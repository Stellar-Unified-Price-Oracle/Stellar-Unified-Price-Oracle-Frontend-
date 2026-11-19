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
import { OperatorDisclosuresPanel } from '../components/OperatorDisclosuresPanel'
import { GovernanceEventLogPanel } from '../components/GovernanceEventLogPanel'
import { GovernanceRoleBadge, GovernanceActionGate } from '../components/GovernanceActionGate'
import { useGovernancePermissions } from '../hooks/useGovernancePermissions'
import { VALID_PAIRS, type PriceHistoryEntry, type OperatorDisclosure, type GovernanceEvent } from '../types'
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
  } = useSwr<OperatorDisclosure[]>(
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
  } = useSwr<GovernanceEvent[]>(
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
        className="rounded-xl border border-gray-700/60 bg-gray-800/40 px-4 py-3 text-xs text-gray-400"
      >
        <p>
          Vote tallies are reported verbatim by the API; an unreported value shows as{' '}
          <span className="text-gray-300">not reported</span>, never as zero. Source metrics are{' '}
          <span className="text-gray-300">client-observed</span> and provisional. This page is a read-only mirror —
          it casts no votes and is not the source of truth.
        </p>
      </section>

      {/* ── Proposals ──────────────────────────────────────────────────── */}
      <section aria-label="Community proposals" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-100">Proposals</h2>
        {proposalsLoading && <p className="text-sm text-gray-400">Loading proposals…</p>}
        {proposalsError && (
          <div className="flex items-center gap-3 text-sm text-red-400">
            <span>Could not load proposals.</span>
            <button
              type="button"
              onClick={() => void refetchProposals()}
              className="underline hover:text-red-300"
            >
              Retry
            </button>
          </div>
        )}
        {!proposalsLoading && !proposalsError && ordered.length === 0 && (
          <p className="text-sm text-gray-400">No proposals under vote.</p>
        )}
        {ordered.map((proposal) => (
          <ErrorBoundary key={proposal.id}>
            <GovernanceProposalCard proposal={proposal} now={now} />
          </ErrorBoundary>
        ))}
      </section>

      {/* ── Source performance ─────────────────────────────────────────── */}
      <section aria-label="Source performance" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-100">Source performance</h2>
        {historyError ? (
          <p className="text-sm text-gray-400">Source history unavailable — leaderboard withheld.</p>
        ) : (
          <ReliabilityLeaderboard historyByPair={historyByPair ?? {}} sourceHealths={sourceHealths} />
        )}
      </section>

      {/* ── Source certification ───────────────────────────────────────── */}
      <section aria-label="Source certification" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-100">Source certification</h2>
        <ErrorBoundary>
          <SourceCertificationPanel />
        </ErrorBoundary>
      </section>

      {/* ── Parameter registry (#698) ──────────────────────────────────── */}
      <section aria-label="Parameter registry" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-100">Parameter registry</h2>
        <ErrorBoundary>
          <ParameterRegistryPanel records={parameterRecords ?? []} />
        </ErrorBoundary>
      </section>

      {/* ── Reputation scores (#697) ───────────────────────────────────── */}
      <section aria-label="Reputation scores" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-100">Reputation scores</h2>
        <ErrorBoundary>
          <ReputationScorePanel scores={reputationScores ?? []} />
        </ErrorBoundary>
      </section>

      {/* ── Incentive accounting (#696) ────────────────────────────────── */}
      <section aria-label="Incentive accounting" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-100">Incentive accounting</h2>
        <ErrorBoundary>
          <IncentiveLedgerPanel summaries={incentiveSummaries ?? []} />
        </ErrorBoundary>
      </section>

      {/* ── Price disputes (#695) ──────────────────────────────────────── */}
      <section aria-label="Price disputes" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-100">Price disputes</h2>
        <ErrorBoundary>
          <DisputePanel disputes={disputes ?? []} />
        </ErrorBoundary>
      </section>

      {/* ── Operator disclosures (#856) ────────────────────────────────── */}
      <section aria-label="Operator disclosures" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-100">Operator disclosures</h2>
        <ErrorBoundary>
          <OperatorDisclosuresPanel
            disclosures={disclosures ?? []}
            loading={disclosuresLoading}
            error={disclosuresError}
            onRetry={() => void refetchDisclosures()}
          />
        </ErrorBoundary>
      </section>

      {/* ── Governance event log (#858) ────────────────────────────────── */}
      <section aria-label="Governance event log" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-100">Governance event log</h2>
        <ErrorBoundary>
          <GovernanceEventLogPanel
            events={governanceEvents ?? []}
            loading={eventsLoading}
            error={eventsError}
            onRetry={() => void refetchEvents()}
          />
        </ErrorBoundary>
      </section>

      {/* ── Report ─────────────────────────────────────────────────────── */}
      <section aria-label="Report an issue" className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-100">Report an issue</h2>
        <ReportButton />
      </section>
    </div>
  )
}
