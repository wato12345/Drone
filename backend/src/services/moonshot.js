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
    const raw =
      typeof data?.error?.message === 'string'
        ? data.error.message
        : typeof data?.error === 'string'
          ? data.error
          : `Moonshot request failed (${response.status})`
    console.error('Moonshot request failed:', response.status, raw)
    const err = new Error(readableMoonshotError(raw, response.status))
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

export function readableMoonshotError(message, status) {
  const raw = typeof message === 'string' ? message : ''
  const wait = raw.match(/try again after\s*(\d+)\s*seconds?/i)
  const retry = wait ? `请 ${wait[1]} 秒后再试` : '请稍后再试'

  const rpm = raw.match(/max RPM:\s*(\d+)/i)
  if (/max RPM/i.test(raw)) {
    const limit = rpm ? `每分钟最多 ${rpm[1]} 次` : '已达到每分钟请求上限'
    return `请求过于频繁：${limit}，${retry}。`
  }

  const tpm = raw.match(/max TPM:\s*(\d+)/i)
  if (/max TPM/i.test(raw)) {
    const limit = tpm ? `每分钟 token 上限 ${tpm[1]}` : '已达到每分钟 token 上限'
    return `请求过于频繁：${limit}，${retry}。`
  }

  if (status === 429) return `请求过于频繁，${retry}。`
  if (status === 401 || /invalid api key|incorrect api key|authentication/i.test(raw)) {
    return '模型服务鉴权失败，请检查 API Key。'
  }
  if (status === 402 || /insufficient balance|exceeded your current quota/i.test(raw)) {
    return '模型服务额度不足，请检查账户余额。'
  }

  const cleaned = raw
    .replace(/org-[a-z0-9]+/gi, '')
    .replace(/<?(?:ak|sk)-[a-z0-9]+>?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .trim()
  return cleaned || `模型请求失败（${status}）`
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
