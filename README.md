# Neo

Workshop participant container — a Claude Code agent control panel running on OpenShift. Each participant gets a sandboxed pod with a web terminal, an AI agent, and a real-time dashboard.

Part of **The Red Matrix Workshop**.

## Architecture

```
┌────────────────────── OpenShift Pod ──────────────────────┐
│                                                            │
│  ┌──────────────┐                    ┌──────────────┐      │
│  │  claude-code  │                    │    neo-ui     │      │
│  │              │                    │              │      │
│  │ Claude Code  │                    │ React app +  │      │
│  │ CLI + ttyd   │                    │ SSE relay    │      │
│  └──────┬───┬───┘                    └──────┬───┬───┘      │
│         │   │                               │   │          │
│         │   └── claude-workspace (emptyDir) ─┘   │          │
│         │          (~/.claude ↔ file browser)    │          │
│         │                                        │          │
│         └────── claude-logs (emptyDir) ──────────┘          │
│                  (JSONL stream + prompt IPC)                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

- **claude-code**: Runs Claude Code CLI in a stripped-down UBI9 container (no curl, wget, nc). The agent starts with only Python 3 as an "escape tool". Exposes a web terminal via ttyd.
- **neo-ui**: React dashboard + Node.js SSE relay. Serves the UI, relays JSONL logs via SSE, provides chat interface, file browser, metrics, and audit logging.

### Shared volumes

| Volume | claude-code mount | neo-ui mount | Purpose |
|---|---|---|---|
| `claude-logs` | `/tmp/claude-logs` | `/data/claude-logs` | Agent JSONL output + prompt IPC files |
| `claude-workspace` | `/opt/app-root/src/.claude` (`~/.claude`) | `/data/claude-workspace` | Agent config, tasks, settings (exposed via file browser) |

### Inter-container communication

| File | Writer | Reader | Purpose |
|---|---|---|---|
| `claude.jsonl` | claude-logged | relay (tail) | Stream-json agent output |
| `system.log` | entrypoint.sh | relay (tail) | System logs (net-monitor, prompt-watcher) |
| `prompt.json` | relay | prompt-watcher | Queued prompt payload |
| `prompt.running` | prompt-watcher | relay | Mutex — agent is busy |
| `prompt.stop` | relay | prompt-watcher | Kill running agent |
| `prompt.reset` | relay | prompt-watcher | Clear session + logs |
| `prompt.reset-attack` | relay | prompt-watcher | Kill bind shell, restore CLAUDE.md |
| `net-state.json` | net-monitor.sh | relay | TCP state for attack phase detection |

## Features

- **Chat interface** — send prompts, view real-time responses with collapsible thinking blocks, tool call/result display, typing indicator, stop/reset controls
- **Web terminal** — direct shell access to the agent container (ttyd)
- **File browser** — view and edit agent config files (`CLAUDE.md`, `settings.json`, skills) via the workspace drawer
- **Session stats** — token usage, cost, latency, tool call counts
- **Metrics & observability** — Prometheus-compatible `/api/metrics` endpoint, JSON `/api/stats`, optional `ServiceMonitor` for cluster monitoring
- **Audit log** — persistent log of all user/system actions with UI viewer and API
- **Basic auth** — optional username/password protecting the UI and API
- **Attack visualization** — map tab showing cluster topology and attack phase progression
- **Demo mode** — preloaded mock data for offline demos

## Structure

```
├── Makefile               # Task runner: make deploy, dev, test, clean
├── build/                 # Agent container image
│   ├── Dockerfile         # UBI9 + Python 3.12 + ttyd + Claude CLI (network tools stripped)
│   ├── entrypoint.sh      # ttyd + net-monitor + prompt-watcher respawn loop
│   ├── claude-logged      # claude -p wrapper with --continue + stream-json
│   ├── prompt-watcher.sh  # Poll-based prompt file watcher
│   └── net-monitor.sh     # TCP state poller for attack detection
├── chart/                 # Helm chart (flat structure)
│   ├── Chart.yaml
│   ├── values.yaml        # LLM URL, model, auth, resources, metrics config
│   └── templates/         # Deployment, Services, Routes, BuildConfigs, ServiceMonitor
├── docs/                  # Project documentation
│   ├── ARCHITECTURE.md    # Detailed system topology and component docs
│   ├── PLAN.md            # Sprint roadmap
│   └── CHANGELOG.md       # Completed work log
├── tests/                 # Test suites
│   ├── build/             # Shell script tests (prompt-watcher, net-monitor, etc.)
│   ├── helm/              # Helm template rendering tests
│   └── scripts/           # Deploy script tests
├── scripts/               # Deployment automation
│   ├── config.sh          # Shared config + validate_config()
│   └── deploy.sh          # helm upgrade --install + oc start-build + rollout
├── prompts/               # Agent system prompts
│   └── escape.txt         # Challenge: explore cluster + POST findings
└── ui/                    # Neo dashboard (React + Vite) + SSE relay (Node.js)
    ├── Dockerfile         # Multi-stage: Node 20 Alpine, Vite build + relay
    ├── relay.mjs          # Entry point — wires relay modules
    ├── relay/             # Modular relay server
    │   ├── config.js      # CLI args + env parsing
    │   ├── router.js      # Request routing + auth middleware
    │   ├── sse/hub.js     # SSE hub with ring buffer
    │   ├── sources/       # Event stream sources (dir, file, pod, system)
    │   ├── state/         # State manager + attack phase detector
    │   ├── metrics/       # MetricsCollector + Prometheus formatter
    │   ├── audit/         # AuditLogger (ring buffer + JSONL persistence)
    │   ├── health/        # vLLM health poller
    │   └── api/           # REST handlers (chat, status, state, files, metrics, stats, audit)
    └── src/               # React frontend
        ├── components/    # ChatView, GameArea, MapArea, LiveTerminal, FileExplorer,
        │                  # WorkspaceDrawer, AuditLogViewer, SessionStatsPanel, etc.
        ├── hooks/         # useGameState, useChatMessages, useAttackPhase, useDemoMode
        ├── lib/           # eventParser, chatReducer, contextReducer, networkHeuristics
        ├── providers/     # EventStreamProvider (single SSE connection)
        └── services/      # sseClient, chatApi, filesApi, auditApi
```

## Prerequisites

- OpenShift cluster with `oc` CLI authenticated
- [Helm 3](https://helm.sh/docs/intro/install/)
- A namespace (default: `agent-namespace`)
- An LLM inference endpoint accessible from the cluster

### Configuration

Set required variables in a `.env` file at the project root or export them:

```bash
ANTHROPIC_BASE_URL=https://your-llm-endpoint/v1   # Required
MODEL_NAME=glm47-flash                            # Optional (default: glm47-flash)
NAMESPACE=agent-namespace                         # Optional (default: agent-namespace)
```

Key `values.yaml` settings:

| Value | Purpose |
|---|---|
| `config.anthropicBaseUrl` | LLM inference endpoint (required) |
| `config.modelName` | Model name for Claude Code |
| `auth.username` / `auth.password` | Basic auth for UI + web terminal |
| `metrics.enabled` | Enable Prometheus ServiceMonitor |
| `metrics.interval` | Scrape interval (default: 30s) |

## Deploy

```bash
make deploy
# or directly:
./scripts/deploy.sh
```

This will:
1. Install the Helm chart (SA, ConfigMap, Secret, Deployment, BuildConfigs, Services, Routes)
2. Build the `neo-agent` container image (binary build from `build/`)
3. Build the `neo-ui` image (binary build from `ui/`)
4. Restart the deployment and wait for rollout

## Local Development

```bash
make dev
```

Starts the relay + Vite dev server locally (no cluster needed). Creates a `.dev-data/` directory with mock files. The UI is available at `http://localhost:5173`.

Other targets:

```bash
make test          # Run all tests (UI + relay + Helm + scripts)
make test-ui       # Vitest (React components + hooks)
make test-relay    # Node test runner (relay modules)
make test-helm     # Helm template assertions
make dev-relay     # Relay only (tails .dev-data/claude.jsonl)
make dev-ui        # Vite dev server only
```

## Usage

After deployment, two routes are created:

- **Web terminal** — direct shell access to the agent container (ttyd)
- **Neo dashboard** — real-time UI with multiple tabs:
  - **Chat** — send prompts, watch responses, stop/reset the agent
  - **Map** — cluster topology visualization with attack phase indicators
  - **Box** — animated containment view with particle effects
  - **Settings** — file browser (edit CLAUDE.md, settings), audit log viewer

## API Endpoints

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/events` | GET | Yes | SSE stream (buffer replay + live) |
| `/api/chat` | POST | Yes | Queue a prompt |
| `/api/stop` | POST | Yes | Stop running agent |
| `/api/reset` | POST | Yes | Reset session + clear buffer |
| `/api/status` | GET | Yes | Agent state, event count, clients |
| `/api/stats` | GET | Yes | JSON metrics summary |
| `/api/audit` | GET | Yes | Paginated audit log |
| `/api/state` | GET | Yes | Escape/attack state |
| `/api/files` | GET | Yes | Workspace file tree |
| `/api/files/:path` | GET/PUT | Yes | Read/write workspace files |
| `/api/metrics` | GET | No | Prometheus text exposition |
| `/health` | GET | No | Liveness/readiness probe |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — detailed system topology, containers, security model, attack infrastructure
- [Plan](docs/PLAN.md) — sprint roadmap and pending work
- [Changelog](docs/CHANGELOG.md) — completed work by sprint

## License

Internal — Red Hat workshop material.
