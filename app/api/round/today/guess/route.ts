import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { airports, dailyRounds, guesses } from '@/lib/db/schema';
import { ensurePlayer, isValidPlayerId } from '@/lib/player';
import { haversineMiles, scoreForDistance } from '@/lib/scoring';
import { currentPlayDate } from '@/lib/date';
import { checkGuessRateLimit } from '@/lib/ratelimit';
import { guessBodySchema } from './schema';

export async function POST(req: Request) {
  const playerId = req.headers.get('x-player-id');
  if (!isValidPlayerId(playerId)) {
    return NextResponse.json(
      { error: 'X-Player-Id header required', code: 'missing_player_id' },
      { status: 400 },
    );
  }

  const rl = await checkGuessRateLimit(playerId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded — slow down', code: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retrySeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'invalid_body' }, { status: 400 });
  }

  const parsed = guessBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid body shape', code: 'invalid_body' },
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

  const iata = round.airports[parsed.data.questionIndex];
  if (!iata) {
    return NextResponse.json(
      { error: 'questionIndex out of range for today', code: 'invalid_index' },
      { status: 400 },
    );
  }

  const [airport] = await db
    .select()
    .from(airports)
    .where(eq(airports.iata, iata))
    .limit(1);
  if (!airport) {
    return NextResponse.json(
      { error: 'Airport row missing for round IATA', code: 'no_airport' },
      { status: 500 },
    );
  }

  const reveal = {
    lat: airport.lat,
    lon: airport.lon,
    iata: airport.iata,
    name: airport.name,
    city: airport.city,
    country: airport.country,
  };

  const [existing] = await db
    .select({ score: guesses.score, distanceMi: guesses.distanceMi })
    .from(guesses)
    .where(
      and(
        eq(guesses.playerId, playerId),
        eq(guesses.playDate, playDate),
        eq(guesses.questionIndex, parsed.data.questionIndex),
      ),
    )
    .limit(1);

  if (existing) {
    return NextResponse.json({
      score: existing.score,
      distanceMi: existing.distanceMi,
      actual: reveal,
    });
  }

  const distanceMi = haversineMiles(
    { lat: parsed.data.lat, lon: parsed.data.lon },
    { lat: airport.lat, lon: airport.lon },
  );
  const score = scoreForDistance(distanceMi);

  await db.insert(guesses).values({
    playerId,
    playDate,
    questionIndex: parsed.data.questionIndex,
    iata,
    lat: parsed.data.lat,
    lon: parsed.data.lon,
    distanceMi,
    score,
    elapsedMs: parsed.data.elapsedMs,
  });

  return NextResponse.json({ score, distanceMi, actual: reveal });
}
