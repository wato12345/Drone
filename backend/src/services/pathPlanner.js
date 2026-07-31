import { fetchBuildingsForRoute } from './buildings.js'
import { BuildingIndex } from './buildingIndex.js'
import { bboxFromPoints, haversineKm, pathLengthKm } from '../utils/geo.js'
import { MinHeap } from '../utils/minHeap.js'

const GRID_SIZE_DEFAULT = 24
const GRID_SIZE_AVOID = 28

const ALT_MIN_M = 40
const ALT_STEP_M = 18
const ALT_LAYERS = 10
const BASE_CRUISE_M = 50
const GROUND_ALT_M = 0
const MAX_DESCENT_PER_STEP_M = 25

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

  return { nodes, bbox }
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

function layerToAltM(layer) {
  return ALT_MIN_M + layer * ALT_STEP_M
}

function altMToLayer(altM) {
  return Math.max(0, Math.min(ALT_LAYERS - 1, Math.ceil((altM - ALT_MIN_M) / ALT_STEP_M)))
}

function encodeState(nodeIdx, layer) {
  return nodeIdx * ALT_LAYERS + layer
}

function decodeState(state) {
  return { nodeIdx: Math.floor(state / ALT_LAYERS), layer: state % ALT_LAYERS }
}

function heuristic3d(aNode, aLayer, bNode, bLayer) {
  const hDist = haversineKm([aNode.lng, aNode.lat], [bNode.lng, bNode.lat]) * 1000
  const vDist = Math.abs(layerToAltM(aLayer) - layerToAltM(bLayer))
  return Math.sqrt(hDist * hDist + vDist * vDist)
}

function heuristic(a, b) {
  return haversineKm([a.lng, a.lat], [b.lng, b.lat]) * 1000
}

function buildingCostAtAlt(profile, altM) {
  if (altM >= profile.requiredAltM) return 0
  return profile.violationCost
}

function astar3d(nodes, startIdx, endIdx, profiles, weights, gridSize) {
  const cols = gridSize
  const rows = gridSize
  const startLayer = profiles[startIdx].minLayer
  const endMinLayer = profiles[endIdx].minLayer
  const startState = encodeState(startIdx, startLayer)

  const openHeap = new MinHeap()
  openHeap.push(startState, heuristic3d(nodes[startIdx], startLayer, nodes[endIdx], endMinLayer))
  const openSet = new Set([startState])
  const cameFrom = new Map()
  const gScore = new Map([[startState, 0]])

  while (openHeap.size > 0) {
    const current = openHeap.pop()
    if (current === null || !openSet.has(current)) continue

    const { nodeIdx, layer } = decodeState(current)
    if (nodeIdx === endIdx && layer >= endMinLayer) {
      const path = [current]
      while (cameFrom.has(path[0])) {
        path.unshift(cameFrom.get(path[0]))
      }
      return path
    }

    openSet.delete(current)
    const node = nodes[nodeIdx]
    const minLayer = profiles[nodeIdx].minLayer
    const currentG = gScore.get(current) ?? Infinity

    const tryMove = (nextState, moveCost) => {
      const tentativeG = currentG + moveCost
      if (tentativeG < (gScore.get(nextState) ?? Infinity)) {
        cameFrom.set(nextState, current)
        gScore.set(nextState, tentativeG)
        const { nodeIdx: nIdx, layer: nLayer } = decodeState(nextState)
        const f = tentativeG + heuristic3d(nodes[nIdx], nLayer, nodes[endIdx], endMinLayer)
        openHeap.push(nextState, f)
        openSet.add(nextState)
      }
    }

    if (layer + 1 < ALT_LAYERS) {
      tryMove(encodeState(nodeIdx, layer + 1), weights.climb * ALT_STEP_M * 0.08)
    }
    if (layer - 1 >= minLayer) {
      tryMove(encodeState(nodeIdx, layer - 1), weights.climb * ALT_STEP_M * 0.03)
    }

    const { row, col } = node
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

    const altM = layerToAltM(layer)
    for (const [nRow, nCol] of neighbors) {
      if (nRow < 0 || nCol < 0 || nRow >= rows || nCol >= cols) continue
      const neighborIdx = nodeIndex(nRow, nCol, cols)
      if (layer < profiles[neighborIdx].minLayer) continue

      const moveCost =
        (nRow !== row && nCol !== col ? 1.414 : 1) * weights.distance +
        weights.building * buildingCostAtAlt(profiles[neighborIdx], altM) * 0.15

      tryMove(encodeState(neighborIdx, layer), moveCost)
    }
  }

  return [startState]
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

function nodeCost(profile, node, weights) {
  return (
    weights.distance * 1 +
    weights.building * profile.violationCost +
    weights.noise * noiseIndex(node.lng, node.lat) * 3 +
    weights.wind * windResistance(node.lng, node.lat) * 2.5
  )
}

function astar(nodes, startIdx, endIdx, profiles, weights, gridSize) {
  const cols = gridSize
  const rows = gridSize
  const openHeap = new MinHeap()
  openHeap.push(startIdx, heuristic(nodes[startIdx], nodes[endIdx]))
  const openSet = new Set([startIdx])
  const cameFrom = new Map()
  const gScore = new Map([[startIdx, 0]])

  while (openHeap.size > 0) {
    const current = openHeap.pop()
    if (current === null || !openSet.has(current)) continue

    if (current === endIdx) {
      const path = [current]
      while (cameFrom.has(path[0])) {
        path.unshift(cameFrom.get(path[0]))
      }
      return path
    }

    openSet.delete(current)
    const { row, col } = nodes[current]
    const currentG = gScore.get(current) ?? Infinity

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
      const tentativeG = currentG + moveCost * nodeCost(profiles[neighborIdx], nodes[neighborIdx], weights)

      if (tentativeG < (gScore.get(neighborIdx) ?? Infinity)) {
        cameFrom.set(neighborIdx, current)
        gScore.set(neighborIdx, tentativeG)
        const f = tentativeG + heuristic(nodes[neighborIdx], nodes[endIdx])
        openHeap.push(neighborIdx, f)
        openSet.add(neighborIdx)
      }
    }
  }

  return [startIdx, endIdx]
}

function statesToPath(states, nodes) {
  return states.map((state) => {
    const { nodeIdx, layer } = decodeState(state)
    return {
      coord: [nodes[nodeIdx].lng, nodes[nodeIdx].lat],
      altM: layerToAltM(layer),
    }
  })
}

function envelopeAltitudesWithProfiles(coords, profiles, seedAlts = []) {
  const alts = coords.map(([lng, lat], index) =>
    Math.max(seedAlts[index] ?? BASE_CRUISE_M, profiles[index]?.requiredAltM ?? BASE_CRUISE_M),
  )

  for (let i = 1; i < alts.length; i++) {
    alts[i] = Math.max(alts[i], alts[i - 1] - MAX_DESCENT_PER_STEP_M)
  }
  for (let i = alts.length - 2; i >= 0; i--) {
    alts[i] = Math.max(alts[i], alts[i + 1] - MAX_DESCENT_PER_STEP_M)
  }

  return alts.map((alt) => Math.round(alt))
}

/** Pin takeoff and landing altitudes to ground level. */
function applyGroundTerminals(altitudes) {
  if (!altitudes.length) return altitudes
  const alts = altitudes.map((alt) => Math.round(alt))
  alts[0] = GROUND_ALT_M
  alts[alts.length - 1] = GROUND_ALT_M
  return alts
}

function simplify3dPath(states, nodes, profiles) {
  const raw = statesToPath(states, nodes)
  if (raw.length <= 2) {
    const coords = raw.map((p) => p.coord)
    const altitudes = envelopeAltitudesWithProfiles(
      coords,
      coords.map((_, i) => profiles[nearestNodeIndex(nodes, coords[i])]),
      raw.map((p) => p.altM),
    )
    return { coords, altitudes }
  }

  const simplified = [raw[0]]
  for (let i = 1; i < raw.length - 1; i++) {
    const prev = simplified[simplified.length - 1]
    const curr = raw[i]
    const altDelta = Math.abs(curr.altM - prev.altM)
    const distKm = haversineKm(prev.coord, curr.coord)
    if (altDelta >= ALT_STEP_M * 0.5 || distKm > 0.015 || i % 2 === 0) {
      simplified.push(curr)
    }
  }
  simplified.push(raw[raw.length - 1])

  const coords = simplified.map((p) => p.coord)
  const nodeProfilesAlongPath = coords.map((coord) => {
    const idx = nearestNodeIndex(nodes, coord)
    return profiles[idx]
  })
  const altitudes = envelopeAltitudesWithProfiles(
    coords,
    nodeProfilesAlongPath,
    simplified.map((p) => p.altM),
  )

  return { coords, altitudes }
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

function computeAltitudes(coords, profiles, nodes, optimized) {
  return coords.map(([lng, lat], index) => {
    const base = optimized ? 85 : 55
    const peak = optimized ? 130 : 75
    const t = index / Math.max(coords.length - 1, 1)
    const arc = Math.sin(t * Math.PI) * (peak - base)
    const nodeIdx = nearestNodeIndex(nodes, [lng, lat])
    const required = profiles[nodeIdx]?.requiredAltM ?? BASE_CRUISE_M
    const buildingBoost = Math.max(0, required - BASE_CRUISE_M)
    return Math.round(base + arc + (optimized ? buildingBoost * 0.45 : buildingBoost * 0.2))
  })
}

function buildColoredSegmentsFromStatuses(coordinates, statuses) {
  if (coordinates.length === 0) return []
  const segments = []
  let currentStatus = statuses[0]
  let currentCoords = [coordinates[0]]

  for (let i = 1; i < coordinates.length; i++) {
    const coord = coordinates[i]
    const status = statuses[i]

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

function statusFromProfile(profile, altM, clearanceM, criticalM) {
  if (profile.requiredAltM > BASE_CRUISE_M && altM >= profile.requiredAltM) return 'safe'
  if (profile.minDistM < clearanceM) return 'violation'
  if (profile.minDistM < clearanceM + criticalM) return 'critical'
  return 'safe'
}

function pathLength3DKm(coords, altitudes) {
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    const horizontalM = haversineKm(coords[i - 1], coords[i]) * 1000
    const verticalM = altitudes[i] - altitudes[i - 1]
    total += Math.sqrt(horizontalM * horizontalM + verticalM * verticalM)
  }
  return total / 1000
}

function computeTotalClimbM(altitudes) {
  let climb = 0
  for (let i = 1; i < altitudes.length; i++) {
    const delta = altitudes[i] - altitudes[i - 1]
    if (delta > 0) climb += delta
  }
  return Math.round(climb)
}

function computeMetrics(coords, altitudes, pathProfiles, optimized, clearanceM, is3D = false) {
  const distanceKm = is3D ? pathLength3DKm(coords, altitudes) : pathLengthKm(coords)
  const avgAltitudeM = altitudes.reduce((sum, value) => sum + value, 0) / altitudes.length
  const maxAltitudeM = Math.max(...altitudes)
  const totalClimbM = computeTotalClimbM(altitudes)

  let noiseSum = 0
  let windSum = 0
  let buildingSum = 0

  coords.forEach(([lng, lat], index) => {
    noiseSum += noiseIndex(lng, lat)
    windSum += windResistance(lng, lat)
    const profile = pathProfiles?.[index]
    if (
      profile &&
      statusFromProfile(profile, altitudes[index], clearanceM, CRITICAL_CLEARANCE_M) === 'violation'
    ) {
      buildingSum += 1
    }
  })

  const violationRatio = buildingSum / coords.length
  const noiseLevel = noiseSum / coords.length < 0.35 ? '低' : noiseSum / coords.length < 0.65 ? '中' : '高'
  const cruiseSpeedKmh = optimized ? 42 : 48

  return {
    distanceKm: Number(distanceKm.toFixed(2)),
    avgAltitudeM: Number(avgAltitudeM.toFixed(0)),
    maxAltitudeM: Number(maxAltitudeM.toFixed(0)),
    totalClimbM,
    is3D,
    noiseLevel,
    windResistance: Number(((windSum / coords.length) * 100).toFixed(0)),
    buildingAvoidance: Number(((optimized ? 1 - violationRatio : 1 - violationRatio * 0.8) * 100).toFixed(0)),
    estimatedTimeMin: Number(((distanceKm / cruiseSpeedKmh) * 60).toFixed(1)),
  }
}

function buildPathResult(
  id,
  label,
  color,
  coords,
  altitudes,
  buildingIndex,
  optimized,
  clearanceM,
  is3D = false,
) {
  const pathProfiles = buildingIndex
    ? buildingIndex.evaluatePathPoints(coords, clearanceM, CRITICAL_CLEARANCE_M)
    : null
  const buildingClearances = pathProfiles
    ? pathProfiles.map((profile) => Number(profile.minDistM.toFixed(1)))
    : coords.map(() => Infinity)
  const statuses = pathProfiles
    ? pathProfiles.map((profile, index) =>
        statusFromProfile(profile, altitudes[index] ?? BASE_CRUISE_M, clearanceM, CRITICAL_CLEARANCE_M),
      )
    : coords.map(() => 'safe')

  return {
    id,
    label,
    color,
    coordinates: coords,
    coordinates3d: coords.map(([lng, lat], index) => [lng, lat, altitudes[index]]),
    altitudes,
    buildingClearances,
    segments: buildingIndex
      ? buildColoredSegmentsFromStatuses(coords, statuses)
      : [{ status: 'safe', coordinates: coords }],
    is3D,
    metrics: computeMetrics(coords, altitudes, pathProfiles, optimized, clearanceM, is3D),
  }
}

function planHorizontalPath(nodes, profiles, startIdx, endIdx, weights, gridSize, optimized) {
  const indices = astar(nodes, startIdx, endIdx, profiles, weights, gridSize)
  const coords = smoothPath(indices.map((idx) => [nodes[idx].lng, nodes[idx].lat]))
  const altitudes = computeAltitudes(coords, profiles, nodes, optimized)
  return { coords, altitudes, is3D: false }
}

function planVerticalAwarePath(nodes, profiles, startIdx, endIdx, weights, gridSize) {
  const states = astar3d(nodes, startIdx, endIdx, profiles, weights, gridSize)
  return { ...simplify3dPath(states, nodes, profiles), is3D: true }
}

function emptyProfiles(nodes) {
  return nodes.map(() => ({
    minDistM: Infinity,
    requiredAltM: BASE_CRUISE_M,
    minLayer: altMToLayer(BASE_CRUISE_M),
    violationCost: 0,
    coveringFaces: 0,
  }))
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
  const { nodes, bbox } = buildGrid(start, end, gridSize, gridSize)
  const startIdx = nearestNodeIndex(nodes, start)
  const endIdx = nearestNodeIndex(nodes, end)

  const buildingIndex = effectiveAvoidance ? new BuildingIndex(buildings, bbox) : null
  if (buildingIndex) {
    buildingIndex.clearanceM = clearanceM
    buildingIndex.criticalM = CRITICAL_CLEARANCE_M
  }

  const profiles = buildingIndex
    ? buildingIndex.buildNodeProfiles(nodes, clearanceM, altMToLayer)
    : emptyProfiles(nodes)

  // Always search in 3D with layered A* so altitude is planned, not only drawn.
  const shortestPlan = planVerticalAwarePath(
    nodes,
    profiles,
    startIdx,
    endIdx,
    {
      distance: 1,
      building: effectiveAvoidance ? 0.3 : 0.05,
      climb: 0.75,
    },
    gridSize,
  )

  const optimizedPlan = planVerticalAwarePath(
    nodes,
    profiles,
    startIdx,
    endIdx,
    {
      distance: 0.55,
      building: effectiveAvoidance ? 0.25 : 0.15,
      climb: 1.15,
    },
    gridSize,
  )

  shortestPlan.coords[0] = start
  shortestPlan.coords[shortestPlan.coords.length - 1] = end
  optimizedPlan.coords[0] = start
  optimizedPlan.coords[optimizedPlan.coords.length - 1] = end

  // Takeoff/landing at ground level (0 m), with gradual climb and descent.
  shortestPlan.altitudes = applyGroundTerminals(shortestPlan.altitudes)
  optimizedPlan.altitudes = applyGroundTerminals(optimizedPlan.altitudes)

  return {
    buildings: effectiveAvoidance ? buildings : [],
    buildingCount: buildings.length,
    buildingWarning,
    clearanceM,
    avoidBuildings: effectiveAvoidance,
    paths: [
      buildPathResult(
        'shortest',
        '最短路径（3D A*）',
        '#38bdf8',
        shortestPlan.coords,
        shortestPlan.altitudes,
        buildingIndex,
        false,
        clearanceM,
        true,
      ),
      buildPathResult(
        'optimized',
        '智能优化路径（3D A*）',
        '#34d399',
        optimizedPlan.coords,
        optimizedPlan.altitudes,
        buildingIndex,
        true,
        clearanceM,
        true,
      ),
    ],
  }
}

export function validatePlanInput(body) {
  const start = body?.start
  const end = body?.end
  if (
    !Array.isArray(start) ||
    !Array.isArray(end) ||
    start.length !== 2 ||
    end.length !== 2 ||
    !Number.isFinite(start[0]) ||
    !Number.isFinite(start[1]) ||
    !Number.isFinite(end[0]) ||
    !Number.isFinite(end[1])
  ) {
    return '请提供有效的 start 与 end 坐标 [lng, lat]'
  }

  if (body?.clearanceM !== undefined) {
    const value = Number(body.clearanceM)
    if (!Number.isFinite(value) || value < 5 || value > 100) {
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
