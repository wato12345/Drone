import { Router } from 'express'
import { formatPlaceNameFromPhoton } from '../utils/geocode.js'

const PHOTON_REVERSE = 'https://photon.komoot.io/reverse'

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

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'DronePathPlanner/1.0',
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
      })

      if (!response.ok) {
        return res.status(502).json({ error: 'Place lookup failed' })
      }

      const data = await response.json()
      const name = formatPlaceNameFromPhoton(data)
      const props = data?.features?.[0]?.properties ?? {}

      res.json({
        name,
        displayName: [props.name, props.street, props.locality || props.district, props.city, props.county, props.state, props.country]
          .filter(Boolean)
          .filter((part, index, arr) => part !== arr[index - 1])
          .join(', '),
      })
    } catch (err) {
      console.error('Geocode error:', err)
      res.status(500).json({ error: 'Place lookup failed' })
    }
  })

  return router
}
