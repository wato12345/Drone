import { useEffect, useRef, useState, type FormEvent } from 'react'
import { queryAirspaceAgent, type AirspaceResult } from '../api/agent'
import type { LngLat } from '../types'

interface KimiChatProps {
  location: LngLat
  placeName?: string | null
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  airspace?: AirspaceResult | null
}

function formatAirspace(airspace: AirspaceResult): string {
  const canFly =
    airspace.canFlyLabel ||
    (airspace.canFly === true ? 'Can fly' : airspace.canFly === false ? 'Cannot fly' : 'Uncertain')
  const docs =
    airspace.documents?.filter(Boolean).slice(0, 4) ??
    [
      'FAA TRUST or Part 107 certificate',
      'FAA drone registration',
      'Remote ID compliance',
      'B4UFLY / LAANC check',
    ]

  return [
    airspace.locationName ? `Location: ${airspace.locationName}` : null,
    `Can fly: ${canFly}`,
    `Airspace type: ${airspace.airspaceType || 'Uncertain'}`,
    `Authorization: ${
      airspace.permitRequired === false
        ? 'Generally not required (still verify locally)'
        : 'Authorization / LAANC may be required'
    }`,
    `Risk: ${airspace.riskLevel || 'Unknown'}`,
    `Required documents: ${docs.join(', ')}`,
    airspace.summary ? `Summary: ${airspace.summary}` : null,
    airspace.restrictions?.length
      ? `Key restrictions:\n${airspace.restrictions
          .slice(0, 4)
          .map((item) => `- ${item.title || item.type || 'Restriction'}: ${item.description || ''}`)
          .join('\n')}`
      : null,
    airspace.checklist?.length
      ? `Checklist:\n${airspace.checklist.slice(0, 5).map((item) => `- ${item}`).join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n')
}

export function KimiChat({ location, placeName }: KimiChatProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Ask about airspace restrictions. For US locations I cover FAA Part 107, LAANC, B4UFLY, airports, and Remote ID.',
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
      const result = await queryAirspaceAgent({
        lat,
        lng,
        placeName: placeName || undefined,
        message,
      })

      let text: string
      if (result.intent !== 'airspace_restrictions') {
        text = `Current intent: ${result.intent}. I mainly answer airspace restrictions — try asking "Can I fly here?" or "What no-fly zones are nearby?"`
      } else if (result.airspace) {
        text = formatAirspace(result.airspace)
      } else {
        text = result.reason || 'No airspace data returned. Try rephrasing your question.'
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text,
          airspace: result.airspace,
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
        <div className="kimi-panel" role="dialog" aria-label="Kimi Airspace Assistant">
          <div className="kimi-panel-header">
            <div>
              <strong>Kimi Airspace Assistant</strong>
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
              <div className="kimi-bubble assistant kimi-typing">Checking airspace…</div>
            )}
          </div>

          <div className="kimi-quick">
            <button type="button" disabled={sending} onClick={() => void sendMessage('Can I fly a drone here under FAA rules?')}>
              Can I fly?
            </button>
            <button type="button" disabled={sending} onClick={() => void sendMessage('What FAA airspace class, airports, and LAANC requirements apply here?')}>
              FAA / LAANC
            </button>
          </div>

          <form className="kimi-input-row" onSubmit={send}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about airspace restrictions…"
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
