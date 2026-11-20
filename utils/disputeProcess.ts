import type { Dispute, DisputeStatus } from '../types/governance';

export type DisputeOutcome = 'upheld' | 'rejected' | 'partially_upheld' | 'withdrawn';

export interface LegacyPriceDispute {
  id: string;
  assetId: string;
  price: number;
  reason: string;
  status: DisputeStatus;
  createdAt: string;
}

export interface DisputeStatusTransition {
  from: DisputeStatus;
  to: DisputeStatus;
  timestamp: string;
  actor?: string;
  note?: string;
}

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  open: 'Open',
  under_review: 'Under Review',
  awaiting_evidence: 'Awaiting Evidence',
  resolved: 'Resolved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  escalated: 'Escalated',
  closed: 'Closed',
};

export const DISPUTE_STATUS_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  open: ['under_review', 'withdrawn', 'escalated'],
  under_review: ['awaiting_evidence', 'resolved', 'rejected', 'escalated'],
  awaiting_evidence: ['under_review', 'resolved', 'rejected', 'withdrawn'],
  resolved: ['closed'],
  rejected: ['closed', 'escalated'],
  withdrawn: ['closed'],
  escalated: ['under_review', 'resolved', 'rejected'],
  closed: [],
};

export function getDisputeStatusLabel(status: DisputeStatus): string {
  return DISPUTE_STATUS_LABELS[status];
}

export function getNextDisputeStatuses(status: DisputeStatus): DisputeStatus[] {
  return DISPUTE_STATUS_TRANSITIONS[status];
}

export function canTransitionDisputeStatus(from: DisputeStatus, to: DisputeStatus): boolean {
  return DISPUTE_STATUS_TRANSITIONS[from].includes(to);
}

export function createStatusTransition(
  from: DisputeStatus,
  to: DisputeStatus,
  actor?: string,
  note?: string,
): DisputeStatusTransition {
  return {
    from,
    to,
    timestamp: new Date().toISOString(),
    actor,
    note,
  };
}

export function isDisputeResolved(dispute: Dispute): boolean {
  return dispute.status === 'resolved' || dispute.status === 'rejected' || dispute.status === 'closed';
}
