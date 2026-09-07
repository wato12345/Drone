import { bboxFromPoints } from '../utils/geo.js'

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
]

const CACHE = new Map()
const CACHE_TTL_MS = 5 * 60 * 1000
const REQUEST_TIMEOUT_MS = 90_000

function parseHeight(tags = {}) {
  if (tags.height) {
    const match = String(tags.height).match(/[\d.]+/)
    if (match) return Number(match[0])
  }
  if (tags['building:levels']) {
    const levels = Number(tags['building:levels'])
    if (Number.isFinite(levels)) return levels * 3
  }
  return 24
}

function wayToBuildingFeature(way) {
  if (!Array.isArray(way.geometry) || way.geometry.length < 3) return null

  const coords = way.geometry.map((point) => [point.lon, point.lat])
  const first = coords[0]
  const last = coords[coords.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push([...first])
  }

  const tags = way.tags ?? {}
  return {
    type: 'Feature',
    properties: {
      height: parseHeight(tags),
      name: tags.name || tags['addr:street'] || 'Building',
    },
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  }
}

function buildOverpassQuery(bbox) {
  return `[out:json][timeout:90];way["building"](${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng});out geom;`
}

async function fetchOverpassJson(query) {
  let lastError = new Error('Failed to fetch building data')

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'DronePathPlanner/1.0',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      })

      if (!response.ok) {
        lastError = new Error(`Overpass response error (${response.status})`)
        continue
      }

      const data = await response.json()
      if (!Array.isArray(data.elements)) {
        lastError = new Error(typeof data.remark === 'string' ? data.remark : 'Invalid building data format')
        continue
      }

      return data
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new Error('Building data request timed out; please try again later')
      } else if (err instanceof Error) {
        lastError = err
      }
      console.warn(`[buildings] ${endpoint} failed:`, lastError.message)
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError
}

export async function fetchBuildingsForRoute(start, end, padding = 0.003) {
  const bbox = bboxFromPoints([start, end], padding)
  const cacheKey = [
    bbox.minLat.toFixed(4),
    bbox.minLng.toFixed(4),
    bbox.maxLat.toFixed(4),
    bbox.maxLng.toFixed(4),
  ].join(',')

  const cached = CACHE.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.buildings
  }

  const data = await fetchOverpassJson(buildOverpassQuery(bbox))
  const buildings = data.elements
    .filter((element) => element.type === 'way')
    .map(wayToBuildingFeature)
    .filter(Boolean)

  CACHE.set(cacheKey, { at: Date.now(), buildings })
  return buildings
}
