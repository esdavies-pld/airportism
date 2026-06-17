import { z } from 'zod';

export const guessBodySchema = z.object({
  questionIndex: z.number().int().min(0).max(2),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  elapsedMs: z.number().int().nonnegative(),
});

export type GuessBody = z.infer<typeof guessBodySchema>;
