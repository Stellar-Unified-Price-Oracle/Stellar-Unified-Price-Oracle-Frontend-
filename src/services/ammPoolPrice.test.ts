import { describe, expect, it } from 'vitest';
import {
  calculateAmmSpotPrice,
  compareAmmToOracle,
  estimateAmmSlippage,
  DEFAULT_DIVERGENCE_THRESHOLD_BPS,
} from './ammPoolPrice';

describe('AmmPoolPrice comparison', () => {
  const samplePool = {
    poolId: 'pool-xlm-usdc-001',
    assetA: 'XLM',
    assetB: 'USDC',
    reserveA: 1_000_000,
    reserveB: 120_000,
  };

  it('calculates the spot price correctly from reserves', () => {
    const spot = calculateAmmSpotPrice(samplePool);
    expect(spot).toBeCloseTo(0.12, 6);
  });

  it('throws on non-positive reserves', () => {
    expect(() =>
      calculateAmmSpotPrice({ ...samplePool, reserveA: 0 })
    ).toThrow('Reserves must be positive');
  });

  it('compares AMM spot price to Oracle aggregate within threshold', () => {
    const comparison = compareAmmToOracle(samplePool, 0.12, DEFAULT_DIVERGENCE_THRESHOLD_BPS);
    expect(comparison.ammPrice).toBeCloseTo(0.12);
    expect(comparison.oraclePrice).toBe(0.12);
    expect(comparison.deviationBps).toBe(0);
    expect(comparison.isDivergent).toBe(false);
  });

  it('flags divergence when deviation exceeds threshold', () => {
    // Oracle price is 0.10, AMM price is 0.12 (20% divergence, 2000 bps)
    const comparison = compareAmmToOracle(samplePool, 0.10, 200);
    expect(comparison.deviationBps).toBe(2000);
    expect(comparison.isDivergent).toBe(true);
  });

  it('calculates trade slippage for swap input', () => {
    const slippage = estimateAmmSlippage(samplePool, 10_000);
    expect(slippage).toBeGreaterThan(0);
    expect(slippage).toBeLessThan(0.05);
  });
});
