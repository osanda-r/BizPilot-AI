import { useCallback, useEffect, useState } from "react";
import "./App.css";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const initialDashboard = {
  stats: {
    total_tasks: 0,
    completed_tasks: 0,
    pending_tasks: 0,
    messages_processed: 0,
  },
  tasks: [],
  messages: [],
};

const navItems = [
  { icon: "◫", label: "Overview" },
  { icon: "✉", label: "Messages" },
  { icon: "✓", label: "Tasks" },
  { icon: "▣", label: "Orders" },
  { icon: "◷", label: "Appointments" },
  { icon: "⌘", label: "Automation" },
];

function StatusBadge({ status }) {
  const className = status.toLowerCase().replace(/\s+/g, "-");

  return (
    <span className={`status-badge ${className}`}>
      <span className="status-dot" />
      {status}
    </span>
  );
}

function App() {
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [apiStatus, setApiStatus] = useState("checking");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeNav, setActiveNav] = useState("Overview");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [healthResponse, dashboardResponse] = await Promise.all([
        fetch(`${API_URL}/api/health`),
        fetch(`${API_URL}/api/dashboard`),
      ]);

      if (!healthResponse.ok || !dashboardResponse.ok) {
        throw new Error("The API returned an error.");
      }

      const healthData = await healthResponse.json();
      const dashboardData = await dashboardResponse.json();

      setDashboard(dashboardData);
      setApiStatus(healthData.status === "healthy" ? "online" : "offline");
      setLastUpdated(new Date());
    } catch {
      setApiStatus("offline");
      setError(
        "Cannot connect to the backend. Check that FastAPI is running on port 8000.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const stats = [
    {
      label: "Total tasks",
      value: dashboard.stats.total_tasks,
      icon: "✓",
      note: "All tracked tasks",
      color: "blue",
    },
    {
      label: "Completed",
      value: dashboard.stats.completed_tasks,
      icon: "↗",
      note: "Successfully finished",
      color: "green",
    },
    {
      label: "Pending tasks",
      value: dashboard.stats.pending_tasks,
      icon: "◷",
      note: "Awaiting action",
      color: "orange",
    },
    {
      label: "Messages processed",
      value: dashboard.stats.messages_processed,
      icon: "✉",
      note: "Across your workflow",
      color: "purple",
    },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}>
          <span className="brand-mark">A</span>
          <span>
            <strong>AgentDesk</strong>
            <small>BUSINESS AUTOMATION</small>
          </span>
        </a>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="navigation" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${activeNav === item.label ? "active" : ""}`}
              onClick={() => setActiveNav(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.label === "Messages" && (
                <span className="nav-count">{dashboard.messages.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">✦</div>
            <strong>Your AI workspace</strong>
            <p>Manage repetitive work from one place.</p>
          </div>
          <div className="profile">
            <div className="avatar">OA</div>
            <div className="profile-info">
              <strong>Workspace Admin</strong>
              <span>Administrator</span>
            </div>
            <span className="profile-menu">···</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> {activeNav}
          </div>

          <div className="topbar-actions">
            <span className={`api-indicator ${apiStatus}`}>
              <span className="status-dot" />
              API {apiStatus}
            </span>
            <button
              className="icon-button"
              onClick={loadDashboard}
              disabled={loading}
              aria-label="Refresh dashboard"
              title="Refresh dashboard"
            >
              ↻
            </button>
            <div className="top-avatar">OA</div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow">YOUR BUSINESS AT A GLANCE</div>
              <h1>
                {activeNav === "Overview" ? "Good to see you" : activeNav}
                <span className="heading-period">.</span>
              </h1>
              <p className="page-subtitle">
                Here's what's happening across your business today.
              </p>
            </div>

            <button
              className="primary-button"
              onClick={() => setActiveNav("Tasks")}
            >
              <span>＋</span> View tasks
            </button>
          </section>

          {error && (
            <div className="error-banner" role="alert">
              <span>!</span>
              <div>
                <strong>Backend connection failed</strong>
                <p>{error}</p>
              </div>
              <button onClick={loadDashboard}>Retry</button>
            </div>
          )}

          <section className="stats-grid" aria-label="Business statistics">
            {stats.map((stat) => (
              <article className="stat-card" key={stat.label}>
                <div className="stat-card-top">
                  <span className="stat-label">{stat.label}</span>
                  <span className={`stat-icon ${stat.color}`}>{stat.icon}</span>
                </div>
                <div className="stat-value">
                  {loading ? "—" : stat.value.toLocaleString()}
                </div>
                <div className="stat-note">{stat.note}</div>
              </article>
            ))}
          </section>

          <section className="section-heading">
            <div>
              <h2>Work overview</h2>
              <p>Keep track of the work that needs your attention.</p>
            </div>
            <button
              className="text-button"
              onClick={() => setActiveNav("Tasks")}
            >
              View all tasks <span>→</span>
            </button>
          </section>

          <section className="content-grid">
            <article className="panel tasks-panel">
              <div className="panel-heading">
                <div>
                  <h3>Recent tasks</h3>
                  <p>Your latest business activities</p>
                </div>
                <span className="panel-symbol">✓</span>
              </div>

              {loading ? (
                <div className="empty-state">Loading tasks...</div>
              ) : dashboard.tasks.length === 0 ? (
                <div className="empty-state">No tasks available.</div>
              ) : (
                <div className="task-list">
                  {dashboard.tasks.map((task) => (
                    <div className="task-row" key={task.id}>
                      <div className="task-check">
                        {task.status === "Completed" ? "✓" : ""}
                      </div>
                      <div className="task-details">
                        <strong>{task.title}</strong>
                        <span>{task.category}</span>
                      </div>
                      <div className="task-meta">
                        <span
                          className={`priority priority-${task.priority.toLowerCase()}`}
                        >
                          {task.priority}
                        </span>
                        <StatusBadge status={task.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                className="panel-footer-button"
                onClick={() => setActiveNav("Tasks")}
              >
                Open task manager <span>→</span>
              </button>
            </article>

            <article className="panel messages-panel">
              <div className="panel-heading">
                <div>
                  <h3>Customer messages</h3>
                  <p>Messages waiting in your workspace</p>
                </div>
                <span className="panel-symbol purple-symbol">✉</span>
              </div>

              {loading ? (
                <div className="empty-state">Loading messages...</div>
              ) : dashboard.messages.length === 0 ? (
                <div className="empty-state">No messages available.</div>
              ) : (
                <div className="message-list">
                  {dashboard.messages.map((message) => (
                    <div className="message-row" key={message.id}>
                      <div className="message-avatar">
                        {message.customer
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div className="message-details">
                        <strong>{message.customer}</strong>
                        <span>{message.subject}</span>
                        <small>{message.time}</small>
                      </div>
                      <span
                        className={`message-status ${
                          message.status === "Draft ready" ? "draft-ready" : ""
                        }`}
                      >
                        {message.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <button
                className="panel-footer-button"
                onClick={() => setActiveNav("Messages")}
              >
                Open inbox <span>→</span>
              </button>
            </article>
          </section>

          <section className="automation-banner">
            <div className="automation-art">✳</div>
            <div className="automation-copy">
              <span>WORK SMARTER</span>
              <h2>Let AI handle the repetitive work.</h2>
              <p>Your workspace is ready for its first intelligent workflow.</p>
            </div>
            <button
              className="secondary-button"
              onClick={() => setActiveNav("Automation")}
            >
              Explore automation <span>→</span>
            </button>
          </section>

          <footer className="page-footer">
            <span>AI Business Agent · Workspace</span>
            <span>
              {lastUpdated
                ? `Last synced at ${lastUpdated.toLocaleTimeString()}`
                : "Waiting for connection"}
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
