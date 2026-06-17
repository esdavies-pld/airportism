import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { eq, gte } from 'drizzle-orm';
import { getDb } from '../lib/db/client';
import { airports, dailyRounds } from '../lib/db/schema';

const HORIZON_DAYS = 90;
const MAX_COOLDOWN = 90;

// xorshift32 seeded on the play date — keeps `pnpm tsx scripts/generate-rounds.ts`
// reproducible without pulling in a seedable-RNG dependency.
function makeRng(seed: number) {
  let s = seed | 0;
  if (s === 0) s = 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

function seedFromDate(date: string): number {
  let h = 0;
  for (let i = 0; i < date.length; i++) {
    h = ((h << 5) - h + date.charCodeAt(i)) | 0;
  }
  return h;
}

function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

async function main() {
  const db = getDb();

  const all = await db
    .select({ iata: airports.iata, tier: airports.tier })
    .from(airports)
    .where(eq(airports.enabled, true));

  const byTier: Record<1 | 2 | 3, string[]> = { 1: [], 2: [], 3: [] };
  for (const a of all) {
    if (a.tier === 1 || a.tier === 2 || a.tier === 3) byTier[a.tier].push(a.iata);
  }
  byTier[1].sort();
  byTier[2].sort();
  byTier[3].sort();

  const cooldown: Record<1 | 2 | 3, number> = {
    1: Math.min(MAX_COOLDOWN, byTier[1].length - 1),
    2: Math.min(MAX_COOLDOWN, byTier[2].length - 1),
    3: Math.min(MAX_COOLDOWN, byTier[3].length - 1),
  };

  console.log(`Pools: T1=${byTier[1].length}, T2=${byTier[2].length}, T3=${byTier[3].length}`);
  console.log(`Cooldowns (days): T1=${cooldown[1]}, T2=${cooldown[2]}, T3=${cooldown[3]}`);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const targetDates: string[] = [];
  for (let i = 1; i <= HORIZON_DAYS; i++) {
    targetDates.push(utcDateString(addDays(today, i)));
  }

  // Pull existing rounds within the largest cooldown window before our first target,
  // so re-runs after a partial generation respect prior picks.
  const earliest = addDays(today, 1 - MAX_COOLDOWN);
  const existing = await db
    .select({ playDate: dailyRounds.playDate, airports: dailyRounds.airports })
    .from(dailyRounds)
    .where(gte(dailyRounds.playDate, utcDateString(earliest)));

  const usedByDate = new Map<string, string[]>();
  for (const r of existing) usedByDate.set(r.playDate, r.airports);

  const tierOfIata = new Map<string, 1 | 2 | 3>();
  for (const t of [1, 2, 3] as const) {
    for (const iata of byTier[t]) tierOfIata.set(iata, t);
  }

  const newRounds: { playDate: string; airports: string[] }[] = [];
  let skippedExisting = 0;

  for (const date of targetDates) {
    if (usedByDate.has(date)) {
      skippedExisting++;
      continue;
    }

    const rng = makeRng(seedFromDate(date));
    const dDate = new Date(date + 'T00:00:00Z');
    const picks: string[] = [];

    for (const tier of [1, 2, 3] as const) {
      const cooldownSet = new Set<string>();
      for (let back = 1; back <= cooldown[tier]; back++) {
        const used = usedByDate.get(utcDateString(addDays(dDate, -back)));
        if (used) {
          for (const iata of used) {
            if (tierOfIata.get(iata) === tier) cooldownSet.add(iata);
          }
        }
      }

      const pool = byTier[tier].filter((iata) => !cooldownSet.has(iata));
      if (pool.length === 0) {
        throw new Error(
          `No T${tier} airports available for ${date}: cooldown ${cooldown[tier]} days exhausted the pool of ${byTier[tier].length}.`,
        );
      }

      picks.push(pool[Math.floor(rng() * pool.length)]);
    }

    newRounds.push({ playDate: date, airports: picks });
    usedByDate.set(date, picks);
  }

  console.log(`Generated: ${newRounds.length} new rounds. Skipped (already exist): ${skippedExisting}`);

  for (const row of newRounds) {
    await db.insert(dailyRounds).values(row).onConflictDoNothing({ target: dailyRounds.playDate });
  }

  // Spot checks
  const tierUses: Record<1 | 2 | 3, Map<string, number>> = { 1: new Map(), 2: new Map(), 3: new Map() };
  for (const r of newRounds) {
    for (let i = 0; i < 3; i++) {
      const t = (i + 1) as 1 | 2 | 3;
      tierUses[t].set(r.airports[i], (tierUses[t].get(r.airports[i]) || 0) + 1);
    }
  }
  for (const t of [1, 2, 3] as const) {
    const counts = Array.from(tierUses[t].values());
    if (counts.length === 0) continue;
    console.log(
      `T${t}: ${tierUses[t].size} distinct airports used, min ${Math.min(...counts)}× / max ${Math.max(...counts)}× per airport`,
    );
  }

  console.log('First 5 rounds:');
  for (const r of newRounds.slice(0, 5)) {
    console.log(`  ${r.playDate}: ${r.airports.join(' / ')}`);
  }
  console.log('Last 5 rounds:');
  for (const r of newRounds.slice(-5)) {
    console.log(`  ${r.playDate}: ${r.airports.join(' / ')}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
