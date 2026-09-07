import { Router } from 'express'
import { getMoonshotConfig } from '../services/moonshot.js'
import { runAirspaceAgent } from '../services/airspaceAgent.js'

function parseLocation(body = {}) {
  const lat = body.lat !== undefined ? Number(body.lat) : Number(body.latitude)
  const lng = body.lng !== undefined ? Number(body.lng) : Number(body.longitude)
  const placeName = typeof body.placeName === 'string' ? body.placeName.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const forceAirspace = body.forceAirspace === true

  return { lat, lng, placeName, message, forceAirspace }
}

function validateLocation({ lat, lng, placeName, message }) {
  const hasCoord = Number.isFinite(lat) && Number.isFinite(lng)
  if (hasCoord && (lat < -90 || lat > 90 || lng < -180 || lng > 180)) {
    return 'Coordinates are out of valid range'
  }
  if (!hasCoord && !placeName && !message) {
    return 'Please provide coordinates, a place name, or a message'
  }
  return null
}

export function createAgentRouter() {
  const router = Router()

  router.get('/status', (_req, res) => {
    const config = getMoonshotConfig()
    res.json({
      configured: config.configured,
      model: config.model,
      apiBase: config.apiBase,
    })
  })

  /**
   * POST /api/agent/airspace
   * body: { lat?, lng?, placeName?, message?, forceAirspace? }
   */
  router.post('/airspace', async (req, res) => {
    const config = getMoonshotConfig()
    if (!config.configured) {
      return res.status(503).json({ error: 'Airspace agent is not configured: MOONSHOT_API_KEY missing' })
    }

    const input = parseLocation(req.body)
    const validationError = validateLocation(input)
    if (validationError) {
      return res.status(400).json({ error: validationError })
    }

    try {
      const result = await runAirspaceAgent(input)
      res.json({
        ok: true,
        ...result,
        location: {
          lat: Number.isFinite(input.lat) ? input.lat : null,
          lng: Number.isFinite(input.lng) ? input.lng : null,
          placeName: input.placeName || null,
        },
      })
    } catch (err) {
      console.error('Airspace agent error:', err)
      const status = Number.isFinite(err?.status) ? err.status : 502
      res.status(status >= 400 && status < 600 ? status : 502).json({
        error: err instanceof Error ? err.message : 'Airspace agent request failed',
      })
    }
  })

  return router
}
