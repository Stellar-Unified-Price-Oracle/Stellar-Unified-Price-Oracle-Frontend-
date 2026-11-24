/**
 * useSdexPrice — fetches the latest SDEX trade-aggregation price for an asset pair
 * from Horizon and derives the deviation from the oracle's off-chain price.
 *
 * Issue #1009: Use the Stellar DEX as a reference price source.
 *
 * SDEX prices come from actual on-network settled trades and require no oracle
 * trust — they serve as an independent cross-check against the aggregated feed.
 * Thin markets (fewer than MIN_TRADES_FOR_LIQUIDITY trades in the bucket) are
 * flagged with a liquidity warning so the reader knows not to treat a single
 * trade as a reliable reference.
 */
import { useSwr } from './useSwr'
import { config } from '../config'

/** Minimum number of trades in a bucket before we consider liquidity adequate. */
const MIN_TRADES_FOR_LIQUIDITY = 3

/** Bucket duration used for aggregation: 1 hour in milliseconds. */
const SDEX_RESOLUTION_MS = 3_600_000

/** Re-fetch interval — same cadence as the on-chain comparison. */
const SDEX_REFRESH_MS = 15_000

/** Horizon REST response shape for a single trade-aggregation bucket. */
interface TradeAggregationRecord {
  timestamp: string | number
  trade_count: string | number
  base_volume: string
  counter_volume: string
  open: string
  high: string
  low: string
  close: string
  avg: string
}

/** Processed result returned by this hook. */
export interface SdexPriceResult {
  /** Mid-price derived from the latest closed bucket: (open + close) / 2. */
  sdexMid: number | null
  /** Volume-weighted average price of the latest bucket. */
  sdexVwap: number | null
  /** Number of trades in the bucket (liquidity signal). */
  tradeCount: number | null
  /** True when tradeCount < MIN_TRADES_FOR_LIQUIDITY — treat price with caution. */
  thinLiquidity: boolean
  /**
   * Deviation of the oracle off-chain price from the SDEX mid, as a signed
   * percentage: `(offChain - sdexMid) / sdexMid * 100`.
   * Null when either price is unavailable.
   */
  deviationPct: number | null
  loading: boolean
  error: Error | null
}

function horizonBaseUrl(networkPassphrase?: string): string {
  // Allow an env override; fall back to testnet public Horizon.
  const env = import.meta.env.VITE_HORIZON_URL as string | undefined
  if (env) return env.replace(/\/$/, '')
  if (networkPassphrase?.includes('Public Global')) return 'https://horizon.stellar.org'
  return 'https://horizon-testnet.stellar.org'
}

/**
 * Map a feed pair like `XLM/USD` or `XLM-USD` to Horizon asset parameters.
 * We price the base asset (XLM) in XLM-native terms against USDC on SDEX.
 * Only XLM/USD is supported for now; other pairs fall back to `null`.
 */
function pairToHorizonAssets(pair: string): {
  baseType: string
  counterType: string
  counterCode?: string
  counterIssuer?: string
} | null {
  const [base] = pair.toUpperCase().replace(/-/g, '/').split('/')
  if (base === 'XLM') {
    return {
      baseType: 'native',
      counterType: 'credit_alphanum4',
      counterCode: 'USDC',
      // Circle USDC issuer on mainnet — Horizon testnet uses same address for demos
      counterIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    }
  }
  return null
}

async function fetchSdexAggregation(pair: string, signal?: AbortSignal): Promise<TradeAggregationRecord | null> {
  const assets = pairToHorizonAssets(pair)
  if (!assets) return null

  const horizon = horizonBaseUrl()
  const now = Date.now()
  const startTime = now - SDEX_RESOLUTION_MS * 10 // last 10 buckets

  const params = new URLSearchParams({
    base_asset_type: assets.baseType,
    counter_asset_type: assets.counterType,
    resolution: String(SDEX_RESOLUTION_MS),
    start_time: String(startTime),
    end_time: String(now),
    limit: '10',
    order: 'desc',
  })
  if (assets.counterCode) params.set('counter_asset_code', assets.counterCode)
  if (assets.counterIssuer) params.set('counter_asset_issuer', assets.counterIssuer)

  const url = `${horizon}/trade_aggregations?${params.toString()}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Horizon /trade_aggregations returned ${res.status}`)
  const json = (await res.json()) as { _embedded?: { records?: TradeAggregationRecord[] } }
  const records = json._embedded?.records ?? []
  // Most-recent bucket with at least one trade
  return records.find((r) => Number(r.trade_count) > 0) ?? null
}

/**
 * Fetches the latest SDEX trade-aggregation price for a feed pair and computes
 * its deviation from the given off-chain oracle price.
 *
 * Returns `thinLiquidity: true` when the bucket had fewer than
 * {@link MIN_TRADES_FOR_LIQUIDITY} trades so callers can warn the user.
 */
export function useSdexPrice(pair: string, offChainPrice: number | undefined): SdexPriceResult {
  const swrKey = pair ? `sdex:${pair}` : ''

  const { data, loading, error } = useSwr(
    swrKey,
    (signal) => fetchSdexAggregation(pair, signal),
    { enabled: !!pair, refreshInterval: SDEX_REFRESH_MS, staleTime: 5_000, retryCount: 2 },
  )

  if (!data) {
    return { sdexMid: null, sdexVwap: null, tradeCount: null, thinLiquidity: false, deviationPct: null, loading, error }
  }

  const open = parseFloat(data.open)
  const close = parseFloat(data.close)
  const sdexMid = (open + close) / 2
  const sdexVwap = parseFloat(data.avg)
  const tradeCount = Number(data.trade_count)
  const thinLiquidity = tradeCount < MIN_TRADES_FOR_LIQUIDITY
  const deviationPct =
    offChainPrice !== undefined && sdexMid > 0
      ? ((offChainPrice - sdexMid) / sdexMid) * 100
      : null

  return { sdexMid, sdexVwap, tradeCount, thinLiquidity, deviationPct, loading, error }
}
