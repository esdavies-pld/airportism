# CLAUDE.md

Conventions and working agreements for this repo. Read this first.

## Project context

Airportism is a daily web game. Player sees an IATA airport code, taps where it is on a satellite globe, scores by great-circle distance. Three questions per day (easy, medium, hard) drawn from US airports only in v1, same for every player, daily round resets at 00:00 UTC-5.

The full product spec lives in `AIRPORTISM_HANDOFF.md`. Read it before making non-trivial changes. If something in this file conflicts with the handoff doc, the handoff doc wins.

## Tech stack

- Next.js 16 (App Router) + TypeScript + React 19
- MapLibre GL JS v5 with globe projection
- Esri World Imagery raster tiles
- Postgres + Drizzle ORM
- Tailwind CSS
- pnpm (do not use npm or yarn)
- Vercel for hosting

## Working agreements

### Before declaring a task done

Run all three, in order, and fix anything they report:

```bash
pnpm typecheck
pnpm lint
pnpm build
```

A green `pnpm dev` is not sufficient. `pnpm build` catches issues that dev mode hides (especially around React Server Components and dynamic imports).

### Database changes

Never edit migration files in `drizzle/` by hand. Modify `lib/db/schema.ts`, then run:

```bash
pnpm drizzle-kit generate    # creates a new migration file
pnpm drizzle-kit push        # applies to the configured DATABASE_URL
```

When adding columns to existing tables in production, make them nullable or default-valued. We don't have downtime budget for table rewrites.

### API endpoints

All API routes live under `app/api/`. Conventions:

- Authenticate every request via the `X-Player-Id` header. If missing, return 400. Use the helper in `lib/player.ts` (server side) to look up or create the `players` row.
- Validate request bodies with Zod. Define the schema next to the route in a `schema.ts` file.
- Return errors as `{ error: string, code: string }` with appropriate status codes. Never return stack traces.
- **Critical:** `/api/round/today` must never include airport coordinates in its response. Coordinates are only revealed in the response to `POST /api/round/today/guess`. If you find yourself joining `airports` to the round payload, stop and re-read the handoff doc.

### Frontend conventions

- Server Components by default. Add `"use client"` only when you need state, effects, or browser APIs.
- The Globe component is a client component (MapLibre needs `window`). Lazy-load it with `next/dynamic` and `ssr: false`.
- Game state lives in `components/GameShell.tsx` and persists to `sessionStorage` keyed by the current play date. A mid-round refresh should not lose progress.
- Tailwind only. No CSS modules, no styled-components, no inline `style={}` except for dynamic values that Tailwind can't express (e.g. animated counters).

### Anonymous identity

Players are identified by a UUID in `localStorage` under the key `apg.playerId`. The server creates a `players` row on first sighting. **Do not** add email, password, OAuth, or any cross-device sync — this is an explicit product decision, not a v2 backlog item.

If a feature seems to require accounts, push back before building it.

### Scoring

The scoring formula lives in `lib/scoring.ts` and is:

```
score = round(5000 * exp(-distance_km / 750))
```

Do not modify `SCALE_KM` (currently 750) or `MAX_SCORE` (5000) without flagging it — those values shape the entire leaderboard distribution and changing them invalidates historical comparisons.

Scoring happens **server-side only**. The client never computes a score for display before the server returns it. If you need to show a "calculating..." state, use a loading spinner.

### Data scripts

The three scripts in `scripts/` must run in order: `ingest-airports.ts` → `tier-airports.ts` → `generate-rounds.ts`. Each is idempotent (uses upserts), so re-running is safe.

If you change tier assignments after rounds have been generated, the existing `daily_rounds` rows are not retroactively updated — that's intentional. Re-run `generate-rounds.ts` for future dates only.

## Things to flag before doing

Stop and ask before:

- Adding any new third-party dependency. We're keeping the bundle lean.
- Adding any analytics or tracking script.
- Changing the database schema in a non-backward-compatible way.
- Changing the scoring formula.
- Changing the daily round structure (3 questions: one each from tiers 1/2/3).
- Expanding the airport pool beyond US in v1.
- Adding any feature listed under "Out of scope for v1" in `AIRPORTISM_HANDOFF.md` — accounts, hints, ICAO support, endless mode, past-day replay, payments, push notifications, cross-player leaderboards.

## File and naming conventions

- React components: `PascalCase.tsx`, one component per file, default export.
- Hooks: `useThing.ts`, named export.
- Library modules: `kebab-case.ts` or single-word, named exports.
- Database tables: `snake_case` in SQL, `camelCase` in Drizzle schema.
- API routes: lowercase, hyphenated where multi-word (`how-it-works`, not `howItWorks`).
- Scripts: `verb-noun.ts` (`ingest-airports`, `generate-rounds`).

## Testing

We don't have a heavy test suite. What we do have:

- Unit tests for `lib/scoring.ts` — distance and score values are easy to regression-test against known pairs (JFK↔LAX ≈ 3974 km, JFK↔BOS ≈ 300 km).
- Integration tests for the API endpoints using `vitest` and a test database. Run with `pnpm test`.
- No component or E2E tests in v1.

When adding logic to `lib/`, add a unit test. When adding an API endpoint, add an integration test that covers happy path + the most likely failure case.

## Commit and PR style

- Conventional commit prefixes: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`.
- One logical change per commit. Squash before merging if the branch got messy.
- PR descriptions should explain *why*, not just *what*. The diff already shows what.

## When in doubt

- Read `AIRPORTISM_HANDOFF.md`.
- If the handoff doc doesn't cover it, prefer the simpler option and leave a `TODO(owner)` comment with the trade-off you considered.
- Don't silently expand scope. Ship the smallest thing that works.

## Behavioral Guidelines

1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.

2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.