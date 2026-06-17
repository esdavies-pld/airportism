import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { dailyResults } from '@/lib/db/schema';
import { ensurePlayer, isValidPlayerId } from '@/lib/player';
import { currentPlayDate } from '@/lib/date';
import { computeDistribution, computeStreaks } from '@/lib/stats';

export async function GET(req: Request) {
  const playerId = req.headers.get('x-player-id');
  if (!isValidPlayerId(playerId)) {
    return NextResponse.json(
      { error: 'X-Player-Id header required', code: 'missing_player_id' },
      { status: 400 },
    );
  }

  await ensurePlayer(playerId);

  const db = getDb();
  const results = await db
    .select({ playDate: dailyResults.playDate, totalScore: dailyResults.totalScore })
    .from(dailyResults)
    .where(eq(dailyResults.playerId, playerId))
    .orderBy(desc(dailyResults.playDate));

  if (results.length === 0) {
    return NextResponse.json({
      gamesPlayed: 0,
      currentStreak: 0,
      maxStreak: 0,
      avgScore: 0,
      bestScore: 0,
      distribution: [0, 0, 0, 0, 0],
    });
  }

  const scores = results.map((r) => r.totalScore);
  const gamesPlayed = scores.length;
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / gamesPlayed);
  const bestScore = Math.max(...scores);
  const { current, max } = computeStreaks(
    results.map((r) => r.playDate),
    currentPlayDate(),
  );

  return NextResponse.json({
    gamesPlayed,
    currentStreak: current,
    maxStreak: max,
    avgScore,
    bestScore,
    distribution: computeDistribution(scores),
  });
}
