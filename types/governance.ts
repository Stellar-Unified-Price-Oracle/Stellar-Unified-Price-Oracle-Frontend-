// Governance-related shared types.

export type DisputeStatus =
  | 'open'
  | 'under_review'
  | 'evidence_required'
  | 'voting'
  | 'resolved'
  | 'appealed'
  | 'closed'
  | 'rejected';

export type DisputeOutcome =
  | 'upheld'
  | 'rejected'
  | 'partially_upheld'
  | 'settled'
  | 'dismissed';

export interface DisputeStatusTransition {
  from: DisputeStatus;
  to: DisputeStatus;
  allowed: boolean;
  requiresReason?: boolean;
}

export interface LegacyPriceDispute {
  id: string;
  status: DisputeStatus;
  outcome?: DisputeOutcome;
  priceId?: string;
  reason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const DISPUTE_STATUS_LABELS: Record<DisputeStatus, string> = {
  open: 'Open',
  under_review: 'Under Review',
  evidence_required: 'Evidence Required',
  voting: 'Voting',
  resolved: 'Resolved',
  appealed: 'Appealed',
  closed: 'Closed',
  rejected: 'Rejected',
};

export const DISPUTE_STATUS_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  open: ['under_review', 'rejected', 'closed'],
  under_review: ['evidence_required', 'voting', 'resolved', 'rejected'],
  evidence_required: ['under_review', 'voting', 'rejected'],
  voting: ['resolved', 'rejected'],
  resolved: ['appealed', 'closed'],
  appealed: ['under_review', 'resolved', 'closed'],
  closed: [],
  rejected: ['appealed', 'closed'],
};
