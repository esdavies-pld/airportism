# Airportism — Build Handoff

A daily browser game in the style of GeoSports / Wordle. Player is shown an IATA airport code (US airports only in v1) and taps where the airport is on a satellite globe. Three questions per day — easy, medium, hard — same for every player, daily round resets at 00:00 UTC-5.

This document is the complete spec. Build it end to end.

---

## 1. Product summary

- **Mechanic:** Show a 3-letter IATA code → player taps on a 3D globe → server scores the guess by great-circle distance → reveal actual location → repeat for 3 questions.
- **Daily round:** All players see the same 3 airports in the same order on a given UTC date. Resets at 00:00 UTC-5.
- **Difficulty:** Progressive within a round — one airport from each tier in order (tier 1 easy → tier 2 medium → tier 3 hard).
- **Scope (v1):** US airports only. ~500–700 candidates after filtering for scheduled passenger service.
- **Accounts:** Anonymous only. UUID stored in `localStorage`. No email, no password, no OAuth. No cross-device sync in v1.
- **No hints.** No country flag, no region narrowing, no skip. One guess per question.
- **No leaderboard in v1.** Personal stats (streak, average, best) only.
- **Sharing:** Wordle-style emoji grid copied to clipboard after completing the round.

---

## 2. Tech stack

- **Frontend:** Next.js 15 (App Router), TypeScript, React 19, Tailwind CSS
- **Map:** MapLibre GL JS v5+ with globe projection, Esri World Imagery raster tiles
- **Backend:** Next.js route handlers (no separate server)
- **Database:** Postgres (use Neon or Supabase for hosting; local Postgres via Docker for dev)
- **ORM:** Drizzle
- **Hosting:** Vercel
- **Package manager:** pnpm

No auth library is needed since accounts are anonymous-only.

---

## 3. Repository layout

```
airportism/
├── app/
│   ├── api/
│   │   ├── round/today/route.ts
│   │   ├── round/today/guess/route.ts
│   │   ├── round/today/complete/route.ts
│   │   └── me/stats/route.ts
│   ├── page.tsx                    # landing
│   ├── play/page.tsx               # game
│   ├── stats/page.tsx
│   └── how-it-works/page.tsx
├── components/
│   ├── Globe.tsx                   # MapLibre wrapper
│   ├── GameShell.tsx               # round state machine
│   ├── Question.tsx                # IATA code display
│   ├── ResultCard.tsx              # per-question reveal
│   └── RoundSummary.tsx            # final score + share
├── lib/
│   ├── db/
│   │   ├── schema.ts               # Drizzle schema
│   │   └── client.ts
│   ├── scoring.ts                  # haversine + score formula
│   ├── player.ts                   # anonymous UUID handling
│   └── share.ts                    # emoji grid generator
├── scripts/
│   ├── ingest-airports.ts          # OurAirports CSV → DB (US-only)
│   ├── tier-airports.ts            # assign difficulty tiers 1–3
│   └── generate-rounds.ts          # precompute 90 days of puzzles
├── data/
│   ├── airports.csv                # downloaded from OurAirports
│   ├── tier1.json                  # ~40 US hub IATA codes
│   └── tier2.json                  # ~60 US secondary IATA codes
├── drizzle/                        # migrations
├── public/
├── package.json
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
└── README.md
```

---

## 4. Database schema

Use Drizzle, Postgres. Run migrations with `pnpm drizzle-kit push`.

```ts
// lib/db/schema.ts
import { pgTable, char, text, doublePrecision, smallint, boolean, uuid, integer, timestamp, date, primaryKey, index } from 'drizzle-orm/pg-core';

export const airports = pgTable('airports', {
  iata: char('iata', { length: 3 }).primaryKey(),
  icao: char('icao', { length: 4 }),
  name: text('name').notNull(),
  city: text('city'),
  country: text('country').notNull(),
  countryIso: char('country_iso', { length: 2 }).notNull(),
  lat: doublePrecision('lat').notNull(),
  lon: doublePrecision('lon').notNull(),
  tier: smallint('tier').notNull(),       // 1 = easy, 2 = medium, 3 = hard
  enabled: boolean('enabled').notNull().default(true),
}, (t) => ({
  tierIdx: index('airports_tier_idx').on(t.tier),
}));

export const dailyRounds = pgTable('daily_rounds', {
  playDate: date('play_date').primaryKey(),
  // Postgres text[] — 3 IATA codes in difficulty order (T1, T2, T3)
  airports: text('airports').array().notNull(),
});

export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const guesses = pgTable('guesses', {
  playerId: uuid('player_id').notNull().references(() => players.id),
  playDate: date('play_date').notNull(),
  questionIndex: smallint('question_index').notNull(),
  iata: char('iata', { length: 3 }).notNull(),
  lat: doublePrecision('lat').notNull(),
  lon: doublePrecision('lon').notNull(),
  distanceKm: doublePrecision('distance_km').notNull(),
  score: integer('score').notNull(),
  elapsedMs: integer('elapsed_ms').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.playerId, t.playDate, t.questionIndex] }),
}));

export const dailyResults = pgTable('daily_results', {
  playerId: uuid('player_id').notNull().references(() => players.id),
  playDate: date('play_date').notNull(),
  totalScore: integer('total_score').notNull(),
  completedAt: timestamp('completed_at').notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.playerId, t.playDate] }),
}));
```

---

## 5. Data ingestion

### Step 1 — Download source data

Download `airports.csv` from https://davidmegginson.github.io/ourairports-data/airports.csv into `data/airports.csv`. CC0 licensed.

### Step 2 — Ingestion script

`scripts/ingest-airports.ts` should:

1. Parse the CSV with `papaparse` or `csv-parse`.
2. Filter rows where `iata_code` is a 3-letter non-empty string AND `type` is one of `large_airport`, `medium_airport`, `small_airport` AND `scheduled_service = 'yes'` AND `iso_country = 'US'`. This should yield roughly 500–700 US airports (heliports, seaplane bases, and closed fields are excluded by the type filter).
3. Map columns: `iata_code → iata`, `ident → icao` (only if it's a 4-letter code starting with a letter), `name`, `municipality → city`, `iso_country → countryIso`. Country name is hardcoded to "United States" for v1.
4. Upsert into the `airports` table with `tier = 3` as a placeholder (tiering happens in step 3).
5. Log counts: total parsed, total inserted, total skipped with reasons.

Run with `pnpm tsx scripts/ingest-airports.ts`.

### Step 3 — Tiering script

`scripts/tier-airports.ts` assigns difficulty tiers across 3 levels.

Maintain hand-curated lists of IATA codes for tiers 1 and 2 in `data/tier1.json` and `data/tier2.json`. Tier 3 is everything else.

- **Tier 1 (~40 airports):** Major US hubs every casual traveler recognizes. Seed: JFK, LAX, ORD, ATL, DFW, MIA, SFO, SEA, BOS, EWR, LGA, IAD, DCA, PHL, MCO, FLL, LAS, PHX, SAN, MSP, DTW, DEN, IAH, AUS, BNA, CLT, RDU, PIT, CMH, IND, MKE, MCI, STL, MEM, SLC, PDX, OAK, SJC, HNL, BWI, MDW, TPA.
- **Tier 2 (~60 airports):** Secondary US hubs and well-known regional airports. Curated at step 4 build time and stored in `data/tier2.json`.
- **Tier 3:** Everything else with scheduled passenger service that isn't in T1 or T2.

The script reads `data/tier1.json` and `data/tier2.json`, updates the `tier` column for each matching IATA, leaves the rest at the placeholder `tier = 3`, and logs any seed entries that didn't match a row (e.g., non-US codes carried over from a global seed).

### Step 4 — Round generation

`scripts/generate-rounds.ts`:

1. Generate rounds for the next **90 days** starting from tomorrow's UTC date.
2. For each day, draw airports with this distribution: tier 1, tier 2, tier 3 — in that order.
3. Enforce a 90-day cooldown: an IATA code cannot reappear within 90 days of its last use. With a 90-day v1 horizon, this means no IATA appears more than once across the whole horizon.
4. Seed the random selection with an inline xorshift PRNG keyed on `playDate` so the script is reproducible (no external RNG dependency).
5. Upsert into `daily_rounds` using `playDate` as conflict key.

Log a summary: dates generated, any tier where the cooldown made selection difficult.

Run this once after ingestion, and re-run anytime the tier lists or the airport set changes meaningfully. Existing `daily_rounds` rows are not retroactively updated — re-run only affects dates that don't already have a row.

---

## 6. Scoring

`lib/scoring.ts`:

```ts
const EARTH_KM = 6371;

export function haversineKm(a: {lat: number, lon: number}, b: {lat: number, lon: number}) {
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

const SCALE_KM = 750;
const MAX_SCORE = 5000;

export function scoreForDistance(distanceKm: number): number {
  return Math.round(MAX_SCORE * Math.exp(-distanceKm / SCALE_KM));
}
```

Reference values: 0 km → 5000, 50 km → 4677, 100 km → 4376, 250 km → 3589, 500 km → 2566, 1000 km → 1316, 2000 km → 346, 5000 km → 6.

Max possible round total: **15,000** (3 questions × 5,000).

No time bonus in v1.

---

## 7. API endpoints

All endpoints are Next.js route handlers under `app/api/`. All responses are JSON. All requests authenticate the player via an `X-Player-Id` header containing the anonymous UUID (created server-side on first call if absent).

### `GET /api/round/today`

Returns today's questions without coordinates.

```json
{
  "playDate": "2026-05-24",
  "questions": [
    { "index": 0, "iata": "LAX" },
    { "index": 1, "iata": "PIT" },
    { "index": 2, "iata": "ASE" }
  ]
}
```

If the player has already completed today's round, also include `alreadyCompleted: true` and `totalScore`, so the client can route them to the summary instead of letting them replay.

### `POST /api/round/today/guess`

Body: `{ questionIndex: number, lat: number, lon: number, elapsedMs: number }`

Server:
1. Validates `questionIndex` is 0–2 and the player hasn't already submitted for this index today (idempotent: return the existing record if so).
2. Looks up the airport's true coordinates from `airports`.
3. Computes `distanceKm` and `score`.
4. Inserts into `guesses`.
5. Returns:

```json
{
  "score": 4283,
  "distanceKm": 142.7,
  "actual": {
    "lat": 40.6413,
    "lon": -73.7781,
    "iata": "JFK",
    "name": "John F Kennedy International Airport",
    "city": "New York",
    "country": "United States"
  }
}
```

**Critical:** Do NOT return `actual` coordinates anywhere except in the response to a submitted guess. The `/round/today` endpoint must never leak answers.

### `POST /api/round/today/complete`

Body: `{}`. Idempotent.

Server:
1. Verifies all 3 guesses exist for this player and date.
2. Sums their scores.
3. Upserts `daily_results`.
4. Returns:

```json
{
  "totalScore": 11042
}
```

### `GET /api/me/stats`

```json
{
  "gamesPlayed": 23,
  "currentStreak": 4,
  "maxStreak": 11,
  "avgScore": 10234,
  "bestScore": 14104,
  "distribution": [0, 1, 3, 8, 11]
}
```

`distribution` is per quintile of the 0–15,000 round score range, low → high.

Streak is computed from `daily_results`: consecutive UTC dates with a result, ending on yesterday or today.

---

## 8. Anti-cheat

Light touch, intentionally minimal:

1. The full answer set per day is 3 airports out of ~500–700. A determined scraper will get it, so don't over-engineer.
2. The `/round/today` endpoint never returns coordinates. Reveal happens only after `POST /guess`.
3. Validate `elapsedMs > 250` per guess server-side. If lower, accept the guess but flag the result via a `flagged` boolean on `daily_results` (column added in step 14). Flagged results are excluded from any future aggregate stats.
4. Rate limit `/guess` to 10 requests per minute per player UUID using Upstash Redis or Vercel KV.

---

## 9. Frontend

### Player identity

`lib/player.ts`:

```ts
export function getPlayerId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('apg.playerId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('apg.playerId', id);
  }
  return id;
}
```

All API fetches send `X-Player-Id: <uuid>`. Server creates a `players` row on first sighting.

### Globe component

`components/Globe.tsx` wraps MapLibre:

```ts
const style = {
  version: 8,
  projection: { type: 'globe' },
  sources: {
    esri: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Tiles © Esri — World Imagery'
    }
  },
  layers: [{ id: 'esri-imagery', type: 'raster', source: 'esri' }]
};
```

Behavior:
- Renders at full viewport on mobile, ~70vh on desktop with question/score panel beside it.
- Initial camera: lat 20, lon 0, zoom 1.2 (whole globe visible).
- Player clicks → drop a pin marker at click location. Pin is **draggable**. A "Guess" button appears below the globe and becomes enabled once a pin exists.
- After guessing, lock the map (no more clicks until `Next`), draw a great-circle line between guess and actual locations using a GeoJSON line source. Drop a second differently-colored marker at the actual location. Animate the camera to `fitBounds` of the two points with reasonable padding.

The great-circle line should use interpolated points (not a straight 2D line) — interpolate 64 points along the great circle between guess and actual so it bends correctly on the globe.

### Game state machine

`components/GameShell.tsx` manages the per-question states: `awaitingGuess` → `guessed` → `revealed` → (next question). On the third question, transition to `complete` which fires `POST /complete` and shows `RoundSummary`.

State persists to `sessionStorage` keyed by date so a refresh mid-round doesn't lose progress.

### Question display

`components/Question.tsx`: shows the IATA code in large monospace, departure-board styling (orange-on-black, ~96px font, letter-spacing). Above the code, a small label: "Question 2 of 3 — Medium". Below the code, current cumulative score for the round.

### Per-question reveal

`components/ResultCard.tsx`: after submitting a guess, show:
- Score (animated count-up from 0)
- Distance in km (formatted: "142 km" if < 1000, "1,247 km" otherwise)
- Airport name + city + country
- "Next" button

### Round summary

`components/RoundSummary.tsx`:
- Total score, prominent (out of 15,000)
- The three questions in a row with score-color squares
- Share button → `lib/share.ts` generates and copies:

```
Airportism 2026-05-24
11,042 / 15,000

🟩🟧🟥

Play at airportism.com
```

Color scheme by score:
- 🟩 4000+ (very close)
- 🟨 2500–3999
- 🟧 1000–2499
- 🟥 250–999
- ⬛ <250

---

## 10. Pages

- `/` — Landing. Logo, tagline ("Where on Earth is that airport?"), single "Play Today's Round" CTA, link to How It Works.
- `/play` — The game.
- `/stats` — Personal stats from `/api/me/stats`.
- `/how-it-works` — Scoring explanation, tier explanation, "no accounts, no tracking, just a UUID in your browser" privacy note.

Styling: dark theme, navy/black background (matches Esri satellite imagery seamlessly), white text, accent orange for the IATA code and CTAs. Use the Geist font (already available in Next.js).

---

## 11. Build sequence

Build in this order. Don't skip ahead.

1. **Project init.** `pnpm create next-app@latest airportism --typescript --tailwind --app --no-src-dir`. Set up Drizzle, Postgres connection, environment variables (`DATABASE_URL`).
2. **Schema + migrations.** Write `lib/db/schema.ts`. Run `pnpm drizzle-kit push`. Verify tables exist.
3. **Ingestion.** Download CSV, write and run `ingest-airports.ts`. Verify ~500–700 US airports in DB.
4. **Tiering.** Create `data/tier1.json` and `data/tier2.json` from the seed lists in this doc. Write and run `tier-airports.ts`. Verify tier counts: T1 ~40, T2 ~60, T3 ~400+.
5. **Round generation.** Write and run `generate-rounds.ts` for 90 days. Spot check that no IATA appears more than once across the horizon.
6. **Scoring lib + unit tests.** Verify haversine against known distances (JFK↔LAX ≈ 3974 km, JFK↔BOS ≈ 305 km).
7. **API: `/round/today` and `/guess`.** Build and test with `curl`. Make sure `/round/today` never includes coordinates.
8. **Globe component.** Standalone test page first — render the globe, accept a click, drop a draggable pin.
9. **Game shell wiring.** Hook globe to API. Play through one full round in dev.
10. **Result + summary components.** Including share string generation.
11. **`/complete` and stats APIs.**
12. **Pages: landing, stats, how-it-works.**
13. **Polish:** mobile layout, animations, loading states, error states (especially "you already played today").
14. **Anti-cheat:** rate limit, flagged-result handling (adds `flagged` boolean to `daily_results`).
15. **Deploy to Vercel.** Set `DATABASE_URL` env. Set up daily cron only if you add features that need it (v1 doesn't — round selection is precomputed).

---

## 12. Environment variables

```
DATABASE_URL=postgres://...
NEXT_PUBLIC_SITE_URL=https://airportism.com
```

For step 14 (rate limiting):

```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

(Or Vercel KV equivalents.) No third-party API keys needed for tiles — Esri World Imagery requires no key; attribution is sufficient.

---

## 13. Out of scope for v1

Do not build any of these. They're noted so they don't sneak in:

- User accounts with email/password/OAuth
- Cross-device sync
- Cross-player leaderboard (removed from v1 — personal stats only)
- Friend groups or private leaderboards
- Hints of any kind (no flags, no country reveals, no skips)
- ICAO codes (IATA only)
- Multiple difficulty modes — the round is fixed at progressive (T1/T2/T3)
- Non-US airports — v1 is US-only
- Endless / practice mode
- Past-day replay
- Pro tier or payments
- Push notifications

If a UX gap suggests one of these, flag it in a TODO comment instead of building it.

---

## 14. Open decisions to confirm before launch

Surface these to the owner before going live:

- Domain name (currently assumed `airportism.com`)
- Exact wording of tagline and share string
- Tier 1 / Tier 2 IATA seed lists (the lists in this doc are a starting point — review before locking in)
- Whether to add Plausible/Umami analytics (privacy-friendly, no cookie banner needed)
- When to expand round generation beyond 90 days, and whether to expand the airport pool (e.g., Canada, then global) at the same time

---

## 15. Definition of done

- Production deploy on Vercel with custom domain
- A player can open the site on mobile or desktop, play three questions, see their score, and copy a share string
- All API endpoints return correctly typed JSON
- No coordinate data leaks from `/round/today`
- Rate limiting is active on `/guess`
- 90 days of `daily_rounds` are in the database
- `pnpm build` produces no TypeScript errors or warnings
- Lighthouse mobile performance score ≥ 85
