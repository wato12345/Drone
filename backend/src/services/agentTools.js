import { planPaths } from './pathPlanner.js'

const PHOTON_SEARCH = 'https://photon.komoot.io/api/'
const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'
const WIND_CAN_FLY_KMH = 40

/** Major airport / restricted centers used only by check_airspace (no weather). */
const RESTRICTED_ZONES = [
  { name: 'JFK', lng: -73.7781, lat: 40.6413, radiusKm: 8 },
  { name: 'LGA', lng: -73.874, lat: 40.7769, radiusKm: 6 },
  { name: 'EWR', lng: -74.1745, lat: 40.6895, radiusKm: 7 },
  { name: 'SFO', lng: -122.375, lat: 37.6189, radiusKm: 8 },
  { name: 'LAX', lng: -118.4081, lat: 33.9425, radiusKm: 8 },
  { name: 'DCA', lng: -77.0377, lat: 38.8512, radiusKm: 10 },
  { name: 'ORD', lng: -87.9073, lat: 41.9742, radiusKm: 8 },
  { name: 'SEA', lng: -122.3088, lat: 47.4502, radiusKm: 7 },
  { name: 'ATL', lng: -84.4277, lat: 33.6407, radiusKm: 8 },
  { name: 'DEN', lng: -104.6737, lat: 39.8561, radiusKm: 8 },
  { name: 'PVG', lng: 121.8058, lat: 31.1443, radiusKm: 10 },
  { name: 'SHA', lng: 121.3363, lat: 31.1979, radiusKm: 8 },
  { name: 'PEK', lng: 116.5846, lat: 40.0801, radiusKm: 12 },
]

function isValidCoord(lng, lat) {
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

function formatPhotonName(props) {
  if (!props) return null
  const parts = [
    props.name,
    props.street,
    props.locality || props.district || props.suburb,
    props.city || props.county || props.state,
    props.country,
  ].filter(Boolean)
  const unique = parts.filter((part, index) => part !== parts[index - 1])
  return unique.slice(0, 3).join(' · ') || null
}

/**
 * resolve_place(name) → { ok, name, lng, lat } | { ok:false, error:"未知地点" }
 * Never invent coordinates.
 */
export async function resolvePlace(name) {
  const query = typeof name === 'string' ? name.trim() : ''
  if (!query) {
    return { ok: false, error: '未知地点' }
  }

  try {
    const url = new URL(PHOTON_SEARCH)
    url.searchParams.set('q', query)
    url.searchParams.set('limit', '1')
    url.searchParams.set('lang', 'en')

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DronePathPlanner/1.0',
        Accept: 'application/json',
      },
    })
    if (!response.ok) {
      return { ok: false, error: '未知地点' }
    }

    const data = await response.json()
    const feature = data?.features?.[0]
    const coords = feature?.geometry?.coordinates
    if (!Array.isArray(coords) || coords.length < 2) {
      return { ok: false, error: '未知地点' }
    }

    const lng = Number(coords[0])
    const lat = Number(coords[1])
    if (!isValidCoord(lng, lat)) {
      return { ok: false, error: '未知地点' }
    }

    const resolvedName = formatPhotonName(feature.properties) || query
    return { ok: true, name: resolvedName, lng, lat }
  } catch {
    return { ok: false, error: '未知地点' }
  }
}

/**
 * get_weather(lng, lat) → { windSpeed, canFly } | { error }
 * canFly when windSpeed < 40 km/h. At or above 40 km/h, cannot fly.
 */
export async function getWeather(lng, lat) {
  const lon = Number(lng)
  const latitude = Number(lat)
  if (!isValidCoord(lon, latitude)) {
    return { error: '坐标非法' }
  }

  try {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(lon),
      current: 'wind_speed_10m',
      timezone: 'auto',
    })
    const response = await fetch(`${OPEN_METEO}?${params}`)
    if (!response.ok) {
      return { error: '天气查询失败' }
    }
    const data = await response.json()
    const windSpeed = Number(data?.current?.wind_speed_10m)
    if (!Number.isFinite(windSpeed)) {
      return { error: '天气查询失败' }
    }
    return {
      windSpeed: Number(windSpeed.toFixed(1)),
      canFly: windSpeed < WIND_CAN_FLY_KMH,
    }
  } catch {
    return { error: '天气查询失败' }
  }
}

/**
 * check_airspace(startLng, startLat, endLng, endLat) → { closed }
 * Does not query weather.
 */
export async function checkAirspace(startLng, startLat, endLng, endLat) {
  const sLng = Number(startLng)
  const sLat = Number(startLat)
  const eLng = Number(endLng)
  const eLat = Number(endLat)

  if (!isValidCoord(sLng, sLat) || !isValidCoord(eLng, eLat)) {
    return { error: '坐标非法' }
  }

  const samples = [
    [sLng, sLat],
    [eLng, eLat],
    [(sLng + eLng) / 2, (sLat + eLat) / 2],
  ]

  for (const point of samples) {
    for (const zone of RESTRICTED_ZONES) {
      if (haversineKm(point, [zone.lng, zone.lat]) <= zone.radiusKm) {
        return { closed: true }
      }
    }
  }

  return { closed: false }
}

/**
 * plan_route(...) → { distance, time, coordinates } | { error }
 * When avoidBuildings is true, return only the building-avoiding path.
 */
export async function planRoute(startLng, startLat, endLng, endLat, avoidBuildings) {
  const sLng = Number(startLng)
  const sLat = Number(startLat)
  const eLng = Number(endLng)
  const eLat = Number(endLat)

  if (!isValidCoord(sLng, sLat) || !isValidCoord(eLng, eLat)) {
    return { error: '坐标非法' }
  }

  const avoid = avoidBuildings === true || avoidBuildings === 'true'

  try {
    const result = await planPaths([sLng, sLat], [eLng, eLat], {
      avoidBuildings: avoid,
    })
    const paths = Array.isArray(result?.paths) ? result.paths : []
    const path = avoid
      ? paths.find((p) => p.id === 'optimized') || paths[0]
      : paths.find((p) => p.id === 'shortest') || paths[0]

    if (!path?.coordinates?.length) {
      return { error: '航线规划失败' }
    }

    return {
      distance: path.metrics?.distanceKm ?? null,
      time: path.metrics?.estimatedTimeMin ?? null,
      coordinates: path.coordinates,
      altitudes: Array.isArray(path.altitudes) ? path.altitudes : [],
      avoidBuildings: avoid,
      metrics: path.metrics ?? null,
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : '航线规划失败' }
  }
}

export const AGENT_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'resolve_place',
      description:
        'Resolve a place name to coordinates. Returns { ok, name, lng, lat }. If unknown, returns { ok:false, error:"未知地点" }. Never invent coordinates.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Place name to resolve' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description:
        'Get wind speed (km/h) and canFly for a coordinate. canFly is true when windSpeed < 40. At or above 40 km/h, cannot fly. Invalid coords return { error }.',
      parameters: {
        type: 'object',
        properties: {
          lng: { type: 'number' },
          lat: { type: 'number' },
        },
        required: ['lng', 'lat'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_airspace',
      description:
        'Check whether airspace along a start→end route is closed. Returns { closed }. Does not check weather.',
      parameters: {
        type: 'object',
        properties: {
          startLng: { type: 'number' },
          startLat: { type: 'number' },
          endLng: { type: 'number' },
          endLat: { type: 'number' },
        },
        required: ['startLng', 'startLat', 'endLng', 'endLat'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'plan_route',
      description:
        'Plan a drone route. Returns { distance, time, coordinates }. When avoidBuildings is true, return only the building-avoiding path.',
      parameters: {
        type: 'object',
        properties: {
          startLng: { type: 'number' },
          startLat: { type: 'number' },
          endLng: { type: 'number' },
          endLat: { type: 'number' },
          avoidBuildings: { type: 'boolean' },
        },
        required: ['startLng', 'startLat', 'endLng', 'endLat', 'avoidBuildings'],
      },
    },
  },
]

export async function executeAgentTool(name, args = {}) {
  switch (name) {
    case 'resolve_place':
      return resolvePlace(args.name)
    case 'get_weather':
      return getWeather(args.lng, args.lat)
    case 'check_airspace':
      return checkAirspace(args.startLng, args.startLat, args.endLng, args.endLat)
    case 'plan_route':
      return planRoute(
        args.startLng,
        args.startLat,
        args.endLng,
        args.endLat,
        args.avoidBuildings,
      )
    default:
      return { error: `未知工具: ${name}` }
  }
}

export function extractToolError(result) {
  if (!result || typeof result !== 'object') return null
  if (typeof result.error === 'string' && result.error) return result.error
  if (result.ok === false && typeof result.error === 'string') return result.error
  return null
}
