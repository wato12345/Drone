import type { BuildingFeature, LngLat, PathMetrics, PlannedPath } from '../types'
import { bboxFromPoints, haversineKm, pathLengthKm } from './geo'

const GRID_SIZE = 24

interface GridNode {
  row: number
  col: number
  lng: number
  lat: number
}

interface CostWeights {
  distance: number
  building: number
  noise: number
  wind: number
}

function buildGrid(
  start: LngLat,
  end: LngLat,
  rows = GRID_SIZE,
  cols = GRID_SIZE,
): GridNode[] {
  const bbox = bboxFromPoints([start, end], 0.003)
  const nodes: GridNode[] = []

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

function nodeIndex(row: number, col: number, cols = GRID_SIZE): number {
  return row * cols + col
}

function nearestNodeIndex(nodes: GridNode[], point: LngLat): number {
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

function buildingPenalty(lng: number, lat: number, buildings: BuildingFeature[]): number {
  let penalty = 0
  for (const building of buildings) {
    const ring = building.geometry.coordinates[0]
    const centerLng =
      ring.reduce((sum, coord) => sum + coord[0], 0) / ring.length
    const centerLat =
      ring.reduce((sum, coord) => sum + coord[1], 0) / ring.length
    const dist = haversineKm([lng, lat], [centerLng, centerLat])
    const heightFactor = building.properties.height / 120
    penalty += Math.max(0, (0.35 - dist) * 8 * heightFactor)
  }
  return penalty
}

function noiseIndex(lng: number, lat: number): number {
  const residential = Math.abs(Math.sin(lng * 180) * Math.cos(lat * 160))
  const commercial = Math.abs(Math.cos(lng * 120) * Math.sin(lat * 140))
  return residential * 0.4 + commercial * 0.6
}

function windResistance(lng: number, lat: number): number {
  const windFromEast = Math.max(0, Math.sin(lng * 90))
  const gust = Math.abs(Math.sin(lat * 200))
  return windFromEast * 0.7 + gust * 0.3
}

function nodeCost(
  node: GridNode,
  buildings: BuildingFeature[],
  weights: CostWeights,
): number {
  return (
    weights.distance * 1 +
    weights.building * buildingPenalty(node.lng, node.lat, buildings) +
    weights.noise * noiseIndex(node.lng, node.lat) * 3 +
    weights.wind * windResistance(node.lng, node.lat) * 2.5
  )
}

function heuristic(a: GridNode, b: GridNode): number {
  return haversineKm([a.lng, a.lat], [b.lng, b.lat]) * 1000
}

function astar(
  nodes: GridNode[],
  startIdx: number,
  endIdx: number,
  buildings: BuildingFeature[],
  weights: CostWeights,
): number[] {
  const cols = GRID_SIZE
  const rows = GRID_SIZE
  const openSet = new Set<number>([startIdx])
  const cameFrom = new Map<number, number>()
  const gScore = new Map<number, number>()
  const fScore = new Map<number, number>()

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
      const path: number[] = [current]
      while (cameFrom.has(path[0])) {
        path.unshift(cameFrom.get(path[0])!)
      }
      return path
    }

    openSet.delete(current)
    const { row, col } = nodes[current]

    const neighbors: [number, number][] = [
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
      const moveCost =
        nRow !== row && nCol !== col ? 1.414 : 1
      const tentativeG =
        (gScore.get(current) ?? Infinity) +
        moveCost * nodeCost(nodes[neighborIdx], buildings, weights)

      if (tentativeG < (gScore.get(neighborIdx) ?? Infinity)) {
        cameFrom.set(neighborIdx, current)
        gScore.set(neighborIdx, tentativeG)
        fScore.set(
          neighborIdx,
          tentativeG + heuristic(nodes[neighborIdx], nodes[endIdx]),
        )
        openSet.add(neighborIdx)
      }
    }
  }

  return [startIdx, endIdx]
}

function smoothPath(coords: LngLat[]): LngLat[] {
  if (coords.length <= 2) return coords
  const smoothed: LngLat[] = [coords[0]]
  for (let i = 1; i < coords.length - 1; i++) {
    if (i % 2 === 0) smoothed.push(coords[i])
  }
  smoothed.push(coords[coords.length - 1])
  return smoothed
}

function computeAltitudes(coords: LngLat[], buildings: BuildingFeature[], optimized: boolean): number[] {
  return coords.map(([lng, lat], index) => {
    const base = optimized ? 85 : 55
    const peak = optimized ? 130 : 75
    const t = index / Math.max(coords.length - 1, 1)
    const arc = Math.sin(t * Math.PI) * (peak - base)
    let buildingBoost = 0
    for (const building of buildings) {
      const ring = building.geometry.coordinates[0]
      const centerLng =
        ring.reduce((sum, coord) => sum + coord[0], 0) / ring.length
      const centerLat =
        ring.reduce((sum, coord) => sum + coord[1], 0) / ring.length
      const dist = haversineKm([lng, lat], [centerLng, centerLat])
      if (dist < 0.15) {
        buildingBoost = Math.max(buildingBoost, building.properties.height * 0.6 + 20)
      }
    }
    return Math.round(base + arc + (optimized ? buildingBoost : buildingBoost * 0.35))
  })
}

function computeMetrics(
  coords: LngLat[],
  altitudes: number[],
  buildings: BuildingFeature[],
  optimized: boolean,
): PathMetrics {
  const distanceKm = pathLengthKm(coords)
  const avgAltitudeM =
    altitudes.reduce((sum, value) => sum + value, 0) / altitudes.length

  let noiseSum = 0
  let windSum = 0
  let buildingSum = 0
  coords.forEach(([lng, lat]) => {
    noiseSum += noiseIndex(lng, lat)
    windSum += windResistance(lng, lat)
    buildingSum += buildingPenalty(lng, lat, buildings)
  })
  const avgNoise = noiseSum / coords.length
  const avgWind = windSum / coords.length
  const avgBuilding = buildingSum / coords.length

  const noiseLevel: PathMetrics['noiseLevel'] =
    avgNoise < 0.35 ? 'Low' : avgNoise < 0.65 ? 'Medium' : 'High'

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

export function planPaths(start: LngLat, end: LngLat): {
  paths: PlannedPath[]
} {
  const buildings: BuildingFeature[] = []
  const nodes = buildGrid(start, end)
  const startIdx = nearestNodeIndex(nodes, start)
  const endIdx = nearestNodeIndex(nodes, end)

  const shortestIndices = astar(nodes, startIdx, endIdx, buildings, {
    distance: 1,
    building: 0.05,
    noise: 0,
    wind: 0,
  })

  const optimizedIndices = astar(nodes, startIdx, endIdx, buildings, {
    distance: 0.55,
    building: 1.2,
    noise: 0.8,
    wind: 0.6,
  })

  const shortestCoords = smoothPath(
    shortestIndices.map((idx) => [nodes[idx].lng, nodes[idx].lat] as LngLat),
  )
  const optimizedCoords = smoothPath(
    optimizedIndices.map((idx) => [nodes[idx].lng, nodes[idx].lat] as LngLat),
  )

  shortestCoords[0] = start
  shortestCoords[shortestCoords.length - 1] = end
  optimizedCoords[0] = start
  optimizedCoords[optimizedCoords.length - 1] = end

  const shortestAltitudes = computeAltitudes(shortestCoords, buildings, false)
  const optimizedAltitudes = computeAltitudes(optimizedCoords, buildings, true)

  return {
    paths: [
      {
        id: 'shortest',
        label: 'Shortest path',
        color: '#38bdf8',
        coordinates: shortestCoords,
        altitudes: shortestAltitudes,
        metrics: computeMetrics(shortestCoords, shortestAltitudes, buildings, false),
      },
      {
        id: 'optimized',
        label: 'Optimized path',
        color: '#34d399',
        coordinates: optimizedCoords,
        altitudes: optimizedAltitudes,
        metrics: computeMetrics(optimizedCoords, optimizedAltitudes, buildings, true),
      },
    ],
  }
}

export const DEFAULT_START: LngLat = [-73.9855, 40.7484]
export const DEFAULT_END: LngLat = [-73.9772, 40.7527]
