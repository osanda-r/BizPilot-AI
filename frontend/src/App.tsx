import {
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleHelp,
  Command,
  LayoutDashboard,
  ListChecks,
  Menu,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { Assistant } from './components/Assistant'
import { Dashboard } from './components/Dashboard'
import { Inbox } from './components/Inbox'
import { Orders } from './components/Orders'
import { Tasks } from './components/Tasks'
import { Spinner } from './components/ui'
import { useAction } from './hooks'
import type { Page, TaskInput, TaskStatus } from './types'
import './App.css'

const NAV = [
  { id: 'dashboard' as Page, label: 'Overview', icon: LayoutDashboard },
  { id: 'inbox' as Page, label: 'Customer inbox', icon: MessageSquareText },
  { id: 'orders' as Page, label: 'Order to tasks', icon: ShoppingBag },
  { id: 'tasks' as Page, label: 'My tasks', icon: ListChecks },
  { id: 'assistant' as Page, label: 'AI assistant', icon: Sparkles },
]

function pageFromHash(): Page {
  const hash = window.location.hash.slice(1)
  return NAV.some((item) => item.id === hash) ? (hash as Page) : 'dashboard'
}

export default function App() {
  const [page, setPage] = useState<Page>(pageFromHash)
  const [mobileNav, setMobileNav] = useState(false)
  const helpDialog = useRef<HTMLDialogElement>(null)
  const health = useAction(api.health)
  const taskList = useAction(api.tasks)
  const tasks = taskList.data ?? []
  const offline = !!health.error
  const setTaskData = taskList.setData
  const refreshHealth = health.run
  const refreshTasks = taskList.run

  useEffect(() => {
    void refreshHealth()
    void refreshTasks()
  }, [refreshHealth, refreshTasks])
  useEffect(() => {
    const update = () => {
      setPage(pageFromHash())
      setMobileNav(false)
    }
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  useEffect(() => {
    document.title = `${NAV.find((item) => item.id === page)?.label} · BizPilot AI`
  }, [page])

  const navigate = (next: Page) => {
    setPage(next)
    window.location.hash = next
    setMobileNav(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const createTasks = useCallback(
    async (inputs: TaskInput[], signal?: AbortSignal) => {
      const result = await api.createTasks(inputs, signal)
      setTaskData((previous) => {
        const byId = new Map((previous ?? []).map((task) => [task.id, task]))
        for (const task of result.tasks) byId.set(task.id, task)
        return [...byId.values()]
      })
      return result
    },
    [setTaskData],
  )

  const updateTask = useCallback(
    async (id: string, status: TaskStatus) => {
      const updated = await api.updateTask(id, status)
      setTaskData((previous) => (previous ?? []).map((task) => (task.id === id ? updated : task)))
      return updated
    },
    [setTaskData],
  )

  const deleteTask = useCallback(
    async (id: string) => {
      await api.deleteTask(id)
      setTaskData((previous) => (previous ?? []).filter((task) => task.id !== id))
      return true
    },
    [setTaskData],
  )

  const statusLabel = health.loading
    ? 'Connecting…'
    : offline
      ? 'API offline'
      : health.data?.ai_configured
        ? 'Groq configured'
        : 'Local mode'

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main-content')?.focus()
        }}
      >
        Skip to content
      </a>
      {mobileNav && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
        <button className="brand" onClick={() => navigate('dashboard')} aria-label="BizPilot AI overview">
          <span className="brand-symbol">
            <Command size={23} strokeWidth={2.2} />
          </span>
          <span className="brand-wordmark">
            BizPilot<span>AI</span>
          </span>
        </button>
        <div className="workspace-switch">
          <span className="workspace-avatar">B</span>
          <div>
            <strong>My workspace</strong>
            <span>Your business workspace</span>
          </div>
        </div>
        <span className="nav-section-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`nav-link ${page === item.id ? 'active' : ''}`}
              aria-current={page === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
              title={item.label}
            >
              <item.icon size={19} strokeWidth={1.7} />
              <span>{item.label}</span>
              {item.id === 'tasks' && tasks.filter((task) => task.status !== 'done').length > 0 && (
                <b className="nav-count">{tasks.filter((task) => task.status !== 'done').length}</b>
              )}
              {page === item.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span>
              <Sparkles size={18} />
            </span>
            <h3>
              A helping hand,
              <br />
              not a helping headache.
            </h3>
            <p>Your everyday work, with a little more breathing room.</p>
            <button onClick={() => helpDialog.current?.showModal()}>
              Meet your workspace <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="help-link" onClick={() => helpDialog.current?.showModal()}>
            <CircleHelp size={18} />
            <span>Setup & help</span>
            <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-version">
            <span className="live-dot" />
            BizPilot AI <span>v1.0</span>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={mobileNav}
              onClick={() => setMobileNav(!mobileNav)}
            >
              {mobileNav ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{NAV.find((item) => item.id === page)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className={`connection-status ${offline ? 'offline' : health.data?.ai_configured ? 'connected' : 'local'}`}
              onClick={() => (offline ? void health.run() : helpDialog.current?.showModal())}
              disabled={health.loading}
            >
              {health.loading ? <RefreshCw size={12} className="spin" /> : <span className="live-dot" />}
              {statusLabel}
            </button>
            <span className="topbar-divider" />
            <span className="profile-avatar" title="Your local workspace">
              BP
            </span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="main-content">
          {offline && (
            <div className="connection-banner" role="alert">
              <span>Can’t reach the backend. Your saved tasks are safe on the server.</span>
              <button
                onClick={() => {
                  void health.run()
                  void taskList.run()
                }}
                disabled={health.loading}
              >
                {health.loading ? (
                  <Spinner label="Reconnecting…" />
                ) : (
                  <>
                    <RefreshCw size={14} /> Reconnect
                  </>
                )}
              </button>
            </div>
          )}
          <div hidden={page !== 'dashboard'}>
            <Dashboard
              tasks={tasks}
              loading={taskList.loading}
              error={taskList.error}
              onNavigate={navigate}
              onRefresh={() => void taskList.run()}
              aiConfigured={!!health.data?.ai_configured}
            />
          </div>
          <div hidden={page !== 'inbox'}>
            <Inbox disabled={offline || (taskList.loading && !taskList.data)} onCreateTask={createTasks} />
          </div>
          <div hidden={page !== 'orders'}>
            <Orders disabled={offline || (taskList.loading && !taskList.data)} onSaved={createTasks} />
          </div>
          <div hidden={page !== 'tasks'}>
            <Tasks
              tasks={tasks}
              loading={taskList.loading}
              error={taskList.error}
              disabled={offline || (taskList.loading && !taskList.data)}
              onRefresh={() => void taskList.run()}
              onCreate={createTasks}
              onUpdate={updateTask}
              onDelete={deleteTask}
            />
          </div>
          <div hidden={page !== 'assistant'}>
            <Assistant configured={!!health.data?.ai_configured} disabled={offline} />
          </div>
          <footer className="workspace-footer">
            <span>Thoughtful automation for everyday business.</span>
            <span>
              <ShieldCheck size={13} />
              You’re always in control.
            </span>
          </footer>
        </main>
      </div>
      <dialog
        ref={helpDialog}
        className="help-dialog"
        aria-labelledby="help-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) helpDialog.current?.close()
        }}
      >
        <div className="help-dialog-inner">
          <button
            className="icon-button dialog-close"
            aria-label="Close setup and help"
            onClick={() => helpDialog.current?.close()}
          >
            <X size={20} />
          </button>
          <span className="help-logo">
            <Command size={27} />
          </span>
          <span className="eyebrow">A LITTLE GUIDANCE</span>
          <h2 id="help-title">Make yourself at home.</h2>
          <p>BizPilot brings customer messages, reply drafts, and order tasks into one calm workspace.</p>
          <div className="help-step">
            <span>1</span>
            <div>
              <h3>Start with a message</h3>
              <p>
                Paste a customer message in the inbox, or try the built-in example. Analyze it, review the
                insights, and generate an editable reply.
              </p>
            </div>
          </div>
          <div className="help-step">
            <span>2</span>
            <div>
              <h3>Turn orders into next steps</h3>
              <p>
                Paste an order request, check the extracted details, and save selected tasks. Update their
                status in My tasks. Tasks persist in SQLite on the server.
              </p>
            </div>
          </div>
          <div className="help-step">
            <span>3</span>
            <div>
              <h3>Connect AI when you’re ready</h3>
              <p>
                Copy <code>backend/.env.example</code> to <code>backend/.env</code>, set{' '}
                <code>GROQ_API_KEY</code>, and restart the backend. “Groq configured” means a key is present,
                not that a paid request has been verified.
              </p>
            </div>
          </div>
          <div className="help-mode">
            <ShieldCheck size={20} />
            <p>
              <strong>No key? The core tools still work.</strong> Local mode uses English-language rules, not
              AI. AI features send submitted text and recent chat context to Groq. Don’t submit sensitive
              data. This is a single-workspace app without authentication; keep it local or add access
              controls before public deployment.
            </p>
          </div>
          <button className="button primary full-width" onClick={() => helpDialog.current?.close()}>
            <Check size={16} /> Got it, let’s go
          </button>
        </div>
      </dialog>
    </div>
  )
}
