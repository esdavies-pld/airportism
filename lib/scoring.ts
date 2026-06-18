const EARTH_MI = 3959;
const SCALE_MI = 750;
const MAX_SCORE = 5000;

type Coord = { lat: number; lon: number };

export function haversineMiles(a: Coord, b: Coord): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_MI * Math.asin(Math.sqrt(h));
}

export function scoreForDistance(distanceMiles: number): number {
  return Math.round(MAX_SCORE * Math.exp(-distanceMiles / SCALE_MI));
}
