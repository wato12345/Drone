import { Router } from 'express'
import {
  compareClickPreference,
  isActorId,
  isTrackEventKey,
  recordTrackEvent,
} from '../services/analytics.js'

export function createTrackRouter() {
  const router = Router()

  /**
   * POST /api/track
   * body: { event: "site.page.module.position", actorId }
   */
  router.post('/', async (req, res) => {
    const event = typeof req.body?.event === 'string' ? req.body.event.trim() : ''
    const actorId = typeof req.body?.actorId === 'string' ? req.body.actorId.trim() : ''

    if (!isTrackEventKey(event)) {
      return res.status(400).json({ error: 'event must be site.page.module.position' })
    }
    if (!isActorId(actorId)) {
      return res.status(400).json({ error: 'actorId is invalid' })
    }

    try {
      await recordTrackEvent(event, actorId)
      res.status(202).json({ ok: true, event })
    } catch (err) {
      console.error('Track event error:', err)
      res.status(500).json({ error: 'Failed to record event' })
    }
  })

  /**
   * GET /api/track/preference?showEvent=a.b.c.show-layer&hideEvent=a.b.c.hide-layer
   */
  router.get('/preference', async (req, res) => {
    const showEvent = typeof req.query.showEvent === 'string' ? req.query.showEvent.trim() : ''
    const hideEvent = typeof req.query.hideEvent === 'string' ? req.query.hideEvent.trim() : ''

    if (!isTrackEventKey(showEvent) || !isTrackEventKey(hideEvent) || showEvent === hideEvent) {
      return res.status(400).json({ error: 'showEvent and hideEvent must be different a.b.c.d keys' })
    }

    try {
      const preference = await compareClickPreference(showEvent, hideEvent)
      res.json(preference)
    } catch (err) {
      console.error('Track preference error:', err)
      res.status(500).json({ error: 'Failed to read click preference' })
    }
  })

  return router
}
