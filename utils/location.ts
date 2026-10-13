export type LatLng = { latitude: number; longitude: number };

// Haversine distance in meters
export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371e3; // meters
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const clamped = Math.max(0, Math.min(1, h));
  const c = 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
  return R * c;
}

export function isInsideRadius(current: LatLng, center: LatLng, radiusMeters: number): boolean {
  if (![current, center].every(p => Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180) || !Number.isFinite(radiusMeters) || radiusMeters <= 0) return false;
  return haversineDistance(current, center) <= radiusMeters;
}
