import { Router } from 'express'
import { getMoonshotConfig } from '../services/moonshot.js'
import { runAirspaceAgent } from '../services/airspaceAgent.js'
import { runDroneAgent } from '../services/droneAgent.js'
import { normalizeWorkflow } from '../services/agentWorkflow.js'
import { authMiddleware, optionalAuth } from '../middleware/auth.js'
import { getAgentChat, getAgentWorkflow, saveAgentChat, saveAgentWorkflow } from '../db/index.js'

function parseLocation(body = {}) {
  const lat = body.startLat !== undefined
    ? Number(body.startLat)
    : body.lat !== undefined
      ? Number(body.lat)
      : Number(body.latitude)
  const lng = body.startLng !== undefined
    ? Number(body.startLng)
    : body.lng !== undefined
      ? Number(body.lng)
      : Number(body.longitude)
  const endLat = body.endLat !== undefined ? Number(body.endLat) : Number.NaN
  const endLng = body.endLng !== undefined ? Number(body.endLng) : Number.NaN
  const placeName =
    typeof body.startPlaceName === 'string'
      ? body.startPlaceName.trim()
      : typeof body.placeName === 'string'
        ? body.placeName.trim()
        : ''
  const endPlaceName = typeof body.endPlaceName === 'string' ? body.endPlaceName.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const forceAirspace = body.forceAirspace === true
  const history = Array.isArray(body.history) ? body.history : []

  return { lat, lng, endLat, endLng, placeName, endPlaceName, message, forceAirspace, history }
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

function sanitizeBranches(branches) {
  if (!Array.isArray(branches)) return undefined
  const clean = branches
    .slice(0, 8)
    .map((item) => {
      if (!item || typeof item.id !== 'string' || typeof item.label !== 'string') return null
      return {
        id: item.id.slice(0, 64),
        label: item.label.slice(0, 32),
        ...(item.terminal === true ? { terminal: true } : {}),
      }
    })
    .filter(Boolean)
  return clean.length ? clean : undefined
}

function sanitizeBranch(branch) {
  if (typeof branch === 'string' && branch) return branch.slice(0, 64)
  if (!Array.isArray(branch)) return undefined
  const ids = branch
    .filter((id) => typeof id === 'string' && id)
    .slice(0, 6)
    .map((id) => id.slice(0, 64))
  return ids.length ? ids : undefined
}

function sanitizeStoredMessages(messages) {
  if (!Array.isArray(messages)) return []
  return messages
    .filter(
      (message) =>
        message &&
        typeof message.id === 'string' &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.text === 'string',
    )
    .slice(-80)
    .map((message) => ({
      id: message.id.slice(0, 64),
      role: message.role,
      text: message.text.slice(0, 8000),
      workflowStatus:
        message.workflowStatus === 'succeeded' || message.workflowStatus === 'failed'
          ? message.workflowStatus
          : undefined,
      elapsedMs: Number.isFinite(Number(message.elapsedMs)) ? Number(message.elapsedMs) : undefined,
      nodes: Array.isArray(message.nodes)
        ? message.nodes.slice(0, 20).map((node) => ({
            id: typeof node?.id === 'string' ? node.id.slice(0, 64) : 'node',
            nodeType: typeof node?.nodeType === 'string' ? node.nodeType.slice(0, 32) : 'tool',
            title: typeof node?.title === 'string' ? node.title.slice(0, 64) : '节点',
            status: node?.status === 'failed' ? 'failed' : 'succeeded',
            tool: typeof node?.tool === 'string' ? node.tool.slice(0, 64) : undefined,
            detail: typeof node?.detail === 'string' ? node.detail.slice(0, 300) : undefined,
            nodeElapsedMs: Number.isFinite(Number(node?.nodeElapsedMs))
              ? Number(node.nodeElapsedMs)
              : undefined,
            branches: sanitizeBranches(node?.branches),
            branch: sanitizeBranch(node?.branch),
          }))
        : undefined,
    }))
}

async function resolveRequestWorkflow(req) {
  if (req.body?.workflow && typeof req.body.workflow === 'object') {
    return normalizeWorkflow(req.body.workflow)
  }
  if (req.user) {
    const saved = await getAgentWorkflow(req.user.id)
    if (saved) return normalizeWorkflow(saved)
  }
  return normalizeWorkflow(null)
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

  router.get('/workflow', optionalAuth, async (req, res) => {
    try {
      if (req.query.default === '1') {
        return res.json({ workflow: normalizeWorkflow(null), saved: false })
      }
      const saved = req.user ? await getAgentWorkflow(req.user.id) : null
      res.json({ workflow: normalizeWorkflow(saved), saved: Boolean(saved) })
    } catch (err) {
      console.error('Load workflow error:', err)
      res.status(500).json({ error: 'Failed to load workflow' })
    }
  })

  router.put('/workflow', authMiddleware, async (req, res) => {
    const workflow = normalizeWorkflow(req.body?.workflow ?? req.body)
    try {
      await saveAgentWorkflow(req.user.id, workflow)
      res.json({ workflow, saved: true })
    } catch (err) {
      console.error('Save workflow error:', err)
      res.status(500).json({ error: 'Failed to save workflow' })
    }
  })

  router.get('/history', authMiddleware, async (req, res) => {
    try {
      const messages = await getAgentChat(req.user.id)
      res.json({ messages })
    } catch (err) {
      console.error('Load agent chat error:', err)
      res.status(500).json({ error: 'Failed to load chat history' })
    }
  })

  router.put('/history', authMiddleware, async (req, res) => {
    const messages = sanitizeStoredMessages(req.body?.messages)
    try {
      await saveAgentChat(req.user.id, messages)
      res.json({ ok: true })
    } catch (err) {
      console.error('Save agent chat error:', err)
      res.status(500).json({ error: 'Failed to save chat history' })
    }
  })

  /**
   * POST /api/agent/chat/stream
   * Server-sent events: node_started, node_finished, workflow_finished
   */
  router.post('/chat/stream', authMiddleware, async (req, res) => {
    const config = getMoonshotConfig()
    if (!config.configured) {
      return res.status(503).json({ error: 'Agent is not configured: MOONSHOT_API_KEY missing' })
    }

    const input = parseLocation(req.body)
    if (!input.message) {
      return res.status(400).json({ error: 'Please provide a message' })
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    const write = (payload) => {
      if (res.writableEnded) return
      const { event, ...data } = payload
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    try {
      const workflow = await resolveRequestWorkflow(req)
      await runDroneAgent({ ...input, workflow, onEvent: write })
    } catch (err) {
      console.error('Drone agent stream error:', err)
    } finally {
      res.end()
    }
  })

  /**
   * POST /api/agent/chat
   * Tool-using drone agent: resolve_place / get_weather / check_airspace / plan_route
   * body: { message, lat?, lng?, placeName? }
   */
  router.post('/chat', authMiddleware, async (req, res) => {
    const config = getMoonshotConfig()
    if (!config.configured) {
      return res.status(503).json({ error: 'Agent is not configured: MOONSHOT_API_KEY missing' })
    }

    const input = parseLocation(req.body)
    if (!input.message) {
      return res.status(400).json({ error: 'Please provide a message' })
    }

    try {
      const workflow = await resolveRequestWorkflow(req)
      const result = await runDroneAgent({ ...input, workflow })
      res.json({
        ok: result.ok,
        reply: result.reply,
        error: result.error ?? null,
        steps: result.steps,
        model: result.model,
        usage: result.usage,
        truncated: result.truncated === true,
      })
    } catch (err) {
      console.error('Drone agent error:', err)
      const status = Number.isFinite(err?.status) ? err.status : 502
      res.status(status >= 400 && status < 600 ? status : 502).json({
        error: err instanceof Error ? err.message : 'Agent request failed',
      })
    }
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
