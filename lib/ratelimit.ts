// Per-player sliding-window rate limit for /guess (handoff §8.4).
// Backed by Upstash Redis so multiple Vercel instances share state.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const MIN_ELAPSED_MS = 250;

let cached: Ratelimit | null = null;

export function getGuessRateLimit(): Ratelimit {
  if (cached) return cached;
  cached = new Ratelimit({
    // The Vercel-managed Upstash resource injects KV_REST_API_*, not the
    // UPSTASH_REDIS_REST_* pair Redis.fromEnv() looks for.
    redis: new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    }),
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    analytics: false,
    prefix: 'apg:guess',
  });
  return cached;
}

// Fail open. If Redis is unreachable (or its env vars are missing) we log and let
// the guess through rather than 500-ing: losing throttling for the duration of an
// outage beats losing the core game loop. The MIN_ELAPSED_MS flagged-round check
// in /complete is independent of Redis and still applies.
export async function checkGuessRateLimit(
  playerId: string,
): Promise<{ allowed: boolean; retrySeconds: number }> {
  try {
    const rl = await getGuessRateLimit().limit(playerId);
    return {
      allowed: rl.success,
      retrySeconds: Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000)),
    };
  } catch (err) {
    console.error('Guess rate limiter unavailable — allowing request', err);
    return { allowed: true, retrySeconds: 0 };
  }
}
