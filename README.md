# Airportism

A daily browser game. You get an airport code, you tap where it is on the globe. Three questions, same three for everyone.

🌍 [airportism.com](https://airportism.com)

## How it works

Each day at 00:00 UTC-5, a new round of three IATA airport codes goes live. Questions progress easy → medium → hard, drawn from US airports only in v1. You tap once on the satellite globe to place your guess, and your score for each question falls off exponentially with distance from the real airport. Max 5,000 points per question, 15,000 per round.

There are no hints, no skips, and one guess per question.

## Stack

- **Next.js 15** (App Router) + TypeScript + React 19
- **MapLibre GL JS** v5 with globe projection
- **Esri World Imagery** satellite tiles
- **Postgres** + **Drizzle** ORM
- **Tailwind CSS**
- **Vercel** for hosting

No accounts. Players are identified by an anonymous UUID stored in `localStorage`.

## Getting started

Requirements: Node 20+, pnpm, and a Postgres database (local via Docker, or Neon/Supabase for hosted).

```bash
git clone https://github.com/yourname/airportism
cd airportism
pnpm install
cp .env.example .env.local   # then fill in DATABASE_URL
pnpm drizzle-kit push        # create tables
```

### Seed the airport data

Download the OurAirports CSV into `data/airports.csv`:

```bash
curl -o data/airports.csv https://davidmegginson.github.io/ourairports-data/airports.csv
```

Then run the data pipeline in order:

```bash
pnpm tsx scripts/ingest-airports.ts    # ~500–700 US airports → DB
pnpm tsx scripts/tier-airports.ts      # assign tiers 1–3
pnpm tsx scripts/generate-rounds.ts    # precompute 90 days of puzzles
```

### Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project layout

```
app/             Next.js routes (pages + API)
components/      Globe, GameShell, Question, ResultCard, RoundSummary
lib/
  db/            Drizzle schema and client
  scoring.ts     Haversine + score formula
  player.ts      Anonymous UUID handling
  share.ts       Emoji grid generator
scripts/         Data ingestion, tiering, and round generation
data/            airports.csv + tier seed lists
drizzle/         Migrations
```

## Scoring

```
score = round(5000 * exp(-distance_km / 750))
```

| Distance | Score |
|----------|-------|
| 0 km     | 5000  |
| 50 km    | 4677  |
| 250 km   | 3589  |
| 500 km   | 2566  |
| 1000 km  | 1316  |
| 2000 km  | 346   |
| 5000 km  | 6     |

## API

All endpoints expect an `X-Player-Id` header containing the anonymous UUID.

| Method | Path                          | Purpose                                 |
|--------|-------------------------------|-----------------------------------------|
| GET    | `/api/round/today`            | Today's three IATA codes (no coords)    |
| POST   | `/api/round/today/guess`      | Submit a guess, get score + reveal      |
| POST   | `/api/round/today/complete`   | Finalize round, get total score         |
| GET    | `/api/me/stats`               | Streak, average score, distribution     |

Coordinates are never returned by `/round/today` — they're only revealed in response to a submitted guess.

## Environment variables

```
DATABASE_URL=postgres://...
NEXT_PUBLIC_SITE_URL=https://airportism.com
```

## Privacy

No accounts, no email, no tracking pixels. The only identifier is a UUID generated client-side and stored in your browser's `localStorage`. Clear your browser data and you're a new player.

## Attribution

Satellite imagery © Esri — World Imagery.
Airport data © [OurAirports](https://ourairports.com) (CC0).

## License

MIT
