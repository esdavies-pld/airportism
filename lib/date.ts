// Daily round resets at 00:00 UTC-5 per handoff §1, so the canonical
// play date is the calendar date in the UTC-5 fixed-offset frame.
const UTC_OFFSET_HOURS = -5;

export function currentPlayDate(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + UTC_OFFSET_HOURS * 3600 * 1000);
  return shifted.toISOString().slice(0, 10);
}
