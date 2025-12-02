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
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

export function isInsideRadius(current: LatLng, center: LatLng, radiusMeters: number): boolean {
  if (!isFinite(center.latitude) || !isFinite(center.longitude)) return false;
  return haversineDistance(current, center) <= radiusMeters;
}
