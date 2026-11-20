import { z } from 'zod';

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  scopes: z.array(z.string()).readonly().default([]),
});

export type AuthUser = z.infer<typeof authUserSchema>;

export const sessionSchema = z.object({
  user: authUserSchema,
  token: z.string(),
  expiresAt: z.string().optional(),
});

export type Session = z.infer<typeof sessionSchema>;
