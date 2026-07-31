import { pointInPolygon, pointToPolygonDistanceMeters } from '../utils/polygon.js'

const BASE_CRUISE_M = 50

function ringBBox(ring) {
  let minLng = Infinity
  let maxLng = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity

  for (const [lng, lat] of ring) {
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  }

  return { minLng, maxLng, minLat, maxLat }
}

function clearanceViolationCostFromDist(distM, clearanceM, criticalM) {
  const comfortableM = clearanceM + criticalM
  if (distM >= comfortableM) return 0
  if (distM >= clearanceM) {
    const tightMargin = comfortableM - distM
    return tightMargin * tightMargin * 2
  }
  const deficit = clearanceM - distM
  return deficit * deficit * 12 + deficit * 40
}

export class BuildingIndex {
  constructor(buildings, bbox, cellSizeDeg = 0.00028) {
    this.clearanceM = 15
    this.criticalM = 5
    this.cellSize = cellSizeDeg
    this.originLng = bbox.minLng
    this.originLat = bbox.minLat
    this.faces = buildings.map((building, id) => {
      const ring = building.geometry.coordinates[0]
      return {
        id,
        ring,
        height: building.properties.height,
        bbox: ringBBox(ring),
      }
    })
    this.cells = new Map()
    this._buildGrid(bbox)
  }

  _cellKey(col, row) {
    return `${col},${row}`
  }

  _cellCoords(lng, lat) {
    const col = Math.floor((lng - this.originLng) / this.cellSize)
    const row = Math.floor((lat - this.originLat) / this.cellSize)
    return { col, row }
  }

  _addFaceToCell(col, row, faceId) {
    const key = this._cellKey(col, row)
    if (!this.cells.has(key)) this.cells.set(key, new Set())
    this.cells.get(key).add(faceId)
  }

  _buildGrid(bbox) {
    for (const face of this.faces) {
      const minCol = Math.floor((face.bbox.minLng - this.originLng) / this.cellSize)
      const maxCol = Math.floor((face.bbox.maxLng - this.originLng) / this.cellSize)
      const minRow = Math.floor((face.bbox.minLat - this.originLat) / this.cellSize)
      const maxRow = Math.floor((face.bbox.maxLat - this.originLat) / this.cellSize)

      for (let col = minCol; col <= maxCol; col++) {
        for (let row = minRow; row <= maxRow; row++) {
          this._addFaceToCell(col, row, face.id)
        }
      }
    }

    void bbox
  }

  _candidateFaces(lng, lat) {
    const { col, row } = this._cellCoords(lng, lat)
    const seen = new Set()
    const result = []

    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        const ids = this.cells.get(this._cellKey(col + dc, row + dr))
        if (!ids) continue
        for (const id of ids) {
          if (seen.has(id)) continue
          seen.add(id)
          result.push(this.faces[id])
        }
      }
    }

    return result
  }

  /** 以建筑面为单位评估该点的水平距离、所需越障高度与代价 */
  evaluatePoint(lng, lat, clearanceM = this.clearanceM, criticalM = this.criticalM) {
    const candidates = this._candidateFaces(lng, lat)
    if (candidates.length === 0) {
      return {
        minDistM: Infinity,
        requiredAltM: BASE_CRUISE_M,
        coveringFaceIds: [],
        violationCost: 0,
      }
    }

    let minDistM = Infinity
    let requiredAltM = BASE_CRUISE_M
    const coveringFaceIds = []

    for (const face of candidates) {
      const insideFace = pointInPolygon([lng, lat], face.ring)
      const distM = insideFace ? 0 : pointToPolygonDistanceMeters([lng, lat], face.ring)
      minDistM = Math.min(minDistM, distM)

      if (insideFace || distM <= clearanceM) {
        requiredAltM = Math.max(requiredAltM, face.height + clearanceM)
        coveringFaceIds.push(face.id)
      }
    }

    return {
      minDistM,
      requiredAltM,
      coveringFaceIds,
      violationCost: clearanceViolationCostFromDist(minDistM, clearanceM, criticalM),
    }
  }

  evaluatePointAtAlt(lng, lat, altM, clearanceM = this.clearanceM, criticalM = this.criticalM) {
    const profile = this.evaluatePoint(lng, lat, clearanceM, criticalM)
    if (profile.requiredAltM > BASE_CRUISE_M && altM >= profile.requiredAltM) {
      return 0
    }
    return profile.violationCost
  }

  classifyPoint(lng, lat, altM, clearanceM = this.clearanceM, criticalM = this.criticalM) {
    const profile = this.evaluatePoint(lng, lat, clearanceM, criticalM)

    if (profile.requiredAltM > BASE_CRUISE_M && altM >= profile.requiredAltM) {
      return 'safe'
    }

    if (profile.minDistM < clearanceM) return 'violation'
    return 'safe'
  }

  buildNodeProfiles(nodes, clearanceM, altMToLayer) {
    return nodes.map((node) => {
      const profile = this.evaluatePoint(node.lng, node.lat, clearanceM, this.criticalM)
      return {
        minDistM: profile.minDistM,
        requiredAltM: profile.requiredAltM,
        minLayer: altMToLayer(profile.requiredAltM),
        violationCost: profile.violationCost,
        coveringFaces: profile.coveringFaceIds.length,
      }
    })
  }

  /** 批量评估路径点（复用空间索引，避免重复查询） */
  evaluatePathPoints(coordinates, clearanceM = this.clearanceM, criticalM = this.criticalM) {
    return coordinates.map(([lng, lat]) => this.evaluatePoint(lng, lat, clearanceM, criticalM))
  }

  classifyPathPoints(coordinates, altitudes, clearanceM = this.clearanceM, criticalM = this.criticalM) {
    return coordinates.map(([lng, lat], index) => {
      const profile = this.evaluatePoint(lng, lat, clearanceM, criticalM)
      const altM = altitudes[index] ?? BASE_CRUISE_M
      if (profile.requiredAltM > BASE_CRUISE_M && altM >= profile.requiredAltM) return 'safe'
      if (profile.minDistM < clearanceM) return 'violation'
      return 'safe'
    })
  }
}
