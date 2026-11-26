/**
 * AMM Liquidity-Pool Price Comparison Service (#1010)
 *
 * Compares Stellar AMM constant-product liquidity pool prices against
 * Oracle aggregate prices to measure price divergence, spread, and arbitrage
 * opportunities across on-chain liquidity pools.
 */

export interface LiquidityPoolReserves {
  poolId: string;
  assetA: string;
  assetB: string;
  reserveA: number;
  reserveB: number;
  totalShares?: number;
}

export interface AmmPriceComparison {
  poolId: string;
  pair: string;
  ammPrice: number;
  oraclePrice: number;
  deviationBps: number;
  deviationPercentage: number;
  isDivergent: boolean;
  timestamp: string;
}

/** Default threshold in basis points for alerting on AMM-oracle divergence (e.g. 200 bps = 2%). */
export const DEFAULT_DIVERGENCE_THRESHOLD_BPS = 200;

/**
 * Calculates the implied spot price from constant-product liquidity pool reserves.
 * Price of Asset A denominated in Asset B: price = reserveB / reserveA.
 */
export function calculateAmmSpotPrice(reserves: LiquidityPoolReserves): number {
  if (reserves.reserveA <= 0 || reserves.reserveB <= 0) {
    throw new Error('Reserves must be positive non-zero numbers');
  }
  return reserves.reserveB / reserves.reserveA;
}

/**
 * Compares an AMM liquidity-pool spot price against an Oracle benchmark price.
 */
export function compareAmmToOracle(
  reserves: LiquidityPoolReserves,
  oraclePrice: number,
  thresholdBps: number = DEFAULT_DIVERGENCE_THRESHOLD_BPS,
): AmmPriceComparison {
  if (oraclePrice <= 0) {
    throw new Error('Oracle price must be positive');
  }

  const ammPrice = calculateAmmSpotPrice(reserves);
  const deviationRatio = (ammPrice - oraclePrice) / oraclePrice;
  const deviationBps = Math.round(deviationRatio * 10_000);
  const deviationPercentage = deviationRatio * 100;
  const isDivergent = Math.abs(deviationBps) >= thresholdBps;

  return {
    poolId: reserves.poolId,
    pair: `${reserves.assetA}/${reserves.assetB}`,
    ammPrice,
    oraclePrice,
    deviationBps,
    deviationPercentage,
    isDivergent,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Computes pool slippage for a given swap trade size.
 */
export function estimateAmmSlippage(
  reserves: LiquidityPoolReserves,
  amountIn: number,
  feeBps: number = 30, // Default 0.3% Stellar AMM fee
): number {
  if (amountIn <= 0) return 0;
  const spotPrice = calculateAmmSpotPrice(reserves);
  const netAmountIn = amountIn * (1 - feeBps / 10_000);
  // Constant product: k = reserveA * reserveB
  const newReserveA = reserves.reserveA + netAmountIn;
  const newReserveB = (reserves.reserveA * reserves.reserveB) / newReserveA;
  const amountOut = reserves.reserveB - newReserveB;
  const effectivePrice = amountOut / amountIn;
  return Math.max(0, (spotPrice - effectivePrice) / spotPrice);
}
