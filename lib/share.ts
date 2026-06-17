// Wordle-style emoji grid per handoff §9. Pure function, no DOM —
// the React component handles clipboard.

export const MAX_ROUND_SCORE = 15_000;

const COLOR_THRESHOLDS: { min: number; emoji: string }[] = [
  { min: 4000, emoji: '🟩' },
  { min: 2500, emoji: '🟨' },
  { min: 1000, emoji: '🟧' },
  { min: 250, emoji: '🟥' },
  { min: 0, emoji: '⬛' },
];

export function scoreEmoji(score: number): string {
  for (const { min, emoji } of COLOR_THRESHOLDS) {
    if (score >= min) return emoji;
  }
  return '⬛';
}

interface ShareInput {
  playDate: string;
  totalScore: number;
  scores: number[];
  siteUrl?: string;
}

function shareHost(siteUrl: string | undefined): string {
  const raw = siteUrl ?? 'https://airportism.com';
  return raw.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function shareString({ playDate, totalScore, scores, siteUrl }: ShareInput): string {
  const grid = scores.map(scoreEmoji).join('');
  const host = shareHost(siteUrl);
  return [
    `Airportism ${playDate}`,
    `${totalScore.toLocaleString()} / ${MAX_ROUND_SCORE.toLocaleString()}`,
    '',
    grid,
    '',
    `Play at ${host}`,
  ].join('\n');
}
