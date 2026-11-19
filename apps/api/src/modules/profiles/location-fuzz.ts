import { createHmac } from 'node:crypto';

/**
 * Konum gizliliği (trilateration koruması, bkz. 01-MIMARI §6):
 * 1) Koordinat ≈1,1 km'lik ızgaranın merkezine yuvarlanır.
 * 2) Kullanıcıya özgü, sabit ve gizli bir sapma (150–500 m) eklenir.
 * Sapma her güncellemede aynıdır; böylece tekrarlı ölçümle "ortalama alıp" gerçek konuma yaklaşılamaz.
 * Gerçek koordinat hiçbir yerde saklanmaz.
 */
const GRID_DEGREES = 0.01;
const METERS_PER_DEGREE_LAT = 111_320;
const MIN_OFFSET_M = 150;
const MAX_OFFSET_M = 500;

export type Coordinates = { latitude: number; longitude: number };

export function fuzzLocation(input: Coordinates, userSecret: Buffer, userId: string): Coordinates {
  const lat = clamp(input.latitude, -89.9, 89.9);
  const snappedLat = (Math.floor(lat / GRID_DEGREES) + 0.5) * GRID_DEGREES;
  // Boylam ızgarası ve sapma ham değerden değil, hücre merkezinden hesaplanır: aynı hücredeki her
  // girdi bit düzeyinde aynı çıktıyı verir (aksi halde küçük farklar gerçek konum hakkında bilgi sızdırır).
  const cosLat = Math.cos((snappedLat * Math.PI) / 180);
  const lngGrid = GRID_DEGREES / Math.max(cosLat, 0.01);

  const snappedLng = (Math.floor(input.longitude / lngGrid) + 0.5) * lngGrid;

  const digest = createHmac('sha256', userSecret).update(`location-offset:${userId}`).digest();
  const angle = (digest.readUInt32BE(0) / 0xffffffff) * 2 * Math.PI;
  const radius =
    MIN_OFFSET_M + (digest.readUInt32BE(4) / 0xffffffff) * (MAX_OFFSET_M - MIN_OFFSET_M);

  const latitude = clamp(
    snappedLat + (radius * Math.cos(angle)) / METERS_PER_DEGREE_LAT,
    -89.9,
    89.9,
  );
  const longitude = wrapLongitude(
    snappedLng + (radius * Math.sin(angle)) / (METERS_PER_DEGREE_LAT * Math.max(cosLat, 0.01)),
  );
  return { latitude, longitude };
}

/** İki nokta arası yaklaşık mesafe (metre, haversine). Testler ve keşfet etiketleri için. */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function wrapLongitude(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}
