import {
  ArrowRight,
  Check,
  Clipboard,
  FileText,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from 'lucide-react'
import { useState } from 'react'
import { api } from '../api'
import { useAction, useCopy } from '../hooks'
import { CATEGORY_LABELS, type TaskBatchResult, type TaskInput, type Tone } from '../types'
import { EngineBadge, ErrorNotice, Notice, PageHeading, PriorityBadge, Spinner } from './ui'

const SAMPLE =
  'Hi, I received order #BP-1042 today, but one of the ceramic mugs arrived broken. I need a replacement for a birthday this Friday. Could you please help?'

export function Inbox({
  disabled,
  onCreateTask,
}: {
  disabled: boolean
  onCreateTask: (tasks: TaskInput[], signal?: AbortSignal) => Promise<TaskBatchResult>
}) {
  const [message, setMessage] = useState('')
  const [tone, setTone] = useState<Tone>('professional')
  const [business, setBusiness] = useState('')
  const [editedDraft, setEditedDraft] = useState<string | null>(null)
  const [savedTask, setSavedTask] = useState(false)
  const classification = useAction(api.classify)
  const reply = useAction(api.draft)
  const save = useAction(onCreateTask)
  const copy = useCopy()
  const analyzedMessage = classification.data ? message : ''

  function updateMessage(value: string) {
    setMessage(value)
    classification.reset()
    reply.reset()
    save.reset()
    setEditedDraft(null)
    setSavedTask(false)
  }

  async function draft() {
    setEditedDraft(null)
    setSavedTask(false)
    save.reset()
    await reply.run(message.trim(), tone, business.trim())
  }

  async function createFollowUp() {
    if (!classification.data || savedTask) return
    const result = await save.run([
      {
        title: `Follow up: ${CATEGORY_LABELS[classification.data.category]}`.slice(0, 200),
        description: `${classification.data.suggested_action}\n\nCustomer message:\n${analyzedMessage}`,
        priority: classification.data.priority,
        order_reference:
          analyzedMessage.match(
            /(?:order\s*(?:(?:reference|ref|number|no\.?|id)\s*[:#]?\s*|[:#]\s*|(?=[A-Z0-9_-]*\d))|#)([A-Z0-9][A-Z0-9_-]{1,39})\b/i,
          )?.[1] ?? null,
        due_date: null,
      },
    ])
    if (result) setSavedTask(true)
  }

  const draftText = editedDraft ?? reply.data?.draft ?? ''
  const unavailable = disabled || !message.trim() || message.trim().length > 4000

  return (
    <>
      <PageHeading
        eyebrow="CUSTOMER SUPPORT"
        title="A little clarity. A better reply."
        description="Understand what your customer needs, then turn it into a thoughtful response."
      />
      <div className="workflow-steps">
        <span className="active">
          <b>1</b> Add a message
        </span>
        <ArrowRight size={15} />
        <span className={classification.data ? 'active' : ''}>
          <b>2</b> Review insights
        </span>
        <ArrowRight size={15} />
        <span className={reply.data ? 'active' : ''}>
          <b>3</b> Make it yours
        </span>
      </div>
      <div className="split-layout inbox-layout">
        <section className="card input-card">
          <div className="card-heading">
            <div className="heading-with-icon">
              <MessageSquareText size={19} />
              <h2>Customer message</h2>
            </div>
            <button
              className="text-button"
              onClick={() => updateMessage(SAMPLE)}
              disabled={classification.loading || reply.loading || save.loading}
            >
              Try an example <ArrowRight size={14} />
            </button>
          </div>
          <p className="section-description">
            Paste an email, chat, or order question. Keep private information to a minimum.
          </p>
          <label className="sr-only" htmlFor="customer-message">
            Customer message
          </label>
          <textarea
            id="customer-message"
            className="message-input"
            value={message}
            onChange={(e) => updateMessage(e.target.value)}
            maxLength={4000}
            placeholder="Paste your customer's message here…"
            rows={9}
            disabled={classification.loading || reply.loading || save.loading}
          />
          <div className="field-footer">
            <span>{message.length.toLocaleString()} / 4,000 characters</span>
            <span>
              <ShieldCheck size={13} /> Nothing is sent automatically
            </span>
          </div>
          <div className="form-divider" />
          <div className="field-row">
            <div className="field">
              <label htmlFor="reply-tone">Reply tone</label>
              <select
                id="reply-tone"
                value={tone}
                onChange={(e) => {
                  setTone(e.target.value as Tone)
                  reply.reset()
                  setEditedDraft(null)
                }}
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="concise">Concise</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="business-name">
                Business name <span className="optional">optional</span>
              </label>
              <input
                id="business-name"
                value={business}
                onChange={(e) => {
                  setBusiness(e.target.value)
                  reply.reset()
                  setEditedDraft(null)
                }}
                maxLength={80}
                placeholder="Your business"
              />
            </div>
          </div>
          <button
            className="button primary full-width analyze-button"
            disabled={unavailable || classification.loading || reply.loading || save.loading}
            onClick={() => {
              setSavedTask(false)
              save.reset()
              void classification.run(message.trim())
            }}
          >
            {classification.loading ? (
              <Spinner label="Analyzing message…" />
            ) : (
              <>
                <Sparkles size={17} /> Analyze message <ArrowRight size={16} />
              </>
            )}
          </button>
          <ErrorNotice message={classification.error} retry={() => void classification.run(message.trim())} />
        </section>
        <section className="card result-card" aria-busy={classification.loading}>
          <div className="card-heading">
            <div className="heading-with-icon">
              <WandSparkles size={19} />
              <h2>Message insights</h2>
            </div>
            {classification.data && <EngineBadge engine={classification.data.engine} />}
          </div>
          {!classification.data ? (
            <div className="insights-placeholder">
              <div className="illustration-icon">
                <FileText size={34} strokeWidth={1.3} />
                <span>
                  <Sparkles size={15} />
                </span>
              </div>
              <h3>Find the signal in the message</h3>
              <p>Category, priority, and a suggested next step will appear here after analysis.</p>
              <div className="placeholder-tags">
                <span>Intent</span>
                <span>Priority</span>
                <span>Next step</span>
              </div>
            </div>
          ) : (
            <div className="insights-content" aria-live="polite">
              <div className="badge-row">
                <span className="badge category-badge">{CATEGORY_LABELS[classification.data.category]}</span>
                <PriorityBadge priority={classification.data.priority} />
                <span className="sentiment">{classification.data.sentiment} sentiment</span>
              </div>
              <div className="insight-block">
                <span className="field-label">THE SHORT VERSION</span>
                <p>{classification.data.summary}</p>
              </div>
              <div className="suggested-action">
                <span className="field-label">SUGGESTED NEXT STEP</span>
                <p>{classification.data.suggested_action}</p>
              </div>
              {classification.data.warning && <p className="engine-note">{classification.data.warning}</p>}
              <button
                className="button primary full-width"
                onClick={() => void draft()}
                disabled={reply.loading || save.loading}
              >
                {reply.loading ? (
                  <Spinner label="Writing your draft…" />
                ) : (
                  <>
                    <WandSparkles size={17} /> Draft a reply <ArrowRight size={16} />
                  </>
                )}
              </button>
              <button
                className="button subtle full-width"
                onClick={() => void createFollowUp()}
                disabled={save.loading || savedTask || disabled}
              >
                {save.loading ? (
                  <Spinner label="Saving task…" />
                ) : savedTask ? (
                  <>
                    <Check size={16} /> Follow-up task saved
                  </>
                ) : (
                  <>
                    <Check size={16} /> Save follow-up as a task
                  </>
                )}
              </button>
            </div>
          )}
          <ErrorNotice message={save.error} />
        </section>
      </div>
      <ErrorNotice message={reply.error} retry={() => void draft()} />
      {reply.data && (
        <section className="card draft-card">
          <div className="card-heading">
            <div className="heading-with-icon">
              <FileText size={19} />
              <h2>Your reply draft</h2>
            </div>
            <div className="heading-actions">
              <EngineBadge engine={reply.data.engine} />
              <button
                className="button secondary small"
                onClick={() => void copy.copy(draftText)}
                disabled={!draftText.trim()}
              >
                {copy.state === 'copied' ? <Check size={15} /> : <Clipboard size={15} />}
                {copy.state === 'copied' ? 'Copied' : 'Copy reply'}
              </button>
            </div>
          </div>
          <p className="section-description">
            Edit freely. This is a draft—not a sent message. Check all facts before sharing it.
          </p>
          <label className="sr-only" htmlFor="reply-draft">
            Editable reply draft
          </label>
          <textarea
            id="reply-draft"
            className="draft-input"
            rows={8}
            value={draftText}
            maxLength={6000}
            onChange={(e) => setEditedDraft(e.target.value)}
          />
          {reply.data.warning && <p className="engine-note">{reply.data.warning}</p>}
          {copy.state === 'error' && (
            <Notice kind="warning">
              Clipboard access was blocked. Select the draft above and copy it manually.
            </Notice>
          )}
          <div className="draft-footer">
            <ShieldCheck size={15} />
            <span>Only you decide what gets sent.</span>
          </div>
        </section>
      )}
    </>
  )
}
