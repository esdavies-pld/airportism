import { describe, it, expect } from 'vitest';
import { haversineKm, scoreForDistance } from './scoring';

const JFK = { lat: 40.6413, lon: -73.7781 };
const LAX = { lat: 33.9416, lon: -118.4085 };
const BOS = { lat: 42.3656, lon: -71.0096 };

describe('haversineKm', () => {
  it('JFK ↔ LAX ≈ 3974 km (per CLAUDE.md regression pair)', () => {
    expect(haversineKm(JFK, LAX)).toBeCloseTo(3974, -1);
  });

  it('JFK ↔ BOS ≈ 300 km (per CLAUDE.md regression pair)', () => {
    expect(haversineKm(JFK, BOS)).toBeCloseTo(300, -1);
  });

  it('same point → 0', () => {
    expect(haversineKm(JFK, JFK)).toBe(0);
  });

  it('symmetric', () => {
    expect(haversineKm(JFK, LAX)).toBeCloseTo(haversineKm(LAX, JFK), 6);
  });
});

describe('scoreForDistance', () => {
  // Reference table from AIRPORTISM_HANDOFF.md §6 — exact match expected
  // since the formula is deterministic and Math.round is integer output.
  it.each([
    [0, 5000],
    [50, 4678],
    [100, 4376],
    [250, 3583],
    [500, 2567],
    [1000, 1318],
    [2000, 347],
    [5000, 6],
  ])('%i km → %i points', (km, expected) => {
    expect(scoreForDistance(km)).toBe(expected);
  });

  it('strictly decreases with distance', () => {
    expect(scoreForDistance(100)).toBeGreaterThan(scoreForDistance(200));
    expect(scoreForDistance(500)).toBeGreaterThan(scoreForDistance(1000));
    expect(scoreForDistance(2000)).toBeGreaterThan(scoreForDistance(5000));
  });
});
