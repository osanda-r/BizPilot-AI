import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  ListTodo,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useState } from 'react'
import {
  PRIORITIES,
  STATUS_LABELS,
  type Priority,
  type Task,
  type TaskInput,
  type TaskStatus,
} from '../types'
import { EmptyState, ErrorNotice, Notice, PageHeading, PriorityBadge, Spinner, StatusBadge } from './ui'

interface Props {
  tasks: Task[]
  loading: boolean
  error: string | null
  disabled: boolean
  onRefresh: () => void
  onCreate: (tasks: TaskInput[], signal?: AbortSignal) => Promise<unknown>
  onUpdate: (id: string, status: TaskStatus) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
}

const EMPTY_FORM = { title: '', description: '', priority: 'normal' as Priority, due_date: '' }

export function Tasks({ tasks, loading, error, disabled, onRefresh, onCreate, onUpdate, onDelete }: Props) {
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all')
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const filtered = tasks.filter(
    (task) =>
      (filter === 'all' || task.status === filter) &&
      `${task.title} ${task.description} ${task.order_reference || ''}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )

  async function act(key: string, operation: () => Promise<unknown>, success: string) {
    if (busy) return
    setBusy(key)
    setActionError(null)
    setFeedback(null)
    try {
      const result = await operation()
      if (result !== undefined) {
        setFeedback(success)
        setDeleteId(null)
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'The task could not be updated. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="YOUR ACTION CENTER"
        title="Less juggling. More doing."
        description="Every follow-up and fulfillment step, together in one saved task list."
        action={
          <button
            className="button primary"
            disabled={disabled || !!busy}
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? <X size={17} /> : <Plus size={17} />}
            {showForm ? 'Close form' : 'New task'}
          </button>
        }
      />
      {showForm && (
        <section className="card new-task-card">
          <h2>Create a task</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!form.title.trim()) return
              void act(
                'create',
                async () => {
                  const result = await onCreate([
                    {
                      ...form,
                      title: form.title.trim(),
                      due_date: form.due_date || null,
                      order_reference: null,
                    },
                  ])
                  if (result) {
                    setForm(EMPTY_FORM)
                    setShowForm(false)
                    setFilter('all')
                    setQuery('')
                  }
                  return result
                },
                'Task created.',
              )
            }}
          >
            <div className="field">
              <label htmlFor="new-task-title">
                Task title <span className="required">*</span>
              </label>
              <input
                id="new-task-title"
                required
                maxLength={200}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="What needs to get done?"
              />
            </div>
            <div className="field">
              <label htmlFor="new-task-description">
                Description <span className="optional">optional</span>
              </label>
              <textarea
                id="new-task-description"
                rows={3}
                maxLength={4000}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Add the details someone will need to complete this task…"
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="new-task-priority">Priority</label>
                <select
                  id="new-task-priority"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="new-task-date">
                  Due date <span className="optional">optional</span>
                </label>
                <input
                  id="new-task-date"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="button secondary" type="button" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button
                className="button primary"
                type="submit"
                disabled={disabled || !!busy || !form.title.trim()}
              >
                {busy === 'create' ? (
                  <Spinner label="Creating…" />
                ) : (
                  <>
                    <Plus size={16} /> Create task
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      )}
      <ErrorNotice message={actionError} />
      {feedback && <Notice kind="success">{feedback}</Notice>}
      <section className="card task-list-card">
        <div className="task-list-toolbar">
          <div className="filter-tabs" aria-label="Filter tasks by status">
            {(['all', 'todo', 'in_progress', 'done'] as const).map((status) => (
              <button
                key={status}
                className={filter === status ? 'active' : ''}
                aria-pressed={filter === status}
                onClick={() => setFilter(status)}
              >
                {status === 'all' ? 'All tasks' : STATUS_LABELS[status]}
                <span>
                  {status === 'all' ? tasks.length : tasks.filter((task) => task.status === status).length}
                </span>
              </button>
            ))}
          </div>
          <div className="search-field">
            <Search size={16} />
            <label className="sr-only" htmlFor="task-search">
              Search tasks
            </label>
            <input
              id="task-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks…"
            />
          </div>
        </div>
        <ErrorNotice message={error} retry={onRefresh} />
        {loading && !tasks.length ? (
          <div className="loading-state">
            <Spinner label="Loading your tasks…" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={tasks.length ? 'No matching tasks' : 'A clear list. A fresh start.'}
            description={
              tasks.length
                ? 'Try a different search or status filter.'
                : 'Create a task, save a customer follow-up, or extract tasks from an order to get started.'
            }
            action={
              !tasks.length && (
                <button className="button secondary" onClick={() => setShowForm(true)} disabled={disabled}>
                  <Plus size={16} /> Add your first task
                </button>
              )
            }
          />
        ) : (
          <div className="task-list">
            {filtered.map((task) => (
              <article className={`task-row ${task.status === 'done' ? 'completed' : ''}`} key={task.id}>
                <button
                  className={`task-check ${task.status === 'done' ? 'checked' : ''}`}
                  aria-label={task.status === 'done' ? `Reopen ${task.title}` : `Complete ${task.title}`}
                  title={task.status === 'done' ? 'Mark as to do' : 'Mark as completed'}
                  disabled={disabled || !!busy}
                  onClick={() =>
                    void act(
                      task.id,
                      () => onUpdate(task.id, task.status === 'done' ? 'todo' : 'done'),
                      task.status === 'done' ? 'Task reopened.' : 'Task completed. Nice work!',
                    )
                  }
                >
                  {task.status === 'done' && <Check size={15} />}
                </button>
                <div className="task-content">
                  <div className="task-title-line">
                    <h3>{task.title}</h3>
                    <PriorityBadge priority={task.priority} />
                  </div>
                  {task.description && <p className="task-description">{task.description}</p>}
                  <div className="task-meta">
                    {task.order_reference && (
                      <span>
                        <ListTodo size={13} />
                        {task.order_reference}
                      </span>
                    )}
                    {task.due_date && (
                      <span>
                        <CalendarDays size={13} />
                        Due {task.due_date}
                      </span>
                    )}
                    <span>
                      Added{' '}
                      {new Date(task.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                <div className="task-row-actions">
                  <div className="status-select-wrap">
                    <StatusBadge status={task.status} />
                    <ChevronDown size={12} />
                    <select
                      aria-label={`Status of ${task.title}`}
                      value={task.status}
                      disabled={disabled || !!busy}
                      onChange={(e) =>
                        void act(
                          task.id,
                          () => onUpdate(task.id, e.target.value as TaskStatus),
                          'Task status updated.',
                        )
                      }
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="icon-button delete-button"
                    aria-label={`Delete ${task.title}`}
                    disabled={disabled || !!busy}
                    onClick={() => {
                      setDeleteId(deleteId === task.id ? null : task.id)
                      setActionError(null)
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {deleteId === task.id && (
                  <div className="delete-confirm">
                    <span>Delete this task permanently?</span>
                    <button
                      className="button secondary small"
                      onClick={() => setDeleteId(null)}
                      disabled={!!busy}
                    >
                      Cancel
                    </button>
                    <button
                      className="button danger small"
                      disabled={!!busy}
                      onClick={() => void act(task.id, () => onDelete(task.id), 'Task deleted.')}
                    >
                      {busy === task.id ? 'Deleting…' : 'Delete task'}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
        <div className="task-list-footer">
          <span>
            <CircleCheck size={14} />
            {tasks.filter((task) => task.status === 'done').length} of {tasks.length} tasks completed
          </span>
          <span>Saved on this server</span>
        </div>
      </section>
    </>
  )
}
