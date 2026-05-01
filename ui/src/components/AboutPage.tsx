export function AboutPage() {
  return (
    <div className="about-page">
      <section className="about-page__section">
        <h2 className="about-page__heading">Neo</h2>
        <p className="about-page__text">
          A sandbox CTF challenge where an AI agent attempts to escape a
          locked-down container. Neo provides a real-time dashboard to observe
          the agent's actions, thinking process, and network activity as it
          explores its environment and attempts to reach an external endpoint.
        </p>
      </section>

      <section className="about-page__section">
        <h2 className="about-page__heading">Architecture</h2>
        <pre className="about-page__diagram">{ARCHITECTURE_DIAGRAM}</pre>
        <p className="about-page__text">
          Two containers share a volume for communication. The <strong>agent
          container</strong> runs Claude Code inside a hardened environment
          with no outbound network tools (curl, wget, nc removed).
          The <strong>UI container</strong> runs the SSE relay and serves
          the React dashboard.
        </p>
      </section>

      <section className="about-page__section">
        <h2 className="about-page__heading">How It Works</h2>

        <h3 className="about-page__subheading">Prompt Flow</h3>
        <pre className="about-page__flow">{PROMPT_FLOW}</pre>

        <h3 className="about-page__subheading">Event Flow</h3>
        <pre className="about-page__flow">{EVENT_FLOW}</pre>
      </section>

      <section className="about-page__section">
        <h2 className="about-page__heading">Agent Container</h2>
        <ul className="about-page__list">
          <li><strong>claude-logged</strong> — Wrapper that runs Claude Code with <code>--continue</code> for session persistence, tees structured JSONL output</li>
          <li><strong>prompt-watcher</strong> — State machine that polls for prompt files and manages the agent lifecycle (start, stop, reset)</li>
          <li><strong>ttyd</strong> — Web terminal providing browser access to the container shell</li>
          <li>Network tools stripped: no curl, wget, nc — the agent must build its own</li>
          <li>gcc, python3 available — enough to craft HTTP clients from raw sockets</li>
        </ul>
      </section>

      <section className="about-page__section">
        <h2 className="about-page__heading">UI Container</h2>
        <ul className="about-page__list">
          <li><strong>SSE Relay</strong> — Node.js server that tails JSONL logs and broadcasts events via Server-Sent Events</li>
          <li><strong>Chat API</strong> — REST endpoints for sending prompts, stopping, and resetting the agent</li>
          <li><strong>React Dashboard</strong> — Real-time visualization with map view, chat interface, and context tracking</li>
          <li>SSE Hub with ring buffer (FIFO eviction), replay on reconnect</li>
          <li>Path traversal protection on static file serving</li>
        </ul>
      </section>

      <section className="about-page__section">
        <h2 className="about-page__heading">Tech Stack</h2>
        <div className="about-page__stack">
          <StackItem label="Agent Runtime" value="Claude Code CLI" />
          <StackItem label="Container Base" value="Debian (agent) / Alpine (UI)" />
          <StackItem label="Frontend" value="React 19 + TypeScript + Vite" />
          <StackItem label="Backend" value="Node.js (built-in HTTP, no framework)" />
          <StackItem label="Streaming" value="Server-Sent Events (SSE)" />
          <StackItem label="Orchestration" value="Helm chart on OpenShift / Kubernetes" />
          <StackItem label="Web Terminal" value="ttyd" />
          <StackItem label="Testing" value="Vitest + RTL (UI), Node test runner (relay), bash (infra)" />
        </div>
      </section>

      <section className="about-page__section about-page__section--footer">
        <p className="about-page__text about-page__text--dim">
          Built for the Agents Matrix 2026 workshop — Red Hat
        </p>
      </section>
    </div>
  );
}

function StackItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="about-page__stack-item">
      <span className="about-page__stack-label">{label}</span>
      <span className="about-page__stack-value">{value}</span>
    </div>
  );
}

const ARCHITECTURE_DIAGRAM = `
┌─────────────────────────────────────────────────────────────────┐
│  OpenShift / Kubernetes Cluster                                 │
│                                                                 │
│  ┌──────────────────────┐       ┌──────────────────────┐        │
│  │   neo-agent (pod)     │       │   neo-ui (pod)        │        │
│  │                      │       │                      │        │
│  │  ┌────────────────┐  │       │  ┌────────────────┐  │        │
│  │  │  Claude Code    │  │       │  │  SSE Relay      │  │        │
│  │  │  (claude-logged)│──┼──┐    │  │  (relay.mjs)    │──┼──→ UI │
│  │  └────────────────┘  │  │    │  └────────────────┘  │        │
│  │  ┌────────────────┐  │  │    │  ┌────────────────┐  │        │
│  │  │ prompt-watcher  │  │  │    │  │  React App      │  │        │
│  │  │ (state machine) │  │  │    │  │  (dashboard)    │  │        │
│  │  └────────────────┘  │  │    │  └────────────────┘  │        │
│  │  ┌────────────────┐  │  │    │                      │        │
│  │  │  ttyd           │  │  │    └──────────────────────┘        │
│  │  │  (web terminal) │  │  │                                    │
│  │  └────────────────┘  │  │                                    │
│  └──────────────────────┘  │    ┌──────────────────────┐        │
│                            └───→│  Shared Volume        │        │
│                                 │  claude.jsonl         │        │
│                                 │  prompt.json / .stop  │        │
│                                 └──────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘`;

const PROMPT_FLOW = `
  User (browser)
    │
    ▼
  POST /api/chat ──→ relay writes prompt.json
    │                      │
    │                      ▼
    │                prompt-watcher detects file
    │                      │
    │                      ▼
    │                claude-logged "$PROMPT"
    │                      │
    │                      ▼
    │                claude -p --output-format stream-json
    │                      │
    │                      ▼
    │                tee -a claude.jsonl
    │
    ▼
  Events stream back via SSE`;

const EVENT_FLOW = `
  claude.jsonl (append)
    │
    ▼
  relay tails file (fs.watch + poll)
    │
    ▼
  SseHub.broadcast(line)
    │
    ├──→ Client A (SSE)
    ├──→ Client B (SSE)
    └──→ Ring buffer (replay on reconnect)`;
