import {
  ArrowRight,
  Check,
  ClipboardList,
  ListChecks,
  Package,
  ShoppingBag,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { useState } from 'react'
import { api } from '../api'
import { useAction } from '../hooks'
import { PRIORITIES, type Priority, type TaskBatchResult, type TaskInput } from '../types'
import { EmptyState, EngineBadge, ErrorNotice, Notice, PageHeading, Spinner } from './ui'

const SAMPLE =
  'Order reference: BP-2048\nCustomer: Alex Morgan\n2 x Handmade ceramic mug\n1 x Gift wrapping\nPlease confirm availability before dispatch.'

export function Orders({
  disabled,
  onSaved,
}: {
  disabled: boolean
  onSaved: (tasks: TaskInput[], signal?: AbortSignal) => Promise<TaskBatchResult>
}) {
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [editedTasks, setEditedTasks] = useState<TaskInput[]>([])
  const [saved, setSaved] = useState(false)
  const extraction = useAction(api.extractOrder)
  const save = useAction(onSaved)
  const result = extraction.data

  function updateMessage(value: string) {
    setMessage(value)
    extraction.reset()
    save.reset()
    setSaved(false)
  }

  async function extract() {
    setSaved(false)
    save.reset()
    const data = await extraction.run(message.trim())
    if (data) {
      setEditedTasks(data.tasks)
      setSelected(data.tasks.map((_, index) => index))
    }
  }

  function editTask(index: number, change: Partial<TaskInput>) {
    setEditedTasks((prev) => prev.map((task, i) => (i === index ? { ...task, ...change } : task)))
    setSaved(false)
    save.reset()
  }

  async function saveSelected() {
    if (!selected.length || saved) return
    const response = await save.run(editedTasks.filter((_, index) => selected.includes(index)))
    if (response) setSaved(true)
  }

  const invalidTask = editedTasks.some((task, index) => selected.includes(index) && !task.title.trim())

  return (
    <>
      <PageHeading
        eyebrow="ORDER OPERATIONS"
        title="From an order to a clear plan."
        description="Pull out the details, review the next steps, and keep fulfillment moving."
      />
      <div className="workflow-steps">
        <span className="active">
          <b>1</b> Paste an order
        </span>
        <ArrowRight size={15} />
        <span className={result ? 'active' : ''}>
          <b>2</b> Review the tasks
        </span>
        <ArrowRight size={15} />
        <span className={saved ? 'active' : ''}>
          <b>3</b> Save to your task list
        </span>
      </div>
      <div className="split-layout order-layout">
        <section className="card input-card">
          <div className="card-heading">
            <div className="heading-with-icon">
              <ShoppingBag size={19} />
              <h2>Order details</h2>
            </div>
            <button
              className="text-button"
              onClick={() => updateMessage(SAMPLE)}
              disabled={extraction.loading || save.loading}
            >
              Try an example <ArrowRight size={14} />
            </button>
          </div>
          <p className="section-description">
            Works with order emails and messages. Extraction never confirms an order or reserves stock.
          </p>
          <label className="sr-only" htmlFor="order-message">
            Order message
          </label>
          <textarea
            id="order-message"
            className="message-input order-input"
            rows={12}
            maxLength={4000}
            value={message}
            onChange={(e) => updateMessage(e.target.value)}
            placeholder={
              'Paste the order request here…\n\nInclude the order reference, customer, items, and quantities when available.'
            }
            disabled={extraction.loading || save.loading}
          />
          <div className="field-footer">
            <span>{message.length.toLocaleString()} / 4,000 characters</span>
            <span>English local fallback</span>
          </div>
          <button
            className="button primary full-width analyze-button"
            onClick={() => void extract()}
            disabled={disabled || extraction.loading || save.loading || !message.trim()}
          >
            {extraction.loading ? (
              <Spinner label="Extracting order details…" />
            ) : (
              <>
                <Sparkles size={17} /> Extract order tasks <ArrowRight size={16} />
              </>
            )}
          </button>
          <ErrorNotice message={extraction.error} retry={() => void extract()} />
          <div className="tip-box">
            <Package size={20} />
            <div>
              <strong>A human check makes the difference</strong>
              <p>
                Verify quantities, customer details, and deadlines before saving. Missing details stay
                blank—never guessed.
              </p>
            </div>
          </div>
        </section>
        <section className="card result-card" aria-busy={extraction.loading}>
          <div className="card-heading">
            <div className="heading-with-icon">
              <ListChecks size={19} />
              <h2>Review proposed tasks</h2>
            </div>
            {result && <EngineBadge engine={result.engine} />}
          </div>
          {!result ? (
            <EmptyState
              title="Your next steps start here"
              description="Extract an order to see its details and a checklist of proposed tasks."
            />
          ) : (
            <>
              <div className="order-summary">
                <div>
                  <Package size={16} />
                  <span>Order</span>
                  <strong>{result.order_reference || 'Not provided'}</strong>
                </div>
                <div>
                  <UserRound size={16} />
                  <span>Customer</span>
                  <strong>{result.customer_name || 'Not provided'}</strong>
                </div>
              </div>
              {result.items.length > 0 && (
                <div className="order-items">
                  <span className="field-label">REQUESTED ITEMS</span>
                  {result.items.map((item, index) => (
                    <div key={index}>
                      <span>{item.name}</span>
                      <b>× {item.quantity}</b>
                    </div>
                  ))}
                </div>
              )}
              {result.missing_fields.length > 0 && (
                <Notice kind="warning">
                  Still needed: {result.missing_fields.join(', ')}. Confirm these details before fulfillment.
                </Notice>
              )}
              {result.warning && <p className="engine-note">{result.warning}</p>}
              <div className="proposed-heading">
                <span className="field-label">PROPOSED TASKS</span>
                <span>{selected.length} selected</span>
              </div>
              <div className="proposed-tasks">
                {editedTasks.map((task, index) => (
                  <div className={`proposed-task ${selected.includes(index) ? 'selected' : ''}`} key={index}>
                    <input
                      type="checkbox"
                      checked={selected.includes(index)}
                      disabled={saved || save.loading}
                      aria-label={`Select task ${index + 1}`}
                      onChange={(e) => {
                        setSelected((prev) =>
                          e.target.checked ? [...prev, index] : prev.filter((i) => i !== index),
                        )
                        setSaved(false)
                        save.reset()
                      }}
                    />
                    <div className="proposed-task-body">
                      <label className="sr-only" htmlFor={`task-title-${index}`}>
                        Task {index + 1} title
                      </label>
                      <input
                        id={`task-title-${index}`}
                        className="task-title-input"
                        value={task.title}
                        maxLength={200}
                        disabled={saved || save.loading}
                        onChange={(e) => editTask(index, { title: e.target.value })}
                      />
                      <p tabIndex={0} aria-label={`Task ${index + 1} description`}>
                        {task.description}
                      </p>
                      <label className="inline-field">
                        Priority
                        <select
                          aria-label={`Task ${index + 1} priority`}
                          value={task.priority}
                          disabled={saved || save.loading}
                          onChange={(e) => editTask(index, { priority: e.target.value as Priority })}
                        >
                          {PRIORITIES.map((priority) => (
                            <option key={priority} value={priority}>
                              {priority}
                            </option>
                          ))}
                        </select>
                      </label>
                      {task.due_date && <span className="due-date">Due {task.due_date}</span>}
                    </div>
                  </div>
                ))}
              </div>
              {editedTasks.length === 0 && (
                <Notice kind="warning">No tasks were extracted. Add the details manually in Tasks.</Notice>
              )}
              {saved && (
                <Notice kind="success">
                  Review saved. Your tasks are now in the task list; existing duplicates were skipped.
                </Notice>
              )}
              <button
                className="button primary full-width"
                disabled={disabled || save.loading || saved || !selected.length || invalidTask}
                onClick={() => void saveSelected()}
              >
                {save.loading ? (
                  <Spinner label="Saving tasks…" />
                ) : saved ? (
                  <>
                    <Check size={17} /> Tasks saved
                  </>
                ) : (
                  <>
                    <ClipboardList size={17} /> Save {selected.length} selected{' '}
                    {selected.length === 1 ? 'task' : 'tasks'}
                  </>
                )}
              </button>
              {invalidTask && <p className="field-error">Give each selected task a title before saving.</p>}
              <ErrorNotice message={save.error} retry={() => void saveSelected()} />
            </>
          )}
        </section>
      </div>
    </>
  )
}
