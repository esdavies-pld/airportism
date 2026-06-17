import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { sql } from 'drizzle-orm';
import { getDb } from '../lib/db/client';
import { airports } from '../lib/db/schema';

interface CsvRow {
  ident: string;
  type: string;
  name: string;
  latitude_deg: string;
  longitude_deg: string;
  iso_country: string;
  municipality: string;
  scheduled_service: string;
  icao_code: string;
  iata_code: string;
}

const ALLOWED_TYPES = new Set(['large_airport', 'medium_airport', 'small_airport']);
const IATA_REGEX = /^[A-Z]{3}$/;
const ICAO_REGEX = /^[A-Z]{4}$/;

async function main() {
  const csvContent = readFileSync('data/airports.csv', 'utf-8');
  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  }) as CsvRow[];

  console.log(`Total CSV rows: ${rows.length.toLocaleString()}`);

  const skipped = { notUS: 0, badType: 0, noService: 0, noIata: 0, badCoords: 0, dupIata: 0 };
  const byIata = new Map<string, typeof airports.$inferInsert>();

  for (const row of rows) {
    if (row.iso_country !== 'US') { skipped.notUS++; continue; }
    if (!ALLOWED_TYPES.has(row.type)) { skipped.badType++; continue; }
    if (row.scheduled_service !== 'yes') { skipped.noService++; continue; }
    if (!IATA_REGEX.test(row.iata_code)) { skipped.noIata++; continue; }

    const lat = parseFloat(row.latitude_deg);
    const lon = parseFloat(row.longitude_deg);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { skipped.badCoords++; continue; }

    if (byIata.has(row.iata_code)) { skipped.dupIata++; continue; }

    byIata.set(row.iata_code, {
      iata: row.iata_code,
      icao: ICAO_REGEX.test(row.icao_code) ? row.icao_code : null,
      name: row.name,
      city: row.municipality || null,
      country: 'United States',
      countryIso: 'US',
      lat,
      lon,
      tier: 3,
      enabled: true,
    });
  }

  console.log(
    `Skipped — notUS: ${skipped.notUS.toLocaleString()}, badType: ${skipped.badType.toLocaleString()}, noService: ${skipped.noService.toLocaleString()}, noIata: ${skipped.noIata.toLocaleString()}, badCoords: ${skipped.badCoords}, dupIata: ${skipped.dupIata}`,
  );
  console.log(`To upsert: ${byIata.size}`);

  const db = getDb();
  const values = Array.from(byIata.values());
  const BATCH = 500;
  let inserted = 0;

  for (let i = 0; i < values.length; i += BATCH) {
    const batch = values.slice(i, i + BATCH);
    await db
      .insert(airports)
      .values(batch)
      .onConflictDoUpdate({
        target: airports.iata,
        set: {
          icao: sql`excluded.icao`,
          name: sql`excluded.name`,
          city: sql`excluded.city`,
          country: sql`excluded.country`,
          countryIso: sql`excluded.country_iso`,
          lat: sql`excluded.lat`,
          lon: sql`excluded.lon`,
        },
      });
    inserted += batch.length;
  }

  console.log(`Upserted: ${inserted}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
