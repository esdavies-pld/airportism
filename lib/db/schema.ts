import {
  pgTable,
  char,
  text,
  doublePrecision,
  smallint,
  boolean,
  uuid,
  integer,
  timestamp,
  date,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';

export const airports = pgTable(
  'airports',
  {
    iata: char('iata', { length: 3 }).primaryKey(),
    icao: char('icao', { length: 4 }),
    name: text('name').notNull(),
    city: text('city'),
    country: text('country').notNull(),
    countryIso: char('country_iso', { length: 2 }).notNull(),
    lat: doublePrecision('lat').notNull(),
    lon: doublePrecision('lon').notNull(),
    tier: smallint('tier').notNull(),
    enabled: boolean('enabled').notNull().default(true),
  },
  (t) => [index('airports_tier_idx').on(t.tier)],
);

export const dailyRounds = pgTable('daily_rounds', {
  playDate: date('play_date').primaryKey(),
  airports: text('airports').array().notNull(),
});

export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const guesses = pgTable(
  'guesses',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id),
    playDate: date('play_date').notNull(),
    questionIndex: smallint('question_index').notNull(),
    iata: char('iata', { length: 3 }).notNull(),
    lat: doublePrecision('lat').notNull(),
    lon: doublePrecision('lon').notNull(),
    distanceMi: doublePrecision('distance_mi').notNull(),
    score: integer('score').notNull(),
    elapsedMs: integer('elapsed_ms').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.playDate, t.questionIndex] })],
);

export const dailyResults = pgTable(
  'daily_results',
  {
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id),
    playDate: date('play_date').notNull(),
    totalScore: integer('total_score').notNull(),
    completedAt: timestamp('completed_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.playDate] })],
);
