/**
 * @file OnChainComparisonPanel
 *
 * Compares a feed's live off-chain price against the latest price its Soroban
 * oracle contract has published on-chain, so a divergence between the two — a
 * serious trust signal — is visible at a glance.
 *
 * Contract addresses are never hardcoded here: the panel resolves them through
 * `lib/contractRegistry.ts` (via `lib/onChainClient.ts`), the single source of
 * truth every on-chain surface in the app reads from. An asset with no
 * registered contract renders an explanatory state instead of crashing.
 */
import { useOnChainComparison } from '../hooks/useOnChainComparison'
import { formatPrice, timeAgo, formatTimestamp } from '../utils/format'
import { shortenAccount } from '../lib/stellarAssets'
import type { DivergenceStatus } from '../types/onchain'

const STATUS_STYLES: Record<DivergenceStatus, { badge: string; label: string }> = {
  'in-sync': { badge: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'In sync' },
  warning: { badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Diverging' },
  breached: { badge: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Threshold breached' },
}

function divergenceAnnouncement(pair: string, status: DivergenceStatus, percentageDelta: number): string {
  if (status === 'in-sync') return ''
  const verb = status === 'breached' ? 'breached the configured threshold' : 'is diverging'
  return `${pair} on-chain price ${verb}: ${Math.abs(percentageDelta).toFixed(2)}% from the off-chain price.`
}

interface OnChainComparisonPanelProps {
  pair: string
  offChainPrice: number
  thresholdPercent: number
}

export function OnChainComparisonPanel({ pair, offChainPrice, thresholdPercent }: OnChainComparisonPanelProps) {
  const { supported, registryEntry, loading, error, divergence, onChainPublishedAt, onChainLedger } =
    useOnChainComparison(pair, offChainPrice, thresholdPercent)

  if (!supported) {
    return (
      <p className="text-sm text-gray-400">
        No on-chain oracle contract is registered for this asset yet — see{' '}
        <code className="text-xs text-gray-500">docs/on-chain.md</code> for how contracts are registered.
      </p>
    )
  }

  if (error) {
    return (
      <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400" role="alert">
        Failed to load on-chain price: {error.message}
      </div>
    )
  }

  if (loading || !divergence) {
    return (
      <div className="h-24 rounded-lg bg-gray-800/60 animate-pulse" role="status" aria-label="Loading on-chain comparison" />
    )
  }

  const style = STATUS_STYLES[divergence.status]
  const announcement = divergenceAnnouncement(pair, divergence.status, divergence.percentageDelta)

  return (
    <div>
      {/* Announces a warning/breach the moment it appears; silent while in sync. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Off-chain</p>
            <p className="text-xl font-mono font-semibold text-gray-100">${formatPrice(divergence.offChainPrice)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">On-chain</p>
            <p className="text-xl font-mono font-semibold text-gray-100">${formatPrice(divergence.onChainPrice)}</p>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-medium border shrink-0 ${style.badge}`}>{style.label}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mb-4">
        <span>
          Divergence:{' '}
          <span className="font-mono text-gray-300">
            {divergence.absoluteDelta >= 0 ? '+' : '-'}
            {formatPrice(Math.abs(divergence.absoluteDelta))} ({divergence.percentageDelta >= 0 ? '+' : ''}
            {divergence.percentageDelta.toFixed(3)}%)
          </span>
        </span>
        <span>
          Threshold: <span className="font-mono text-gray-300">{thresholdPercent}%</span>
        </span>
      </div>

      {registryEntry && (
        <div className="pt-3 border-t border-gray-800 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>
            Network: <span className="text-gray-300 capitalize">{registryEntry.network}</span>
          </span>
          <span>
            Contract:{' '}
            <span className="font-mono text-gray-400" title={registryEntry.contractId}>
              {shortenAccount(registryEntry.contractId)}
            </span>
          </span>
          {onChainPublishedAt !== null && (
            <span title={formatTimestamp(onChainPublishedAt)}>
              Last published: <span className="text-gray-300">{timeAgo(onChainPublishedAt)}</span>
            </span>
          )}
          {onChainLedger !== null && (
            <span>
              Ledger: <span className="font-mono text-gray-300">{onChainLedger.toLocaleString()}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
