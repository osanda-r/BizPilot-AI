import { useState, type FormEvent } from "react";
import "./App.css";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI Business Assistant. How can I help?",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = input.trim();
    if (!message || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: message }]);

    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const data: { reply: string } = await response.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">✦</div>
          <div>
            <h2>Business Agent</h2>
            <span>AI Workspace</span>
          </div>
        </div>

        <div className="navigation">
          <div className="nav-item active">✦ AI Assistant</div>
          <div className="nav-item">▦ Dashboard</div>
          <div className="nav-item">☷ Tasks (Soon)</div>
          <div className="nav-item">▤ Documents (Soon)</div>
        </div>

        <div className="sidebar-footer">Lesson 01 · AI Chat Integration</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>AI Business Assistant</h1>
            <p>Your intelligent business workspace</p>
          </div>
          <span className="status">● AI Ready</span>
        </header>

        <section className="chat-container">
          <div className="messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.role}`}>
                <div className="avatar">
                  {msg.role === "assistant" ? "✦" : "U"}
                </div>
                <div className="bubble">{msg.content}</div>
              </div>
            ))}

            {loading && (
              <div className="typing">AI is generating a response...</div>
            )}
          </div>

          <form className="composer" onSubmit={sendMessage}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your AI business assistant..."
              disabled={loading}
            />
            <button type="submit" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default App;
