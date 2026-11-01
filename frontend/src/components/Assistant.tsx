import { ArrowUp, Lightbulb, MessageCircle, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { useAction } from '../hooks'
import type { ChatMessage } from '../types'
import { ErrorNotice, Notice, PageHeading, Spinner } from './ui'

const GREETING: ChatMessage = {
  role: 'assistant',
  content:
    'Hi! I’m BizPilot, your business thinking partner. Tell me what you’re working on—a tricky customer reply, a new process, or an idea you want to talk through.',
}
const PROMPTS = [
  'Help me respond to a delayed order',
  'Suggest a customer feedback process',
  'Help me organize my daily tasks',
]

export function Assistant({ configured, disabled }: { configured: boolean; disabled: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING])
  const [input, setInput] = useState('')
  const [failedMessage, setFailedMessage] = useState<string | null>(null)
  const chat = useAction(api.chat)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, chat.loading])

  async function send(text: string) {
    const message = text.trim()
    if (!message || chat.loading || disabled || !configured) return
    const history = messages[0] === GREETING ? messages.slice(1).slice(-20) : messages.slice(-20)
    setMessages((previous) => [...previous, { role: 'user', content: message }])
    setInput('')
    setFailedMessage(null)
    const result = await chat.run(message, history)
    if (result) setMessages((previous) => [...previous, { role: 'assistant', content: result.reply }])
    else {
      setFailedMessage(message)
      setInput(message)
      setMessages((previous) => previous.slice(0, -1))
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="A FRESH PERSPECTIVE"
        title="Let’s think it through."
        description="A sounding board for customer conversations and the small decisions that move a business forward."
        action={
          messages.length > 1 && (
            <button
              className="button secondary"
              disabled={chat.loading}
              onClick={() => {
                setMessages([GREETING])
                setInput('')
                setFailedMessage(null)
                chat.reset()
              }}
            >
              <RotateCcw size={15} /> New conversation
            </button>
          )
        }
      />
      {!configured && (
        <Notice kind="warning">
          <strong>AI chat needs a Groq API key.</strong> Add GROQ_API_KEY to backend/.env and restart the
          backend. You can still classify messages, draft replies with local rules, and manage tasks without a
          key.
        </Notice>
      )}
      <section className="card assistant-card">
        <div className="chat-header">
          <span className="assistant-avatar">
            <Sparkles size={20} />
          </span>
          <div>
            <h2>BizPilot Assistant</h2>
            <span>
              {configured ? 'Powered by Groq · Here to help you think' : 'Waiting for AI configuration'}
            </span>
          </div>
          <span className="chat-private">
            <ShieldCheck size={14} /> Advisory only
          </span>
        </div>
        <div className="chat-messages" role="log" aria-label="Conversation with BizPilot" aria-live="polite">
          {messages.map((message, index) => (
            <div key={index} className={`chat-message ${message.role}`}>
              <span className="chat-avatar">
                {message.role === 'assistant' ? <Sparkles size={16} /> : 'You'}
              </span>
              <div className="chat-bubble">{message.content}</div>
            </div>
          ))}
          {messages.length === 1 && (
            <div className="chat-suggestions">
              <span>
                <Lightbulb size={15} /> A few conversation starters
              </span>
              <div>
                {PROMPTS.map((prompt) => (
                  <button key={prompt} onClick={() => setInput(prompt)} disabled={!configured || disabled}>
                    <MessageCircle size={16} />
                    {prompt}
                    <ArrowUp size={14} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {chat.loading && (
            <div className="chat-loading" role="status">
              <Spinner label="BizPilot is thinking…" />
            </div>
          )}
          <div ref={end} />
        </div>
        <div className="chat-composer-area">
          <ErrorNotice
            message={chat.error}
            retry={failedMessage ? () => void send(failedMessage) : undefined}
          />
          <form
            className="chat-composer"
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
          >
            <label className="sr-only" htmlFor="chat-input">
              Message BizPilot
            </label>
            <textarea
              id="chat-input"
              rows={2}
              maxLength={4000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                configured
                  ? 'What would you like to work through?'
                  : 'Configure Groq to start a conversation…'
              }
              disabled={!configured || disabled || chat.loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void send(input)
                }
              }}
            />
            <button
              className="send-button"
              aria-label="Send message"
              type="submit"
              disabled={!configured || disabled || chat.loading || !input.trim()}
            >
              {chat.loading ? <Spinner label="" /> : <ArrowUp size={20} />}
            </button>
          </form>
          <p className="chat-disclaimer">
            AI can make mistakes. Verify business facts. Chat cannot send replies or change your tasks.
          </p>
        </div>
      </section>
    </>
  )
}
