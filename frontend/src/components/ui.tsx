import { AlertCircle, Check, ChevronRight, Inbox, LoaderCircle, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Priority, TaskStatus } from '../types'
import { STATUS_LABELS } from '../types'

export function Spinner({ label = 'Working…' }: { label?: string }) {
  return (
    <span className="spinner-label">
      <LoaderCircle size={16} className="spin" aria-hidden="true" />
      {label}
    </span>
  )
}

export function ErrorNotice({ message, retry }: { message: string | null; retry?: () => void }) {
  if (!message) return null
  return (
    <div className="notice error-notice" role="alert">
      <AlertCircle size={18} />
      <div>
        <p>{message}</p>
        {retry && (
          <button className="text-button" onClick={retry}>
            Try again <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

export function Notice({
  children,
  kind = 'info',
}: {
  children: ReactNode
  kind?: 'info' | 'success' | 'warning'
}) {
  return (
    <div className={`notice ${kind}-notice`} role={kind === 'success' ? 'status' : undefined}>
      {kind === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
      <div>{children}</div>
    </div>
  )
}

export function EngineBadge({ engine }: { engine: 'groq' | 'rules' }) {
  return (
    <span className={`engine-badge ${engine}`}>
      <Sparkles size={12} />
      {engine === 'groq' ? 'Groq AI' : 'Local rules'}
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`badge priority-${priority}`}>
      <span className="badge-dot" />
      {priority}
    </span>
  )
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`badge status-${status}`}>{STATUS_LABELS[status]}</span>
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Inbox size={26} strokeWidth={1.5} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}
