import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { dailyResults, guesses } from '@/lib/db/schema';
import { ensurePlayer, isValidPlayerId } from '@/lib/player';
import { currentPlayDate } from '@/lib/date';

const EXPECTED_GUESSES = 3;

export async function POST(req: Request) {
  const playerId = req.headers.get('x-player-id');
  if (!isValidPlayerId(playerId)) {
    return NextResponse.json(
      { error: 'X-Player-Id header required', code: 'missing_player_id' },
      { status: 400 },
    );
  }

  await ensurePlayer(playerId);

  const db = getDb();
  const playDate = currentPlayDate();

  const [agg] = await db
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(score), 0)::int`,
    })
    .from(guesses)
    .where(and(eq(guesses.playerId, playerId), eq(guesses.playDate, playDate)));

  if (agg.count < EXPECTED_GUESSES) {
    return NextResponse.json(
      {
        error: `Round incomplete: ${agg.count}/${EXPECTED_GUESSES} guesses submitted`,
        code: 'incomplete',
      },
      { status: 400 },
    );
  }

  const totalScore = agg.total;

  await db
    .insert(dailyResults)
    .values({ playerId, playDate, totalScore })
    .onConflictDoUpdate({
      target: [dailyResults.playerId, dailyResults.playDate],
      set: { totalScore: sql`excluded.total_score` },
    });

  return NextResponse.json({ totalScore });
}
