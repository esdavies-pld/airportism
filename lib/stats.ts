// Pure helpers for /api/me/stats — kept out of the route so the
// streak + distribution math is testable in isolation.

import { MAX_ROUND_SCORE } from './share';

export const DISTRIBUTION_BINS = 5;

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeStreaks(
  playDatesDesc: string[],
  today: string,
): { current: number; max: number } {
  if (playDatesDesc.length === 0) return { current: 0, max: 0 };

  const yesterday = addDays(today, -1);
  let current = 0;
  if (playDatesDesc[0] === today || playDatesDesc[0] === yesterday) {
    let expected = playDatesDesc[0];
    for (const d of playDatesDesc) {
      if (d !== expected) break;
      current++;
      expected = addDays(expected, -1);
    }
  }

  const asc = [...playDatesDesc].reverse();
  let max = 1;
  let run = 1;
  for (let i = 1; i < asc.length; i++) {
    if (asc[i] === addDays(asc[i - 1], 1)) {
      run++;
      if (run > max) max = run;
    } else {
      run = 1;
    }
  }

  return { current, max };
}

export function computeDistribution(scores: number[]): number[] {
  const bins = new Array<number>(DISTRIBUTION_BINS).fill(0);
  const binSize = MAX_ROUND_SCORE / DISTRIBUTION_BINS;
  for (const s of scores) {
    const idx = Math.min(DISTRIBUTION_BINS - 1, Math.max(0, Math.floor(s / binSize)));
    bins[idx]++;
  }
  return bins;
}
