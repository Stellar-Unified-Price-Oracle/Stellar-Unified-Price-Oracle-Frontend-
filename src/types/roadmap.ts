import { z } from 'zod'

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

export type RoadmapStatusChange = z.infer<typeof RoadmapStatusChangeSchema>

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

export type RoadmapItem = z.infer<typeof RoadmapItemSchema>
