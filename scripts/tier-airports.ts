import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { inArray, sql } from 'drizzle-orm';
import { getDb } from '../lib/db/client';
import { airports } from '../lib/db/schema';

async function main() {
  const t1: string[] = JSON.parse(readFileSync('data/tier1.json', 'utf-8'));
  const t2: string[] = JSON.parse(readFileSync('data/tier2.json', 'utf-8'));

  const overlap = t1.filter((c) => t2.includes(c));
  if (overlap.length) {
    console.error(`ERROR: tier1 and tier2 overlap: ${overlap.join(', ')}`);
    process.exit(1);
  }

  console.log(`Tier 1 seed: ${t1.length} codes`);
  console.log(`Tier 2 seed: ${t2.length} codes`);

  const db = getDb();

  // Reset all to tier=3 first so re-runs after seed-list edits are idempotent.
  await db.update(airports).set({ tier: 3 });

  const t1Result = await db
    .update(airports)
    .set({ tier: 1 })
    .where(inArray(airports.iata, t1))
    .returning({ iata: airports.iata });

  const t2Result = await db
    .update(airports)
    .set({ tier: 2 })
    .where(inArray(airports.iata, t2))
    .returning({ iata: airports.iata });

  const t1Matched = new Set(t1Result.map((r) => r.iata));
  const t2Matched = new Set(t2Result.map((r) => r.iata));
  const t1Missing = t1.filter((c) => !t1Matched.has(c));
  const t2Missing = t2.filter((c) => !t2Matched.has(c));

  console.log(`Tier 1 matched: ${t1Matched.size}/${t1.length}`);
  if (t1Missing.length) console.log(`  Missing T1 (not in airports): ${t1Missing.join(', ')}`);
  console.log(`Tier 2 matched: ${t2Matched.size}/${t2.length}`);
  if (t2Missing.length) console.log(`  Missing T2 (not in airports): ${t2Missing.join(', ')}`);

  const counts = await db
    .select({ tier: airports.tier, count: sql<number>`count(*)::int` })
    .from(airports)
    .groupBy(airports.tier)
    .orderBy(airports.tier);

  console.log('Final tier counts:', counts);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
