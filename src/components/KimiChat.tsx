import { useEffect, useRef, useState, type FormEvent } from 'react'
import { queryAgentChat } from '../api/agent'
import type { LngLat } from '../types'

interface KimiChatProps {
  location: LngLat
  placeName?: string | null
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

export function KimiChat({ location, placeName }: KimiChatProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: '可以问风速、空域或航线。我会按需要调用工具：解析地名 → 天气 → 空域 → 规划。',
    },
  ])
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, open, sending])

  const sendMessage = async (raw: string) => {
    const message = raw.trim()
    if (!message || sending) return

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: message,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setSending(true)

    try {
      const [lng, lat] = location
      const result = await queryAgentChat({
        lat,
        lng,
        placeName: placeName || undefined,
        message,
      })

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: result.reply || result.error || '无回复',
        },
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          text: err instanceof Error ? err.message : 'Request failed. Please try again later.',
        },
      ])
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
              <span>{placeName || 'Near current start point'}</span>
            </div>
            <button type="button" className="kimi-close" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </div>

          <div className="kimi-messages" ref={listRef}>
            {messages.map((msg) => (
              <div key={msg.id} className={`kimi-bubble ${msg.role}`}>
                <pre>{msg.text}</pre>
              </div>
            ))}
            {sending && (
              <div className="kimi-bubble assistant kimi-typing">Thinking…</div>
            )}
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
