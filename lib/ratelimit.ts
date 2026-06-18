// Per-player sliding-window rate limit for /guess (handoff §8.4).
// Backed by Upstash Redis so multiple Vercel instances share state.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const MIN_ELAPSED_MS = 250;

let cached: Ratelimit | null = null;

export function getGuessRateLimit(): Ratelimit {
  if (cached) return cached;
  cached = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: false,
    prefix: 'apg:guess',
  });
  return cached;
}
