import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTimeSeriesStore } from '../services/timeSeriesStore';
import { usePriceProofVerification } from './usePriceProofVerification';
import type { PriceProof } from '../types/priceProof';

export interface FeedMover {
  source: string;
  changePct: number;
}

export interface DegradedSource {
  source: string;
  reason: string;
}

export interface DashboardSummary {
  movers: FeedMover[];
  degraded: DegradedSource[];
  alertsToday: number;
}

export type DashboardSummaryStatus = 'loading' | 'empty' | 'stale' | 'ready';

export interface UseDashboardSummaryResult {
  status: DashboardSummaryStatus;
  summary: DashboardSummary;
  lastUpdated: number | null;
  isStale: boolean;
  refetch: () => void;
}

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const MAX_MOVERS = 5;

function startOfToday(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

function computeMovers(series: Record<string, number[]>): FeedMover[] {
  const movers: FeedMover[] = [];
  for (const [source, points] of Object.entries(series)) {
    if (!points || points.length < 2) continue;
    const first = points[0];
    const last = points[points.length - 1];
    if (!first) continue;
    const changePct = ((last - first) / Math.abs(first)) * 100;
    movers.push({ source, changePct });
  }
  return movers
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, MAX_MOVERS);
}

function computeDegraded(proofs: PriceProof[]): DegradedSource[] {
  const degraded: DegradedSource[] = [];
  for (const proof of proofs) {
    if (proof.status === 'failed' || proof.status === 'degraded') {
      degraded.push({
        source: proof.source,
        reason: proof.status === 'failed' ? 'verification failed' : 'degraded',
      });
    }
  }
  return degraded;
}

function countAlertsToday(proofs: PriceProof[]): number {
  const since = startOfToday();
  return proofs.filter((proof) => {
    const ts = proof.updatedAt ?? proof.createdAt;
    return typeof ts === 'number' && ts >= since && proof.status === 'failed';
  }).length;
}

export function useDashboardSummary(): UseDashboardSummaryResult {
  const series = useTimeSeriesStore((state) => state.series);
  const lastUpdated = useTimeSeriesStore((state) => state.lastUpdated);
  const { data: proofs, isLoading, refetch } = usePriceProofVerification();

  const summary = useMemo<DashboardSummary>(() => {
    const proofList = proofs ?? [];
    return {
      movers: computeMovers(series ?? {}),
      degraded: computeDegraded(proofList),
      alertsToday: countAlertsToday(proofList),
    };
  }, [series, proofs]);

  const isStale =
    lastUpdated !== null && Date.now() - lastUpdated > STALE_THRESHOLD_MS;

  const isEmpty =
    summary.movers.length === 0 &&
    summary.degraded.length === 0 &&
    summary.alertsToday === 0;

  let status: DashboardSummaryStatus = 'ready';
  if (isLoading) {
    status = 'loading';
  } else if (isEmpty) {
    status = 'empty';
  } else if (isStale) {
    status = 'stale';
  }

  return {
    status,
    summary,
    lastUpdated,
    isStale,
    refetch,
  };
}
