import { fetchBuildingsForRoute } from './buildings.js'
import { bboxFromPoints, haversineKm, pathLengthKm } from '../utils/geo.js'
import { pointToPolygonDistanceMeters } from '../utils/polygon.js'

const GRID_SIZE_DEFAULT = 24
const GRID_SIZE_AVOID = 36

export const DEFAULT_START = [121.4998, 31.2397]
export const DEFAULT_END = [121.5085, 31.2452]
export const DEFAULT_CLEARANCE_M = 15
export const CRITICAL_CLEARANCE_M = 5

function buildGrid(start, end, rows, cols) {
  const bbox = bboxFromPoints([start, end], 0.003)
  const nodes = []

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const tRow = row / (rows - 1)
      const tCol = col / (cols - 1)
      nodes.push({
        row,
        col,
        lng: bbox.minLng + (bbox.maxLng - bbox.minLng) * tCol,
        lat: bbox.minLat + (bbox.maxLat - bbox.minLat) * tRow,
      })
    }
  }

  return nodes
}

function nodeIndex(row, col, cols) {
  return row * cols + col
}

function nearestNodeIndex(nodes, point) {
  let best = 0
  let bestDist = Infinity
  nodes.forEach((node, index) => {
    const dist = haversineKm([node.lng, node.lat], point)
    if (dist < bestDist) {
      bestDist = dist
      best = index
    }
  })
  return best
}

function minBuildingDistanceMeters(lng, lat, buildings) {
  if (buildings.length === 0) return Infinity
  let minDist = Infinity
  for (const building of buildings) {
    const ring = building.geometry.coordinates[0]
    minDist = Math.min(minDist, pointToPolygonDistanceMeters([lng, lat], ring))
  }
  return minDist
}

function clearanceViolationCost(lng, lat, buildings, clearanceM) {
  const distM = minBuildingDistanceMeters(lng, lat, buildings)
  const comfortableM = clearanceM + CRITICAL_CLEARANCE_M

  if (distM >= comfortableM) return 0

  if (distM >= clearanceM) {
    const tightMargin = comfortableM - distM
    return tightMargin * tightMargin * 2
  }

  const deficit = clearanceM - distM
  return deficit * deficit * 12 + deficit * 40
}

function classifyClearance(distM, clearanceM) {
  if (distM < clearanceM) return 'violation'
  if (distM < clearanceM + CRITICAL_CLEARANCE_M) return 'critical'
  return 'safe'
}

function buildColoredSegments(coordinates, buildings, clearanceM) {
  if (coordinates.length === 0) return []
  if (buildings.length === 0) {
    return [{ status: 'safe', coordinates }]
  }

  const segments = []
  let currentStatus = classifyClearance(
    minBuildingDistanceMeters(coordinates[0][0], coordinates[0][1], buildings),
    clearanceM,
  )
  let currentCoords = [coordinates[0]]

  for (let i = 1; i < coordinates.length; i++) {
    const coord = coordinates[i]
    const status = classifyClearance(
      minBuildingDistanceMeters(coord[0], coord[1], buildings),
      clearanceM,
    )

    if (status === currentStatus) {
      currentCoords.push(coord)
      continue
    }

    currentCoords.push(coord)
    segments.push({ status: currentStatus, coordinates: [...currentCoords] })
    currentStatus = status
    currentCoords = [coordinates[i - 1], coord]
  }

  if (currentCoords.length >= 1) {
    segments.push({ status: currentStatus, coordinates: currentCoords })
  }

  return segments.filter((segment) => segment.coordinates.length >= 2)
}

function buildingPenalty(lng, lat, buildings, clearanceM) {
  return clearanceViolationCost(lng, lat, buildings, clearanceM)
}

function noiseIndex(lng, lat) {
  const residential = Math.abs(Math.sin(lng * 180) * Math.cos(lat * 160))
  const commercial = Math.abs(Math.cos(lng * 120) * Math.sin(lat * 140))
  return residential * 0.4 + commercial * 0.6
}

function windResistance(lng, lat) {
  const windFromEast = Math.max(0, Math.sin((lng - 121.48) * 90))
  const gust = Math.abs(Math.sin(lat * 200))
  return windFromEast * 0.7 + gust * 0.3
}

function nodeCost(node, buildings, weights, clearanceM) {
  return (
    weights.distance * 1 +
    weights.building * buildingPenalty(node.lng, node.lat, buildings, clearanceM) +
    weights.noise * noiseIndex(node.lng, node.lat) * 3 +
    weights.wind * windResistance(node.lng, node.lat) * 2.5
  )
}

function heuristic(a, b) {
  return haversineKm([a.lng, a.lat], [b.lng, b.lat]) * 1000
}

function astar(nodes, startIdx, endIdx, buildings, weights, clearanceM, gridSize) {
  const cols = gridSize
  const rows = gridSize
  const openSet = new Set([startIdx])
  const cameFrom = new Map()
  const gScore = new Map()
  const fScore = new Map()

  for (const node of nodes) {
    gScore.set(nodeIndex(node.row, node.col, cols), Infinity)
    fScore.set(nodeIndex(node.row, node.col, cols), Infinity)
  }

  gScore.set(startIdx, 0)
  fScore.set(startIdx, heuristic(nodes[startIdx], nodes[endIdx]))

  while (openSet.size > 0) {
    let current = -1
    let lowestF = Infinity
    for (const idx of openSet) {
      const score = fScore.get(idx) ?? Infinity
      if (score < lowestF) {
        lowestF = score
        current = idx
      }
    }

    if (current === endIdx) {
      const path = [current]
      while (cameFrom.has(path[0])) {
        path.unshift(cameFrom.get(path[0]))
      }
      return path
    }

    openSet.delete(current)
    const { row, col } = nodes[current]

    const neighbors = [
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1],
      [row - 1, col - 1],
      [row - 1, col + 1],
      [row + 1, col - 1],
      [row + 1, col + 1],
    ]

    for (const [nRow, nCol] of neighbors) {
      if (nRow < 0 || nCol < 0 || nRow >= rows || nCol >= cols) continue
      const neighborIdx = nodeIndex(nRow, nCol, cols)

      const moveCost = nRow !== row && nCol !== col ? 1.414 : 1
      const tentativeG =
        (gScore.get(current) ?? Infinity) +
        moveCost * nodeCost(nodes[neighborIdx], buildings, weights, clearanceM)

      if (tentativeG < (gScore.get(neighborIdx) ?? Infinity)) {
        cameFrom.set(neighborIdx, current)
        gScore.set(neighborIdx, tentativeG)
        fScore.set(neighborIdx, tentativeG + heuristic(nodes[neighborIdx], nodes[endIdx]))
        openSet.add(neighborIdx)
      }
    }
  }

  return [startIdx, endIdx]
}

function smoothPath(coords) {
  if (coords.length <= 2) return coords
  const smoothed = [coords[0]]
  for (let i = 1; i < coords.length - 1; i++) {
    if (i % 2 === 0) smoothed.push(coords[i])
  }
  smoothed.push(coords[coords.length - 1])
  return smoothed
}

function computeAltitudes(coords, buildings, optimized, clearanceM) {
  return coords.map(([lng, lat], index) => {
    const base = optimized ? 85 : 55
    const peak = optimized ? 130 : 75
    const t = index / Math.max(coords.length - 1, 1)
    const arc = Math.sin(t * Math.PI) * (peak - base)
    let buildingBoost = 0

    for (const building of buildings) {
      const ring = building.geometry.coordinates[0]
      const distM = pointToPolygonDistanceMeters([lng, lat], ring)
      if (distM < clearanceM * 3) {
        buildingBoost = Math.max(buildingBoost, building.properties.height + clearanceM)
      }
    }

    return Math.round(base + arc + (optimized ? buildingBoost * 0.45 : buildingBoost * 0.2))
  })
}

function computeMetrics(coords, altitudes, buildings, optimized, clearanceM) {
  const distanceKm = pathLengthKm(coords)
  const avgAltitudeM = altitudes.reduce((sum, value) => sum + value, 0) / altitudes.length

  let noiseSum = 0
  let windSum = 0
  let buildingSum = 0
  coords.forEach(([lng, lat]) => {
    noiseSum += noiseIndex(lng, lat)
    windSum += windResistance(lng, lat)
    buildingSum += buildingPenalty(lng, lat, buildings, clearanceM)
  })
  const avgNoise = noiseSum / coords.length
  const avgWind = windSum / coords.length
  const avgBuilding = buildingSum / coords.length

  const noiseLevel = avgNoise < 0.35 ? '低' : avgNoise < 0.65 ? '中' : '高'
  const cruiseSpeedKmh = optimized ? 42 : 48
  const estimatedTimeMin = (distanceKm / cruiseSpeedKmh) * 60

  return {
    distanceKm: Number(distanceKm.toFixed(2)),
    avgAltitudeM: Number(avgAltitudeM.toFixed(0)),
    noiseLevel,
    windResistance: Number((avgWind * 100).toFixed(0)),
    buildingAvoidance: Number((optimized ? avgBuilding * 12 : avgBuilding * 4).toFixed(0)),
    estimatedTimeMin: Number(estimatedTimeMin.toFixed(1)),
  }
}

function buildPathResult(id, label, color, coords, buildings, optimized, clearanceM) {
  const altitudes = computeAltitudes(coords, buildings, optimized, clearanceM)
  const buildingClearances = coords.map(([lng, lat]) =>
    Number(minBuildingDistanceMeters(lng, lat, buildings).toFixed(1)),
  )
  const segments = buildColoredSegments(coords, buildings, clearanceM)

  return {
    id,
    label,
    color,
    coordinates: coords,
    altitudes,
    buildingClearances,
    segments,
    metrics: computeMetrics(coords, altitudes, buildings, optimized, clearanceM),
  }
}

export async function planPaths(start, end, options = {}) {
  const avoidBuildings = options.avoidBuildings !== false
  const clearanceM = Number.isFinite(options.clearanceM) ? options.clearanceM : DEFAULT_CLEARANCE_M

  let buildings = []
  let buildingWarning = null
  if (avoidBuildings) {
    try {
      buildings = await fetchBuildingsForRoute(start, end)
    } catch (err) {
      buildingWarning =
        err instanceof Error ? err.message : '建筑数据获取失败，本次未启用建筑规避'
    }
  }

  const effectiveAvoidance = avoidBuildings && buildings.length > 0
  const gridSize = effectiveAvoidance ? GRID_SIZE_AVOID : GRID_SIZE_DEFAULT

  const nodes = buildGrid(start, end, gridSize, gridSize)
  const startIdx = nearestNodeIndex(nodes, start)
  const endIdx = nearestNodeIndex(nodes, end)

  const shortestIndices = astar(
    nodes,
    startIdx,
    endIdx,
    buildings,
    { distance: 1, building: effectiveAvoidance ? 1.5 : 0.05, noise: 0, wind: 0 },
    clearanceM,
    gridSize,
  )

  const optimizedIndices = astar(
    nodes,
    startIdx,
    endIdx,
    buildings,
    { distance: 0.45, building: effectiveAvoidance ? 4 : 1.2, noise: 0.8, wind: 0.6 },
    clearanceM,
    gridSize,
  )

  const shortestCoords = smoothPath(
    shortestIndices.map((idx) => [nodes[idx].lng, nodes[idx].lat]),
  )
  const optimizedCoords = smoothPath(
    optimizedIndices.map((idx) => [nodes[idx].lng, nodes[idx].lat]),
  )

  shortestCoords[0] = start
  shortestCoords[shortestCoords.length - 1] = end
  optimizedCoords[0] = start
  optimizedCoords[optimizedCoords.length - 1] = end

  return {
    buildings: effectiveAvoidance ? buildings : [],
    buildingCount: buildings.length,
    buildingWarning,
    clearanceM,
    avoidBuildings: effectiveAvoidance,
    paths: [
      buildPathResult('shortest', '最短路径', '#38bdf8', shortestCoords, buildings, false, clearanceM),
      buildPathResult('optimized', '智能优化路径', '#34d399', optimizedCoords, buildings, true, clearanceM),
    ],
  }
}

function isValidLngLat(value) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  )
}

export function validatePlanInput(body) {
  const start = body?.start
  const end = body?.end
  if (!isValidLngLat(start) || !isValidLngLat(end)) {
    return '请提供有效的 start 与 end 坐标 [lng, lat]'
  }

  if (body?.clearanceM !== undefined) {
    const clearanceM = Number(body.clearanceM)
    if (!Number.isFinite(clearanceM) || clearanceM < 5 || clearanceM > 100) {
      return '建筑净空距离需在 5–100 米之间'
    }
  }

  return null
}

export function parsePlanOptions(body) {
  return {
    avoidBuildings: body?.avoidBuildings !== false,
    clearanceM: body?.clearanceM !== undefined ? Number(body.clearanceM) : DEFAULT_CLEARANCE_M,
  }
}
