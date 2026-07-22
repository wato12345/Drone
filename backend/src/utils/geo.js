const EARTH_RADIUS_KM = 6371

export function haversineKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

export function pathLengthKm(coords) {
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    total += haversineKm(coords[i - 1], coords[i])
  }
  return total
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

export function interpolateLngLat(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
}

export function bboxFromPoints(points, padding = 0.004) {
  const lngs = points.map((p) => p[0])
  const lats = points.map((p) => p[1])
  return {
    minLng: Math.min(...lngs) - padding,
    maxLng: Math.max(...lngs) + padding,
    minLat: Math.min(...lats) - padding,
    maxLat: Math.max(...lats) + padding,
  }
}
