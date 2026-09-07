import { Router } from 'express'
import {
  DEFAULT_END,
  DEFAULT_START,
  parsePlanOptions,
  planPaths,
  validatePlanInput,
} from '../services/pathPlanner.js'

export function createPlanRouter() {
  const router = Router()

  router.get('/defaults', (_req, res) => {
    res.json({ start: DEFAULT_START, end: DEFAULT_END })
  })

  router.post('/plan', async (req, res) => {
    const validationError = validatePlanInput(req.body)
    if (validationError) {
      return res.status(400).json({ error: validationError })
    }

    const options = parsePlanOptions(req.body)

    try {
      const result = await planPaths(req.body.start, req.body.end, options)
      res.json(result)
    } catch (err) {
      console.error('Plan error:', err)
      const message = err instanceof Error ? err.message : 'Path planning failed'
      const status = message.includes('Unable') || message.includes('no-fly') ? 422 : 500
      res.status(status).json({ error: message })
    }
  })

  return router
}
