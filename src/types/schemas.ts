import { z } from 'zod';

export const qualityFlagSchema = z.object({
  code: z.string(),
  severity: z.enum(['info', 'warning', 'error']).optional(),
  message: z.string().optional(),
});

export const priceDataSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  price: z.number(),
  timestamp: z.string(),
  qualityFlags: z.array(qualityFlagSchema).optional(),
  sourceTickProvenanceUrl: z.string().optional(),
});

export type QualityFlag = z.infer<typeof qualityFlagSchema>;
export type PriceData = z.infer<typeof priceDataSchema>;
