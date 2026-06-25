import { z } from 'zod'

export const PriceDataSchema = z.object({
  assetPair: z.string(),
  price: z.number(),
  timestamp: z.number(),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string()),
})

export const PriceHistoryEntrySchema = z.object({
  price: z.number(),
  timestamp: z.number(),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string()),
})

export const PriceHistoryResponseSchema = z.object({
  pair: z.string(),
  history: z.array(PriceHistoryEntrySchema),
})

export const BatchHistoryResponseSchema = z.array(PriceHistoryResponseSchema)

export const HealthSchema = z.object({
  status: z.string(),
  uptime: z.number(),
})

// Type inference from schemas
export type PriceDataFromSchema = z.infer<typeof PriceDataSchema>
export type PriceHistoryResponseFromSchema = z.infer<typeof PriceHistoryResponseSchema>
export type BatchHistoryResponseFromSchema = z.infer<typeof BatchHistoryResponseSchema>
