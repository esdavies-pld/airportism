import { describe, it, expect } from 'vitest';
import { computeStreaks, computeDistribution, DISTRIBUTION_BINS } from './stats';

describe('computeStreaks', () => {
  it('empty → 0/0', () => {
    expect(computeStreaks([], '2026-06-17')).toEqual({ current: 0, max: 0 });
  });

  it('single play today → current 1, max 1', () => {
    expect(computeStreaks(['2026-06-17'], '2026-06-17')).toEqual({ current: 1, max: 1 });
  });

  it('single play yesterday → current 1, max 1', () => {
    expect(computeStreaks(['2026-06-16'], '2026-06-17')).toEqual({ current: 1, max: 1 });
  });

  it('single play 2 days ago → current 0, max 1', () => {
    expect(computeStreaks(['2026-06-15'], '2026-06-17')).toEqual({ current: 0, max: 1 });
  });

  it('three consecutive ending today → current 3, max 3', () => {
    const dates = ['2026-06-17', '2026-06-16', '2026-06-15'];
    expect(computeStreaks(dates, '2026-06-17')).toEqual({ current: 3, max: 3 });
  });

  it('broken current streak but long historical run', () => {
    // Recent 2 days, gap, then a 4-day run earlier
    const dates = [
      '2026-06-17', '2026-06-16',           // current run = 2
      '2026-06-10', '2026-06-09', '2026-06-08', '2026-06-07', // historical run of 4
    ];
    expect(computeStreaks(dates, '2026-06-17')).toEqual({ current: 2, max: 4 });
  });

  it('played 2 days ago + earlier → current 0 even with long historical run', () => {
    const dates = [
      '2026-06-15', '2026-06-14', '2026-06-13', '2026-06-12', '2026-06-11',
    ];
    expect(computeStreaks(dates, '2026-06-17')).toEqual({ current: 0, max: 5 });
  });

  it('handles month boundary', () => {
    const dates = ['2026-06-01', '2026-05-31', '2026-05-30'];
    expect(computeStreaks(dates, '2026-06-01')).toEqual({ current: 3, max: 3 });
  });
});

describe('computeDistribution', () => {
  it('empty → all zero bins', () => {
    expect(computeDistribution([])).toEqual([0, 0, 0, 0, 0]);
  });

  it('binSize is 3000 (15000 / 5 bins)', () => {
    // bin 0: [0, 3000), bin 1: [3000, 6000), ... bin 4: [12000, 15000]
    expect(computeDistribution([0, 2999, 3000, 5999, 6000, 8999, 9000, 11999, 12000, 15000])).toEqual([2, 2, 2, 2, 2]);
  });

  it('clamps max-score into the top bin (not a 6th bin)', () => {
    expect(computeDistribution([15000])).toEqual([0, 0, 0, 0, 1]);
  });

  it('returns DISTRIBUTION_BINS-length array', () => {
    expect(computeDistribution([5000]).length).toBe(DISTRIBUTION_BINS);
  });
});
