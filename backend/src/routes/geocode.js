import { Router } from 'express'
import { formatPlaceNameFromPhoton } from '../utils/geocode.js'

const PHOTON_REVERSE = 'https://photon.komoot.io/reverse'

export function createGeocodeRouter() {
  const router = Router()

  router.get('/reverse', async (req, res) => {
    const lat = Number(req.query.lat)
    const lng = Number(req.query.lng)

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: '请提供有效的 lat 与 lng' })
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: '坐标超出有效范围' })
    }

    try {
      const url = new URL(PHOTON_REVERSE)
      url.searchParams.set('lat', String(lat))
      url.searchParams.set('lon', String(lng))

      const response = await fetch(url, {
        headers: { 'User-Agent': 'DronePathPlanner/1.0' },
      })

      if (!response.ok) {
        return res.status(502).json({ error: '地名查询失败' })
      }

      const data = await response.json()
      const name = formatPlaceNameFromPhoton(data)
      const props = data?.features?.[0]?.properties ?? {}

      res.json({
        name,
        displayName: [props.name, props.locality, props.city, props.state, props.country]
          .filter(Boolean)
          .join(', '),
      })
    } catch (err) {
      console.error('Geocode error:', err)
      res.status(500).json({ error: '地名查询失败' })
    }
  })

  return router
}
