# Protocol Roadmap & Public Change History

This document details the public roadmap architecture, change audit logging, and accessibility standards implemented for the Stellar Unified Price Oracle frontend (#861).

---

## 1. Governance Motivation

The oracle aggregator coordinates cross-venue Stellar decentralized price feeds, Soroban TWAP contracts, and cryptographic verification mechanisms. To maintain public transparency and institutional accountability across working groups, all planned, in-flight, and delivered initiatives require verifiable status tracking:

1. **Clear Ownership**: Every initiative is linked to a steward working group (e.g. Core Oracle Committee, Security WG, Feeds WG).
2. **Auditable Transitions**: Status changes cannot happen silently. Each transition preserves the previous status, new status, timestamp, responsible steward, rationale, and external evidence URL.
3. **Fail-Safe Client Degradation**: When backend endpoints are unreachable or in testnet isolation, client-side verified baseline milestones render rather than a blank error screen.

---

## 2. Data Model & Validation

The roadmap schema (`src/types/roadmap.ts`) enforces strict Zod validation:

```typescript
export const ROADMAP_STATUSES = ['planned', 'in_development', 'testnet', 'completed', 'deferred'] as const
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number]

export const ROADMAP_CATEGORIES = ['protocol', 'feeds', 'governance', 'infrastructure', 'security'] as const
export type RoadmapCategory = (typeof ROADMAP_CATEGORIES)[number]

export const RoadmapStatusChangeSchema = z.object({
  id: z.string(),
  fromStatus: z.union([z.enum(ROADMAP_STATUSES), z.literal('initial')]),
  toStatus: z.enum(ROADMAP_STATUSES),
  changedAt: z.number(),
  reason: z.string(),
  changedBy: z.string(),
  evidenceUrl: z.string().nullable().optional(),
})

export const RoadmapItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.enum(ROADMAP_CATEGORIES),
  status: z.enum(ROADMAP_STATUSES),
  targetMilestone: z.string(),
  description: z.string(),
  steward: z.string(),
  lastUpdated: z.number(),
  changeHistory: z.array(RoadmapStatusChangeSchema),
})
```

---

## 3. Component Architecture & UI Elements

### `RoadmapCard` (`src/components/RoadmapCard.tsx`)
- Renders item title, category badge, target milestone pill, steward, last update timestamp, and current status badge.
- Features an accessible, collapsible **Public Change History Timeline**:
  - Accessible disclosure button configured with `aria-expanded` and `aria-controls`.
  - Chronological vertical timeline showing status progression (`Planned → In Development → Testnet Live → Completed`).
  - Outgoing external evidence links rendered with `target="_blank" rel="noopener noreferrer"` and descriptive `aria-label`.

### `Roadmap` Page (`src/pages/Roadmap.tsx`)
- **Status Ribbon Metrics**: Quick-access counters for each lifecycle status (Planned, In Development, Testnet Live, Completed, Deferred). Clicking any counter activates a quick filter for that status.
- **Search & Filter Controls**: Real-time multi-field search across titles, descriptions, change notes, and stewards.
- **Accessible Live Region**: `aria-live="polite"` region announcing live filtered item counts for screen-reader users.
- **Defensive States**: Graceful handling for loading states, empty query results with filter reset affordance, and network error banners with manual reconnect actions.

---

## 4. Accessibility & Interaction Specifications

- **Keyboard Traversal**: All interactive disclosures, filters, and metric toggles are reachable via standard keyboard navigation (`Tab`, `Shift+Tab`, `Enter`, `Space`).
- **Screen Reader Announcements**: Live region (`role="status" aria-live="polite"`) alerts users of query count updates without jarring focus interrupts.
- **Color Contrast**: Badges comply with WCAG 2.1 AA standards in both light and dark themes, using distinct text and background hues.
