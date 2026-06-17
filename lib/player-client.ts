// Client-side anonymous identity (handoff §9). Server-side helpers
// (ensurePlayer, isValidPlayerId) live in lib/player.ts and stay
// out of the client bundle.

export function getPlayerId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem('apg.playerId');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('apg.playerId', id);
  }
  return id;
}
