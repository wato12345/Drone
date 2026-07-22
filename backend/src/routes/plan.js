import { Router } from 'express'
import {
  DEFAULT_END,
  DEFAULT_START,
  parsePlanOptions,
  planPaths,
  validatePlanInput,
} from '../services/pathPlanner.js'

const PLAN_MIN_DURATION_MS = 800

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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

    const startedAt = Date.now()
    const options = parsePlanOptions(req.body)

    try {
      const result = await planPaths(req.body.start, req.body.end, options)
      const elapsed = Date.now() - startedAt
      if (elapsed < PLAN_MIN_DURATION_MS) {
        await delay(PLAN_MIN_DURATION_MS - elapsed)
      }
      res.json(result)
    } catch (err) {
      console.error('Plan error:', err)
      const message = err instanceof Error ? err.message : '路径规划失败'
      const status = message.includes('无法') || message.includes('禁飞') ? 422 : 500
      res.status(status).json({ error: message })
    }
  })

  return router
}
