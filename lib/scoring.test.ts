import { describe, it, expect } from 'vitest';
import { haversineMiles, scoreForDistance } from './scoring';

const JFK = { lat: 40.6413, lon: -73.7781 };
const LAX = { lat: 33.9416, lon: -118.4085 };
const BOS = { lat: 42.3656, lon: -71.0096 };

describe('haversineMiles', () => {
  it('JFK ↔ LAX ≈ 2470 mi (per CLAUDE.md regression pair)', () => {
    expect(haversineMiles(JFK, LAX)).toBeCloseTo(2470, -1);
  });

  it('JFK ↔ BOS ≈ 186 mi (per CLAUDE.md regression pair)', () => {
    expect(haversineMiles(JFK, BOS)).toBeCloseTo(186, -1);
  });

  it('same point → 0', () => {
    expect(haversineMiles(JFK, JFK)).toBe(0);
  });

  it('symmetric', () => {
    expect(haversineMiles(JFK, LAX)).toBeCloseTo(haversineMiles(LAX, JFK), 6);
  });
});

describe('scoreForDistance', () => {
  // Reference table from AIRPORTISM_HANDOFF.md §6 — exact match expected
  // since the formula is deterministic and Math.round is integer output.
  // SCALE_MI = 750 (same number as the old SCALE_KM), so the curve maps
  // distance-in-miles to the same scores the old km-scale produced.
  it.each([
    [0, 5000],
    [50, 4678],
    [100, 4376],
    [250, 3583],
    [500, 2567],
    [1000, 1318],
    [2000, 347],
    [5000, 6],
  ])('%i mi → %i points', (mi, expected) => {
    expect(scoreForDistance(mi)).toBe(expected);
  });

  it('strictly decreases with distance', () => {
    expect(scoreForDistance(100)).toBeGreaterThan(scoreForDistance(200));
    expect(scoreForDistance(500)).toBeGreaterThan(scoreForDistance(1000));
    expect(scoreForDistance(2000)).toBeGreaterThan(scoreForDistance(5000));
  });
});
