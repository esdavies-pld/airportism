import { describe, it, expect } from 'vitest';
import { scoreEmoji, shareString } from './share';

describe('scoreEmoji', () => {
  it.each([
    [5000, '🟩'],
    [4000, '🟩'],
    [3999, '🟨'],
    [2500, '🟨'],
    [2499, '🟧'],
    [1000, '🟧'],
    [999, '🟥'],
    [250, '🟥'],
    [249, '⬛'],
    [0, '⬛'],
  ])('score %i → %s', (score, expected) => {
    expect(scoreEmoji(score)).toBe(expected);
  });
});

describe('shareString', () => {
  it('renders the spec format with 3 squares + total + host (no protocol)', () => {
    const out = shareString({
      playDate: '2026-06-17',
      totalScore: 11042,
      scores: [4500, 2200, 900],
      siteUrl: 'https://airportism.com',
    });
    expect(out).toBe(
      'Airportism 2026-06-17\n11,042 / 15,000\n\n🟩🟧🟥\n\nPlay at airportism.com',
    );
  });

  it('strips trailing slash and http:// from siteUrl', () => {
    const out = shareString({
      playDate: '2026-06-17',
      totalScore: 0,
      scores: [0, 0, 0],
      siteUrl: 'http://localhost:3000/',
    });
    expect(out.endsWith('Play at localhost:3000')).toBe(true);
  });

  it('falls back to airportism.com when siteUrl is missing', () => {
    const out = shareString({ playDate: '2026-06-17', totalScore: 0, scores: [] });
    expect(out.endsWith('Play at airportism.com')).toBe(true);
  });
});
