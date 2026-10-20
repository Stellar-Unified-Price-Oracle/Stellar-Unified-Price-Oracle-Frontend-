# Dispute Status Transitions & Recorded Timestamps

## Overview

When price disputes are challenged and evaluated across the Stellar Unified Price Oracle, stakeholders need clear visibility into each milestone of the dispute lifecycle. This document outlines how dispute status transitions and recorded timestamps are structured, visualized, and handled across the frontend application.

## Dispute Lifecycle Stages

A dispute transitions through standard governance states:

1. **`open`**: A challenger files a dispute citing an outlier or manipulated price, providing initial bond stake and evidence.
2. **`under_review`**: The oracle governance council or automated validator quorum confirms evidence receipt and begins formal deliberations.
3. **`resolved_upheld`**: The council affirms the challenge; the outlier price is rejected/overturned, and the challenger's bond is returned with potential reward.
4. **`resolved_overturned`**: The challenge is denied; the original price is deemed legitimate, and the stake may be forfeited according to governance rules.
5. **`withdrawn`**: The challenger voluntarily rescinds the dispute before a resolution quorum is convened.

## Data Model & API Contract

### Backend Schema (`DisputeStatusTransition`)

Backend oracle services and indexers provide status transitions as an ordered array on each dispute object:

```typescript
export interface DisputeStatusTransition {
  status: DisputeStatus
  timestamp: number // Milliseconds epoch timestamp
  actor?: string // Stellar G... public key or contract address
  note?: string // Contextual reasoning or governance tx hash
}

export interface PriceDispute {
  id: string
  assetPair: string
  contestedAt: number
  contestedPrice: string
  challengerPrice: string | null
  challenger: string
  status: DisputeStatus
  openedAt: number
  resolutionDeadline: number | null
  rationale: string
  impliedSources: string[]
  evidence: DisputeEvidence[]
  comments: DisputeComment[]
  resolutionNote: string | null
  statusTransitions?: DisputeStatusTransition[]
}
```

### Zod Validation Schema

The API client schema in `src/api/schemas.ts` parses and validates incoming dispute payloads:

```typescript
export const DisputeStatusTransitionSchema = z.object({
  status: DisputeStatusSchema,
  timestamp: z.number(),
  actor: z.string().optional(),
  note: z.string().optional(),
})
```

## Fallback & Graceful Degradation

If an upstream indexer or older backend version has not yet populated `statusTransitions`, the frontend automatically synthesizes transition milestones using `getDisputeStatusTransitions(dispute)` in `src/utils/disputeProcess.ts`:

- The initial `open` transition is derived from `dispute.openedAt` and `dispute.challenger`.
- If the dispute is `under_review`, a transition is synthesized using the earliest comment timestamp or dispute opening timestamp.
- If the dispute is in a resolved state (`resolved_upheld`, `resolved_overturned`, `withdrawn`), the final resolution milestone is synthesized from the latest evidence/comment timestamp or deadline, referencing `dispute.resolutionNote`.

## UI & Accessibility Features

The `StatusTransitionTimeline` in `src/components/DisputePanel.tsx` presents a vertical timeline with the following specifications:

- **Numbered Nodes**: Chronological step badges indicate the progression sequence.
- **Color-Coded Badges**: Consistent status tokens match oracle governance tags (yellow for open, blue for under review, green for upheld, red for overturned, gray for withdrawn).
- **Recorded Timestamps**: Formatted localized timestamps (UTC date & time) rendered in tabular font metrics.
- **Actor Provenance**: Challenger, reviewer, or council public keys truncated with full tooltip on hover.
- **Context Notes**: Auditor comments, quorum voting outcomes, or transition rationales.
- **Accessibility**:
  - Semantic `<ol>` container with `aria-label="Status transitions for dispute {id}"`.
  - Active/current stage marked with `aria-current="step"`.
  - Visual and screen-reader status indicators.
