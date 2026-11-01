import {
  ArrowRight,
  CheckCheck,
  CircleAlert,
  Clock3,
  ListChecks,
  ListTodo,
  MessageSquareText,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'
import type { Page, Task } from '../types'
import { EmptyState, ErrorNotice, PageHeading, PriorityBadge, Spinner, StatusBadge } from './ui'

export function Dashboard({
  tasks,
  loading,
  error,
  onNavigate,
  onRefresh,
  aiConfigured,
}: {
  tasks: Task[]
  loading: boolean
  error: string | null
  onNavigate: (page: Page) => void
  onRefresh: () => void
  aiConfigured: boolean
}) {
  const open = tasks.filter((task) => task.status === 'todo').length
  const inProgress = tasks.filter((task) => task.status === 'in_progress').length
  const done = tasks.filter((task) => task.status === 'done').length
  const attention = tasks.filter(
    (task) => task.status !== 'done' && (task.priority === 'urgent' || task.priority === 'high'),
  ).length
  const recent = tasks.filter((task) => task.status !== 'done').slice(0, 5)
  const stats = [
    { label: 'Ready to start', value: open, icon: ListTodo, color: 'blue', filter: 'todo' },
    { label: 'In progress', value: inProgress, icon: Clock3, color: 'amber', filter: 'in_progress' },
    { label: 'Completed', value: done, icon: CheckCheck, color: 'green', filter: 'done' },
    { label: 'Need attention', value: attention, icon: CircleAlert, color: 'rose', filter: 'all' },
  ]
  return (
    <>
      <PageHeading
        eyebrow="YOUR WORKSPACE, AT A GLANCE"
        title="Good things start with a clear day."
        description="A little help with the messages, the orders, and everything that comes next."
        action={
          <span className="overview-label">
            <span className="live-dot" />
            Business overview
          </span>
        }
      />
      <section className="welcome-card">
        <div className="welcome-copy">
          <span className="welcome-eyebrow">
            <Sparkles size={14} /> MEET YOUR EVERYDAY COPILOT
          </span>
          <h2>
            Customer care.
            <br />
            <span>With a little more clarity.</span>
          </h2>
          <p>
            From “just checking in” to “where’s my order?”—turn everyday conversations into confident next
            steps.
          </p>
          <button className="button welcome-button" onClick={() => onNavigate('inbox')}>
            Open customer inbox <ArrowRight size={17} />
          </button>
        </div>
        <div className="workflow-art" aria-hidden="true">
          <div className="art-ring ring-one" />
          <div className="art-ring ring-two" />
          <div className="art-message">
            <span className="art-icon">
              <MessageSquareText size={19} />
            </span>
            <div>
              <i />
              <i />
              <i />
            </div>
            <span className="art-tiny-dot" />
          </div>
          <div className="art-connection" />
          <div className="art-center">
            <Sparkles size={34} strokeWidth={1.5} />
          </div>
          <div className="art-task">
            <span>
              <CheckCheck size={19} />
            </span>
            <div>
              <i />
              <i />
              <i />
            </div>
          </div>
          <span className="art-spark spark-one">✦</span>
          <span className="art-spark spark-two">✧</span>
        </div>
      </section>
      <div className="stats-grid">
        {stats.map((stat) => (
          <button
            key={stat.label}
            className={`stat-card stat-${stat.color}`}
            onClick={() => onNavigate('tasks')}
            aria-label={`${stat.label}: ${loading ? 'loading' : stat.value}. Open tasks`}
          >
            <div>
              <span className="stat-label">{stat.label}</span>
              <strong>{loading && !tasks.length ? '—' : stat.value}</strong>
            </div>
            <span className="stat-icon">
              <stat.icon size={21} strokeWidth={1.7} />
            </span>
          </button>
        ))}
      </div>
      <div className="dashboard-bottom">
        <section className="card quick-start-card">
          <div className="card-heading">
            <h2>A good place to start</h2>
            <span className="muted small-text">Three ways to lighten the load</span>
          </div>
          <div className="quick-actions">
            {[
              {
                page: 'inbox' as Page,
                icon: MessageSquareText,
                title: 'Make sense of a message',
                description: 'Classify a customer request and draft a reply that sounds like you.',
                color: 'blue',
              },
              {
                page: 'orders' as Page,
                icon: ShoppingBag,
                title: 'Turn an order into action',
                description: 'Extract the details and build a reviewable fulfillment checklist.',
                color: 'amber',
              },
              {
                page: 'assistant' as Page,
                icon: Sparkles,
                title: 'Think it through with AI',
                description: aiConfigured
                  ? 'Talk through a customer situation or get help with your next business move.'
                  : 'Connect a Groq key to chat. The core workflows work without one.',
                color: 'purple',
              },
            ].map((item) => (
              <button className="quick-action" key={item.page} onClick={() => onNavigate(item.page)}>
                <span className={`quick-icon ${item.color}`}>
                  <item.icon size={21} strokeWidth={1.6} />
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
        </section>
        <section className="card upcoming-card">
          <div className="card-heading">
            <div className="heading-with-icon">
              <ListChecks size={19} />
              <h2>On your radar</h2>
            </div>
            <button className="text-button" onClick={() => onNavigate('tasks')}>
              View all <ArrowRight size={14} />
            </button>
          </div>
          <ErrorNotice message={error} retry={onRefresh} />
          {loading && !tasks.length ? (
            <div className="loading-state">
              <Spinner label="Loading tasks…" />
            </div>
          ) : recent.length ? (
            <div className="upcoming-list">
              {recent.map((task) => (
                <button key={task.id} onClick={() => onNavigate('tasks')}>
                  <div>
                    <strong>{task.title}</strong>
                    <div className="badge-row">
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} />
                    </div>
                  </div>
                  <ArrowRight size={15} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nothing on your plate. Yet."
              description="Your saved follow-ups and order tasks will show up here."
            />
          )}
        </section>
      </div>
      <div className="dashboard-note">
        <span className="note-mark">
          <Sparkles size={15} />
        </span>
        <p>
          <strong>Assistance, not autopilot.</strong> BizPilot helps you prepare. You review the details and
          decide what happens next.
        </p>
      </div>
    </>
  )
}
