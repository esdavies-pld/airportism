import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { dailyRounds, dailyResults } from '@/lib/db/schema';
import { ensurePlayer, isValidPlayerId } from '@/lib/player';
import { currentPlayDate } from '@/lib/date';

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
  const playDate = currentPlayDate();

  const [round] = await db
    .select({ airports: dailyRounds.airports })
    .from(dailyRounds)
    .where(eq(dailyRounds.playDate, playDate))
    .limit(1);

  if (!round) {
    return NextResponse.json(
      { error: 'No round scheduled for today', code: 'no_round' },
      { status: 404 },
    );
  }

  const [completed] = await db
    .select({ totalScore: dailyResults.totalScore })
    .from(dailyResults)
    .where(and(eq(dailyResults.playerId, playerId), eq(dailyResults.playDate, playDate)))
    .limit(1);

  const questions = round.airports.map((iata, index) => ({ index, iata }));

  return NextResponse.json({
    playDate,
    questions,
    ...(completed ? { alreadyCompleted: true, totalScore: completed.totalScore } : {}),
  });
}
