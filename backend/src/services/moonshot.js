const MOONSHOT_API_BASE = process.env.MOONSHOT_API_BASE ?? 'https://api.moonshot.cn/v1'
const MOONSHOT_MODEL = process.env.MOONSHOT_MODEL ?? 'kimi-k2.6'

export function getMoonshotConfig() {
  const apiKey = process.env.MOONSHOT_API_KEY?.trim()
  return {
    apiKey,
    apiBase: MOONSHOT_API_BASE.replace(/\/$/, ''),
    model: MOONSHOT_MODEL,
    configured: Boolean(apiKey),
  }
}

/**
 * Call Moonshot OpenAI-compatible chat completions API.
 * Supports optional tools / tool_choice for agent loops.
 */
export async function moonshotChat({
  messages,
  temperature,
  responseFormat,
  tools,
  toolChoice,
}) {
  const { apiKey, apiBase, model, configured } = getMoonshotConfig()
  if (!configured) {
    throw new Error('MOONSHOT_API_KEY is not configured')
  }

  // kimi-k2.x currently only accepts temperature=1
  const resolvedTemperature =
    typeof temperature === 'number' && !/^kimi-k2/i.test(model) ? temperature : 1

  const body = {
    model,
    messages,
    temperature: resolvedTemperature,
  }

  if (responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' }
  }
  if (Array.isArray(tools) && tools.length > 0) {
    body.tools = tools
    body.tool_choice = toolChoice ?? 'auto'
  }

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      typeof data?.error?.message === 'string'
        ? data.error.message
        : typeof data?.error === 'string'
          ? data.error
          : `Moonshot request failed (${response.status})`
    const err = new Error(message)
    err.status = response.status
    throw err
  }

  const choice = data?.choices?.[0]
  const message = choice?.message
  if (!message) {
    throw new Error('Moonshot returned empty message')
  }

  const content = typeof message.content === 'string' ? message.content.trim() : ''
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : []

  return {
    content,
    message,
    toolCalls,
    finishReason: choice?.finish_reason ?? null,
    model: data?.model ?? model,
    usage: data?.usage ?? null,
  }
}

export function parseJsonContent(content) {
  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Failed to parse model JSON output')
    return JSON.parse(match[0])
  }
}
