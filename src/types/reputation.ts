// Shared reputation types used by ReputationPanel, TreasuryPanel and
// ReputationScorePanel.
//
// NOTE: `SourceReputation` was renamed to `SourceReputationScore`. The old name
// is kept as a deprecated alias so existing imports keep compiling while
// call sites migrate.

export interface SourceReputationScore {
  source: string;
  score: number;
  weight?: number;
  updatedAt?: string;
}

/** @deprecated Use `SourceReputationScore` instead. */
export type SourceReputation = SourceReputationScore;

/**
 * Typed payload returned by the reputation SWR endpoint. Panels iterate over
 * `scores`, so the shape is explicit rather than `{}`.
 */
export interface ReputationResponse {
  scores: SourceReputationScore[];
  total?: number;
}

/**
 * Typed payload returned by the treasury SWR endpoint.
 */
export interface TreasuryResponse {
  entries: SourceReputationScore[];
  total?: number;
}
