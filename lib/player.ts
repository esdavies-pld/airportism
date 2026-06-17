import { getDb } from './db/client';
import { players } from './db/schema';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidPlayerId(id: string | null | undefined): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

export async function ensurePlayer(id: string): Promise<void> {
  const db = getDb();
  await db.insert(players).values({ id }).onConflictDoNothing();
}
