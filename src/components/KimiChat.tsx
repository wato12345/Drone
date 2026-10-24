import { useEffect, useRef, useState, type FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import { streamAgentChat, fetchAgentHistory, saveAgentHistory, type AgentRouteResult, type StoredAgentMessage, type WorkflowNodeState } from '../api/agent'
import type { LngLat } from '../types'
import { useAuth } from '../context/AuthContext'
import { WorkflowTrace } from './WorkflowTrace'
import { readStoredWorkflow } from '../api/workflow'

const LEGACY_CHAT_STORAGE_KEY = 'drone-kimi-chat-v1'

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: '可以问风速、空域或航线。我会按需要调用工具：解析地名 → 天气 → 空域 → 规划。',
}

function readLegacyMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(LEGACY_CHAT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatMessage[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((message) => message?.id && message.id !== 'welcome' && message.text?.trim())
  } catch {
    return []
  }
}

function persistableMessages(messages: ChatMessage[]): StoredAgentMessage[] {
  return messages
    .filter((message) => message.id !== 'welcome')
    .map((message) => ({
      id: message.id,
      role: message.role,
      text: message.workflowStatus === 'running' && !message.text ? '（对话已中断）' : message.text,
      workflowStatus: message.workflowStatus === 'running' ? 'failed' : message.workflowStatus === 'succeeded' || message.workflowStatus === 'failed' ? message.workflowStatus : undefined,
      elapsedMs: message.elapsedMs,
      nodes: message.nodes?.map((node) => ({
        id: node.id,
        nodeType: node.nodeType,
        title: node.title,
        status: node.status === 'running' ? 'failed' : node.status,
        tool: node.tool,
        detail: node.detail,
        nodeElapsedMs: node.nodeElapsedMs,
        branches: node.branches?.map((branch) => ({
          id: branch.id,
          label: branch.label,
          terminal: branch.terminal,
        })),
        branch: node.branch,
      })),
    }))
}

interface KimiChatProps {
  start: LngLat
  end: LngLat
  startPlaceName?: string | null
  endPlaceName?: string | null
  onRoute?: (route: AgentRouteResult) => void
}

function latestPlannedRoute(steps: { tool: string; result: unknown }[] | undefined): AgentRouteResult | null {
  if (!steps?.length) return null
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i]
    if (step.tool !== 'plan_route' || !step.result || typeof step.result !== 'object') continue
    const result = step.result as AgentRouteResult
    if (Array.isArray(result.coordinates) && result.coordinates.length >= 2 && !result.error) {
      return result
    }
  }
  return null
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  nodes?: WorkflowNodeState[]
  workflowStatus?: 'running' | 'succeeded' | 'failed'
  elapsedMs?: number
}

export function KimiChat({ start, end, startPlaceName, endPlaceName, onRoute }: KimiChatProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const listRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef(messages)
  const routedRef = useRef<string | null>(null)
  const hydratedUserId = useRef<string | null>(null)

  messagesRef.current = messages

  useEffect(() => {
    const userId = user?.id ?? null
    if (!userId) {
      hydratedUserId.current = null
      setMessages([WELCOME_MESSAGE])
      return
    }

    let cancelled = false
    hydratedUserId.current = null
    void fetchAgentHistory()
      .then(async (remote) => {
        if (cancelled) return
        let next = remote
        if (next.length === 0) {
          const legacy = readLegacyMessages()
          if (legacy.length > 0) {
            next = persistableMessages(legacy)
            await saveAgentHistory(next)
            localStorage.removeItem(LEGACY_CHAT_STORAGE_KEY)
          }
        } else {
          localStorage.removeItem(LEGACY_CHAT_STORAGE_KEY)
        }
        if (cancelled) return
        hydratedUserId.current = userId
        setMessages(next.length > 0 ? [WELCOME_MESSAGE, ...(next as ChatMessage[])] : [WELCOME_MESSAGE])
      })
      .catch(() => {
        if (!cancelled) {
          hydratedUserId.current = userId
          setMessages([WELCOME_MESSAGE])
        }
      })

    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    const userId = user?.id
    if (!userId || hydratedUserId.current !== userId) return
    const handle = window.setTimeout(() => {
      void saveAgentHistory(persistableMessages(messagesRef.current)).catch((err) => {
        console.error('Save agent history failed', err)
      })
    }, 400)
    return () => window.clearTimeout(handle)
  }, [messages, user?.id])

  useEffect(() => {
    if (!open) return
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, open, sending])

  const patchAssistant = (id: string, updater: (message: ChatMessage) => ChatMessage) => {
    setMessages((prev) => prev.map((message) => (message.id === id ? updater(message) : message)))
  }

  const sendMessage = async (raw: string) => {
    const message = raw.trim()
    if (!message || sending) return

    const assistantId = `a-${Date.now()}`
    routedRef.current = null
    const history = messagesRef.current
      .filter(
        (item) =>
          item.id !== 'welcome' &&
          item.text.trim() &&
          item.workflowStatus !== 'running',
      )
      .slice(-12)
      .map((item) => ({ role: item.role, content: item.text }))
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: message },
      { id: assistantId, role: 'assistant', text: '', nodes: [], workflowStatus: 'running' },
    ])
    setInput('')
    setSending(true)

    try {
      const [startLng, startLat] = start
      const [endLng, endLat] = end
      await streamAgentChat(
        {
          message,
          startLng,
          startLat,
          startPlaceName: startPlaceName || undefined,
          endLng,
          endLat,
          endPlaceName: endPlaceName || undefined,
          history,
          workflow: readStoredWorkflow() ?? undefined,
        },
        (event) => {
          if (event.event === 'node_started' && event.id) {
            const node: WorkflowNodeState = {
              id: event.id,
              nodeType: event.nodeType || 'tool',
              title: event.title || event.id,
              status: 'running',
              tool: event.tool,
              branches: event.branches,
            }
            patchAssistant(assistantId, (current) => ({
              ...current,
              nodes: [...(current.nodes ?? []), node],
              workflowStatus: 'running',
              elapsedMs: event.elapsedMs,
            }))
          }

          if (event.event === 'node_finished' && event.id) {
            if (event.tool === 'plan_route' && event.result && routedRef.current !== event.id) {
              const route = event.result as AgentRouteResult
              if (Array.isArray(route.coordinates) && route.coordinates.length >= 2 && !route.error) {
                routedRef.current = event.id
                onRoute?.(route)
              }
            }
            patchAssistant(assistantId, (current) => ({
              ...current,
              elapsedMs: event.elapsedMs,
              nodes: (current.nodes ?? []).map((node) =>
                node.id === event.id
                  ? {
                      ...node,
                      status: event.status === 'failed' ? 'failed' : 'succeeded',
                      detail: event.detail,
                      nodeElapsedMs: event.nodeElapsedMs,
                      branches: event.branches ?? node.branches,
                      branch: event.branch,
                      result: event.result,
                    }
                  : node,
              ),
            }))
          }

          if (event.event === 'workflow_finished') {
            const route = latestPlannedRoute(event.steps)
            if (route && !routedRef.current) {
              routedRef.current = 'finished'
              onRoute?.(route)
            }
            patchAssistant(assistantId, (current) => ({
              ...current,
              text: event.reply || event.error || current.text || '无回复',
              workflowStatus: event.status === 'failed' || event.ok === false ? 'failed' : 'succeeded',
              elapsedMs: event.elapsedMs ?? current.elapsedMs,
            }))
          }
        },
      )
    } catch (err) {
      patchAssistant(assistantId, (current) => ({
        ...current,
        text: err instanceof Error ? err.message : 'Request failed. Please try again later.',
        workflowStatus: current.nodes?.length ? 'failed' : undefined,
      }))
    } finally {
      setSending(false)
    }
  }

  const send = async (event?: FormEvent) => {
    event?.preventDefault()
    await sendMessage(input)
  }

  return (
    <div className={`kimi-chat ${open ? 'open' : ''}`}>
      {open && (
        <div className="kimi-panel" role="dialog" aria-label="Kimi Assistant">
          <div className="kimi-panel-header">
            <div>
              <strong>Kimi 助手</strong>
              <span>
                {user
                  ? `${startPlaceName || '起点'} → ${endPlaceName || '终点'}`
                  : '登录后对话会保存到账号'}
              </span>
            </div>
            <div className="kimi-panel-actions">
              <button
                type="button"
                className="kimi-clear"
                onClick={() => setMessages([WELCOME_MESSAGE])}
                disabled={sending}
              >
                清空
              </button>
              <button type="button" className="kimi-close" onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
          </div>

          <div className="kimi-messages" ref={listRef}>
            {messages.map((msg) => (
              <div key={msg.id} className={`kimi-bubble ${msg.role}`}>
                {msg.role === 'assistant' && msg.nodes && msg.workflowStatus && (
                  <WorkflowTrace nodes={msg.nodes} status={msg.workflowStatus} elapsedMs={msg.elapsedMs} />
                )}
                {msg.role === 'assistant' ? (
                  msg.text ? (
                    <div className="kimi-md">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  ) : null
                ) : (
                  <pre>{msg.text}</pre>
                )}
              </div>
            ))}
          </div>

          <div className="kimi-quick">
            <button type="button" disabled={sending} onClick={() => void sendMessage('现在风速怎么样？能不能飞？')}>
              风速
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => void sendMessage('规划一条避开高楼的航线到附近合适地点')}
            >
              航线
            </button>
          </div>

          <form className="kimi-input-row" onSubmit={send}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="问风速 / 空域 / 航线…"
              disabled={sending}
              maxLength={500}
            />
            <button type="submit" disabled={sending || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="kimi-fab"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? 'Close Kimi chat' : 'Open Kimi chat'}
      >
        {open ? 'Collapse' : 'Kimi'}
      </button>
    </div>
  )
}
