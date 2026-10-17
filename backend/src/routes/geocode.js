import { Router } from 'express'
import {
  formatDisplayNameFromProps,
  formatPlaceNameFromPhoton,
  formatPlaceNameFromProps,
} from '../utils/geocode.js'

const PHOTON_REVERSE = 'https://photon.komoot.io/reverse'
const PHOTON_SEARCH = 'https://photon.komoot.io/api/'

async function fetchPhoton(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'DronePathPlanner/1.0',
      Accept: 'application/json',
      'Accept-Language': 'en',
    },
  })
  if (!response.ok) {
    throw new Error('Place lookup failed')
  }
  return response.json()
}

export function createGeocodeRouter() {
  const router = Router()

  router.get('/reverse', async (req, res) => {
    const lat = Number(req.query.lat)
    const lng = Number(req.query.lng)

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'Please provide valid lat and lng' })
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Coordinates are out of valid range' })
    }

    try {
      const url = new URL(PHOTON_REVERSE)
      url.searchParams.set('lat', String(lat))
      url.searchParams.set('lon', String(lng))
      url.searchParams.set('lang', 'en')

      const data = await fetchPhoton(url)
      const props = data?.features?.[0]?.properties ?? {}

      res.json({
        name: formatPlaceNameFromPhoton(data),
        displayName: formatDisplayNameFromProps(props),
      })
    } catch (err) {
      console.error('Geocode reverse error:', err)
      res.status(500).json({ error: 'Place lookup failed' })
    }
  })

  /**
   * GET /api/geocode/search?q=...
   * Forward geocode via Photon — never invents coordinates.
   */
  router.get('/search', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    if (!q) {
      return res.status(400).json({ error: 'Please provide a search query' })
    }

    try {
      const url = new URL(PHOTON_SEARCH)
      url.searchParams.set('q', q)
      url.searchParams.set('limit', '6')
      url.searchParams.set('lang', 'en')

      const data = await fetchPhoton(url)
      const results = (Array.isArray(data?.features) ? data.features : [])
        .map((feature) => {
          const coords = feature?.geometry?.coordinates
          if (!Array.isArray(coords) || coords.length < 2) return null
          const lng = Number(coords[0])
          const lat = Number(coords[1])
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
          if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null

          const props = feature.properties ?? {}
          return {
            name: formatPlaceNameFromProps(props),
            displayName: formatDisplayNameFromProps(props),
            lng,
            lat,
          }
        })
        .filter(Boolean)

      res.json({ results })
    } catch (err) {
      console.error('Geocode search error:', err)
      res.status(500).json({ error: 'Place search failed' })
    }
  })

  return router
}
