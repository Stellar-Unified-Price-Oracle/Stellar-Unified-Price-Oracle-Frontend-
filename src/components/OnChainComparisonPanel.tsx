/**
 * @file OnChainComparisonPanel
 *
 * Compares a feed's live off-chain price against the latest price its Soroban
 * oracle contract has published on-chain, so a divergence between the two — a
 * serious trust signal — is visible at a glance.
 *
 * Also shows the SDEX trade-aggregation mid-price as an independent reference
 * (issue #1009) and the lag of the on-chain value behind real-time (issue #1012).
 *
 * Contract addresses are never hardcoded here: the panel resolves them through
 * `lib/contractRegistry.ts` (via `lib/onChainClient.ts`), the single source of
 * truth every on-chain surface in the app reads from. An asset with no
 * registered contract renders an explanatory state instead of crashing.
 */
import { useOnChainComparison } from '../hooks/useOnChainComparison'
import { useSdexPrice } from '../hooks/useSdexPrice'
import { formatPrice, timeAgo, formatTimestamp } from '../utils/format'
import { shortenAccount } from '../lib/stellarAssets'
import type { DivergenceStatus } from '../types/onchain'
import type { OracleNetwork } from '../lib/contractRegistry'
import { MetricHelp } from './MetricHelp'
import { VerifiableLedgerLink } from './VerifiableLedgerLink'

const STATUS_STYLES: Record<DivergenceStatus, { badge: string; label: string }> = {
  'in-sync': { badge: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'In sync' },
  warning: { badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Diverging' },
  breached: { badge: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Threshold breached' },
}

/**
 * Explicit, exhaustive mapping from the network registry's `OracleNetwork`
 * identifiers to the on-chain client's `StellarNetwork` identifiers. Keeping
 * this as a single typed map guarantees the two enums stay in lockstep: adding
 * a network to either side without updating this map is a compile error.
 */
const ORACLE_TO_STELLAR_NETWORK: Record<OracleNetwork, 'mainnet' | 'testnet' | 'futurenet'> = {
  mainnet: 'mainnet',
  testnet: 'testnet',
  futurenet: 'futurenet',
}

function toStellarNetwork(network: OracleNetwork): 'mainnet' | 'testnet' | 'futurenet' {
  return ORACLE_TO_STELLAR_NETWORK[network]
}

function divergenceAnnouncement(pair: string, status: DivergenceStatus, percentageDelta: number): string {
  if (status === 'in-sync') return ''
  const verb = status === 'breached' ? 'breached the configured threshold' : 'is diverging'
  return `${pair} on-chain price ${verb}: ${Math.abs(percentageDelta).toFixed(2)}% from the off-chain price.`
}

function formatLag(lagMs: number | null | undefined): string | null {
  if (lagMs == null || !Number.isFinite(lagMs)) return null
  if (lagMs < 0) return '0s'
  const seconds = Math.round(lagMs / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  return `${hours}h`
}

interface OnChainComparisonPanelProps {
  pair: string
  offChainPrice: number
  thresholdPercent: number
}

export function OnChainComparisonPanel({ pair, offChainPrice, thresholdPercent }: OnChainComparisonPanelProps) {
  const comparison = useOnChainComparison(pair, offChainPrice, thresholdPercent)
  const { supported, registryEntry, loading, error, divergence, onChainPublishedAt, onChainLedger } = comparison
  const lagMs = comparison.lagMs ?? null

  // SDEX reference price — independent cross-check from Horizon trade aggregations (issue #1009).
  const sdex = useSdexPrice(pair, offChainPrice)

  if (!supported) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-400">
          No on-chain oracle contract is registered for this asset yet — see{' '}
          <code className="text-xs text-gray-400">docs/on-chain.md</code> for how contracts are registered.
        </p>
        <SdexReferenceSection sdex={sdex} offChainPrice={offChainPrice} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-sm text-red-400" role="alert">
          Failed to load on-chain price: {error.message}
        </div>
        <SdexReferenceSection sdex={sdex} offChainPrice={offChainPrice} />
      </div>
    )
  }

  if (loading || !divergence) {
    return (
      <div className="space-y-4">
        <div
          className="h-24 rounded-lg bg-gray-800/60 animate-pulse"
          role="status"
          aria-label="Loading on-chain comparison"
        />
        <SdexReferenceSection sdex={sdex} offChainPrice={offChainPrice} />
      </div>
    )
  }

  const style = STATUS_STYLES[divergence.status]
  const announcement = divergenceAnnouncement(pair, divergence.status, divergence.percentageDelta)
  const lagLabel =
    formatLag(lagMs) ?? (onChainPublishedAt !== null ? timeAgo(onChainPublishedAt) : null)

  return (
    <div className="space-y-4">
      {/* Announces a warning/breach the moment it appears; silent while in sync. */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Off-chain</p>
            <p className="text-xl font-mono font-semibold text-gray-100">${formatPrice(divergence.offChainPrice)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">On-chain</p>
            <p className="text-xl font-mono font-semibold text-gray-100">${formatPrice(divergence.onChainPrice)}</p>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-medium border shrink-0 ${style.badge}`}>{style.label}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 mb-4">
        <span className="inline-flex items-center">
          Divergence:
          <MetricHelp topic="divergence" />
          <span className="font-mono text-gray-300">
            {divergence.absoluteDelta >= 0 ? '+' : '-'}
            {formatPrice(Math.abs(divergence.absoluteDelta))} ({divergence.percentageDelta >= 0 ? '+' : ''}
            {divergence.percentageDelta.toFixed(3)}%)
          </span>
        </span>
        <span>
          Threshold: <span className="font-mono text-gray-300">{thresholdPercent}%</span>
        </span>
        {lagLabel && (
          <span>
            On-chain lag:{' '}
            <span className="font-mono text-gray-300" aria-label="On-chain lag behind live feed">
              {lagLabel}
            </span>
          </span>
        )}
      </div>

      {registryEntry && (
        <div className="pt-3 border-t border-gray-800 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
          <span>
            Network: <span className="text-gray-300 capitalize">{registryEntry.network}</span>
          </span>
          <span>
            Contract:{' '}
            <VerifiableLedgerLink
              claimType="contract"
              identifier={registryEntry.contractId}
              network={toStellarNetwork(registryEntry.network)}
              label={shortenAccount(registryEntry.contractId)}
              title={`Verify oracle contract ${registryEntry.contractId} on ${registryEntry.network}`}
            />
          </span>
          {onChainPublishedAt !== null && (
            <span title={formatTimestamp(onChainPublishedAt)}>
              Last published: <span className="text-gray-300">{timeAgo(onChainPublishedAt)}</span>
            </span>
          )}
          {onChainLedger !== null && (
            <span>
              Ledger:{' '}
              <VerifiableLedgerLink
                claimType="ledger"
                identifier={onChainLedger}
                network={toStellarNetwork(registryEntry.network)}
                label={onChainLedger.toLocaleString()}
                title={`Verify on-chain ledger #${onChainLedger} on ${registryEntry.network}`}
              />
            </span>
          )}
        </div>
      )}

      <SdexReferenceSection sdex={sdex} offChainPrice={offChainPrice} />
    </div>
  )
}

function SdexReferenceSection({
  sdex,
  offChainPrice,
}: {
  sdex: ReturnType<typeof useSdexPrice>
  offChainPrice: number
}) {
  const hasData = sdex.sdexMid !== null
  const showSection = sdex.loading || sdex.error || hasData
  if (!showSection) return null

  return (
    <div className="pt-3 border-t border-gray-800">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">SDEX reference (Horizon)</p>
      {sdex.error && (
        <p className="text-xs text-yellow-400" role="status">
          Unable to load SDEX trade aggregation: {sdex.error.message}
        </p>
      )}
      {!sdex.error && sdex.loading && !hasData && (
        <p className="text-xs text-gray-500" role="status">
          Loading SDEX trade aggregation…
        </p>
      )}
      {hasData && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
          <span>
            SDEX mid: <span className="font-mono text-gray-300">${formatPrice(sdex.sdexMid as number)}</span>
          </span>
          {sdex.deviationPct !== null && (
            <span>
              Deviation from oracle:{' '}
              <span className="font-mono text-gray-300">
                {sdex.deviationPct >= 0 ? '+' : ''}
                {sdex.deviationPct.toFixed(3)}%
              </span>
            </span>
          )}
          {sdex.tradeCount !== null && (
            <span>
              Trades: <span className="font-mono text-gray-300">{sdex.tradeCount}</span>
            </span>
          )}
          {sdex.thinLiquidity && (
            <span
              className="px-2 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300"
              role="status"
            >
              Thin liquidity — treat SDEX price with caution
            </span>
          )}
          {offChainPrice > 0 && sdex.sdexVwap !== null && (
            <span className="text-gray-500">
              VWAP: <span className="font-mono text-gray-400">${formatPrice(sdex.sdexVwap)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
