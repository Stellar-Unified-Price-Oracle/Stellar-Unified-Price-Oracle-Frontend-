import { z } from 'zod'

/**
 * Strict Zod schema for {@link import('../types/price').PriceData}.
 * All fields are required. Extra properties are stripped.
 */
export const PriceDataSchema = z.object({
  assetPair: z.string().min(1),
  price: z.number().finite(),
  timestamp: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string().min(1)),
})

/**
 * Strict Zod schema for {@link import('../types/price').PriceHistoryEntry}.
 * All fields are required. Extra properties are stripped.
 */
export const PriceHistoryEntrySchema = z.object({
  price: z.number().finite(),
  timestamp: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string().min(1)),
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
