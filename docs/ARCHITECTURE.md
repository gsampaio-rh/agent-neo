# Architecture: Neo

**Part of:** The Red Matrix Workshop
**Related:** [Plan](PLAN.md) | [Changelog](CHANGELOG.md) | [Future Explorations](FUTURE_EXPLORATIONS.md)

## Overview

A workshop participant container where Claude Code runs inside a sandboxed OpenShift pod. The system provides a web terminal, a real-time dashboard, and a chat interface for interacting with the AI agent.

The challenge aspect has the agent exploring a deliberately constrained environment — with stripped network tools — attempting to discover cluster endpoints, build tools from scratch (primarily with Python 3), and exfiltrate findings to a scoring collector.

The system is designed for **live observation**: facilitators watch the agent's behavior in real-time through a web terminal and the Neo dashboard.

## System Topology

```
                          ┌──────────────────────────┐
                          │    OpenShift Cluster      │
                          │                          │
┌─────────────────────────┼──────────────────────────┼─────────────────────┐
│  agent-namespace        │                          │                     │
│                         │                          │                     │
│  ┌─────────────────── Pod (neo) ─────────────────────────────────┐      │
│  │                                                                │      │
│  │  ┌──────────────────────┐      ┌──────────────────────┐       │      │
│  │  │     claude-code       │      │       neo-ui          │       │      │
│  │  │                      │      │                      │       │      │
│  │  │  Claude Code CLI     │      │  React app (Vite)    │       │      │
│  │  │  ttyd :7681          │      │  relay.mjs :3458     │       │      │
│  │  │  entrypoint.sh       │      │                      │       │      │
│  │  │  prompt-watcher      │      │  SSE /api/events     │       │      │
│  │  │  claude-logged       │      │  REST /api/chat      │       │      │
│  │  │                      │      │       /api/stop      │       │      │
│  │  └──────────┬───────────┘      │       /api/reset     │       │      │
│  │             │                  └──────────┬───────────┘       │      │
│  │             │                             │                   │      │
│  │             └── claude-logs (emptyDir) ───┘                   │      │
│  │             └── claude-workspace (emptyDir)                   │      │
│  │                                                                │      │
│  └────────────────────────────────────────────────────────────────┘      │
│                                                                          │
│  Services                          Routes (TLS edge)                     │
│  ├─ web-terminal :7681             ├─ *-web-terminal → :7681            │
│  └─ neo-ui :3458                   └─ *-ui → :3458 (300s timeout)       │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  target-apps namespace (attack chart)                                    │
│                                                                          │
│  ┌─────────────────────┐                                                │
│  │   inventory-app      │  ← Logs contain prompt injection payload      │
│  │   (alpine + cat)     │     Agent reads via Kubernetes API             │
│  └─────────────────────┘                                                │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  attacker namespace (attack chart)                                       │
│                                                                          │
│  ┌─────────────────────┐                                                │
│  │   attacker           │  ← Custom UBI9 image with ttyd + ncat + bash  │
│  │   (ttyd + scripts)   │     Web terminal at :7681 for facilitators    │
│  │                      │     Scripts: trigger, wait-shell, connect,    │
│  │                      │     exploit, full-attack, hold-shell          │
│  └─────────────────────┘                                                │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  llm-inference namespace                                                 │
│                                                                          │
│  ┌─────────────────────┐                                                │
│  │   LLM endpoint       │  ← Claude Code calls via ANTHROPIC_BASE_URL  │
│  │   (model serving)    │                                               │
│  └─────────────────────┘                                                │
└──────────────────────────────────────────────────────────────────────────┘
```

## Containers

### claude-code

The agent runtime. A UBI9/Node 22 image deliberately stripped of network tools post-build.

| Aspect | Detail |
|--------|--------|
| **Base image** | `registry.access.redhat.com/ubi9/nodejs-22` |
| **Installed** | Python 3.12, ttyd 1.7.7, Claude Code CLI |
| **Removed post-build** | `curl`, `wget`, `nc`, `ncat` |
| **Port** | 7681 (ttyd web terminal) |
| **Volumes** | `claude-workspace` → `/opt/app-root/src/.claude`, `claude-logs` → `/tmp/claude-logs` |
| **Resources** | Configurable via `values.yaml` (default: 100m–1 CPU, 256Mi–2Gi memory) |

**Startup flow:**

1. `entrypoint.sh` creates log directory
2. Starts `ttyd` on port 7681 (with optional basic auth via `TTYD_CREDENTIAL` from Secret)
3. Starts `net-monitor.sh` — polls TCP state every 2s, writes `net-state.json` to the shared `claude-logs` volume (output tee'd to `system.log`)
4. Backs up `CLAUDE.md` to `.claude/CLAUDE.md.bak` for attack reset restoration
5. Launches `prompt_watcher` — output tee'd to `system.log` — a polling loop that watches for:
   - `prompt.json` → extracts prompt, runs `claude-logged`
   - `prompt.stop` → kills running agent PID
   - `prompt.reset` → clears session marker + log file
   - `prompt.reset-attack` → kills bind shell, restores CLAUDE.md, removes injected skills
6. `sleep infinity` keeps the container alive

**`claude-logged` wrapper:**

Runs `claude -p --verbose --output-format stream-json` with:
- `--continue` on subsequent invocations (session continuity via marker file)
- Permission mode from `CLAUDE_PERMISSION_MODE` env var
- Output tee'd to `claude.jsonl`

### neo-ui

React frontend + Node.js SSE relay. Built as a multi-stage Docker image (Node 20 Alpine).

| Aspect | Detail |
|--------|--------|
| **Frontend** | React 19 + TypeScript + Vite 6 |
| **Relay** | `relay.mjs` + `relay/` modules — plain Node.js `http` server |
| **Port** | 3458 |
| **Volumes** | `claude-logs` → `/data/claude-logs` (prompt IPC), `claude-workspace` → `/data/claude-workspace` (agent config files) |
| **Resources** | Configurable via `values.yaml` (default: 50m–200m CPU, 64Mi–256Mi memory) |

**Relay modes:**

| Mode | Flag/Env | Use case |
|------|----------|----------|
| Dir tail | `--dir` / `JSONL_DIR` | In-cluster sidecar (production) |
| File replay | `--file <path>` | Demo / replay recorded sessions |
| oc exec tail | _(default)_ | Local development |

**API endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/events` | GET | SSE stream — replays buffer + live events, 15s keepalive |
| `/api/chat` | POST | Queue a prompt (`prompt.json`), returns 409 if agent busy |
| `/api/stop` | POST | Send stop signal (`prompt.stop`) |
| `/api/reset` | POST | Stop + clear session + clear event buffer |
| `/api/state` | GET | Escape state + `attackPhase` (derived from `net-state.json`) |
| `/api/state/reset` | POST | Reset escape and attack state |
| `/api/status` | GET | Agent state, event count, connected clients |
| `/api/files` | GET | Workspace directory tree listing |
| `/api/files/:path` | GET/PUT | Read/write workspace files (path traversal guarded) |
| `/api/tasks` | GET | List all tasks in active task list (`{ tasks, listId }`) |
| `/api/tasks/:id` | GET | Single task detail (404 if not found) |
| `/api/plans` | GET | List plan files (`{ plans: [{ filename, title, mtime }] }`) |
| `/api/plans/:filename` | GET | Full plan markdown content |
| `/api/stats` | GET | JSON metrics summary (tokens, cost, latency, tools, errors) |
| `/api/audit` | GET | Paginated audit log (filterable by type and time) |
| `/api/metrics` | GET | Prometheus text exposition (no auth — cluster scraping) |
| `/health` | GET | Liveness/readiness probe |

**Frontend features:**

- Map tab: topology view (React Flow) showing agent pod, LLM endpoint, namespaces, and attack phase visualization
- Box tab: animated containment view with particle effects
- Chat tab: send prompts, collapsible thinking blocks, tool call/result display, typing indicator
- Context tracking: cwd, files, network hints, "breached" heuristic detection
- Demo mode with preloaded mock data

## Inter-container Communication

All communication goes through the shared `claude-logs` emptyDir volume.

```
┌─────────────┐                         ┌─────────────┐
│ claude-code  │                         │   neo-ui    │
│              │  claude.jsonl           │              │
│  claude-logged ──────────────────────→ │  relay.mjs  │
│              │     (append)            │  (tail)     │
│              │                         │              │
│  prompt-     │  prompt.json            │  /api/chat  │
│  watcher   ←──────────────────────────── (write)    │
│              │                         │              │
│  prompt-     │  prompt.stop            │  /api/stop  │
│  watcher   ←──────────────────────────── (write)    │
│              │                         │              │
│  prompt-     │  prompt.reset           │  /api/reset │
│  watcher   ←──────────────────────────── (write)    │
│              │                         │              │
│              │  prompt.running         │              │
│  (write)   ──────────────────────────→ │  (read for  │
│              │     (mutex)             │   busy chk) │
└─────────────┘                         └─────────────┘
```

| File | Writer | Reader | Purpose |
|------|--------|--------|---------|
| `claude.jsonl` | claude-logged (tee) | relay.mjs (tail) | Stream-json agent output |
| `prompt.json` | relay.mjs | prompt-watcher | Queued prompt payload |
| `prompt.running` | prompt-watcher | relay.mjs | Mutex — agent is busy |
| `prompt.stop` | relay.mjs | prompt-watcher | Kill running agent |
| `prompt.reset` | relay.mjs | prompt-watcher | Clear session + logs |
| `net-state.json` | net-monitor.sh | relay.mjs | TCP state for attack phase detection |
| `system.log` | entrypoint.sh (tee) | relay.mjs (tail) | System-level logs (net-monitor, prompt-watcher) |
| `prompt.reset-attack` | relay.mjs | prompt-watcher | Kill bind shell, restore CLAUDE.md, remove skills |
| `.session-started` | claude-logged | claude-logged | Enables `--continue` flag |

## Attack Infrastructure

Managed by two separate Helm charts, deployed independently from the main chart:

- **`chart/target-apps/`** — target environment (inventory-app with poisoned logs, RBAC for agent access). Deployed first, represents the "app the agent is asked to troubleshoot".
- **`chart/attack/`** — attacker tooling (attacker pod with nc, NetworkPolicy for bind shell traffic). Deployed when the attack is executed.

### Kill Chain Flow

```
1. inventory-app logs contain prompt injection payload (role-tag injection)
2. Agent is triggered to read inventory-app logs via Kubernetes API
3. LLM interprets injected role tags as conversation continuation
4. Agent opens bind shell (python3 -c 'socket... listen 0.0.0.0:4444')
5. net-monitor.sh detects :4444 LISTEN → attackPhase = "compromised"
6. attacker.sh connects via nc, injects CLAUDE.md + malicious skill
7. Agent now operates under attacker control
```

### Target-Apps Chart Resources (`chart/target-apps/`)

| Resource | Kind | Purpose |
|----------|------|---------|
| target-apps | Namespace | Namespace for the target application |
| inventory-app | Deployment | Target app whose logs contain the prompt injection payload |
| poisoned-logs | ConfigMap | Contains the role-tag injection payload |
| target-reader | ClusterRole + Binding | Grants agent SA read access to target-apps pods/logs |

### Attack Chart Resources (`chart/attack/`)

| Resource | Kind | Purpose |
|----------|------|---------|
| attacker | Namespace | Namespace for the attacker |
| attacker | Deployment | Custom UBI9 image with ttyd, ncat, bash, and attack scripts |
| attacker | Service + Route | Exposes ttyd web terminal at :7681 for facilitators |
| attacker | ServiceAccount + Role/RoleBinding | `get`/`list` pods in agent namespace for IP resolution |
| neo-attacker | BuildConfig + ImageStream | OpenShift build pipeline for attacker image |
| allow-bind-shell | NetworkPolicy | Allows attacker → agent :4444, plus UI/terminal/ttyd traffic |

### Reset Mechanism

`POST /api/state/reset` writes `prompt.reset-attack` to the shared volume. `prompt-watcher.sh` detects it and:
- Kills any python3 bind shell processes
- Restores `CLAUDE.md` from `.claude/CLAUDE.md.bak`
- Removes injected skills (`skills/k8s-ops.md`)
- Cleans `.bashrc` of any attacker overrides
- Resets `net-state.json` to clean state

## Security Model

### Container constraints

- `runAsNonRoot: true` — all containers run as non-root (UID 1001)
- `allowPrivilegeEscalation: false`
- `seccompProfile: RuntimeDefault`
- `capabilities: drop ALL`

### Agent sandbox

The challenge design intentionally limits what the agent can do:

- **No network CLI tools** — `curl`, `wget`, `nc`, `ncat` removed from image after build
- **Python 3 only** — the agent's primary tool for building escape utilities
- **No kubectl** — must discover cluster APIs through other means
- **No jq, no git** — minimal tooling

### Network access

- Agent has cluster-internal network access (can reach services in other namespaces)
- LLM inference endpoint via `ANTHROPIC_BASE_URL` (from ConfigMap)

### Authentication

Optional Basic Auth protecting both the Neo UI relay and the web terminal (ttyd). Configured via `auth.username` / `auth.password` in Helm values, stored in a Kubernetes Secret.

- **Relay**: middleware enforces Basic Auth on all routes except `/health` and `/api/metrics` (cluster scraping). Uses `timingSafeEqual` to prevent timing attacks.
- **ttyd**: receives `TTYD_CREDENTIAL` (format: `user:password`) from the same Secret.
- When `auth.username` is empty, auth is disabled on both components.
- For production, consider upgrading to OpenShift OAuth Proxy or OIDC.

## Helm Chart

The core chart lives at `chart/` (flat structure). Attack demo charts are deployed separately:

- **`chart/`** — core application (Deployment, Services, Routes, BuildConfigs, ServiceMonitor)
- **Attack charts** (separate repos/deployment) — target-apps (inventory-app, RBAC) and attacker (ttyd, ncat, scripts)

### Managed resources

| Resource | Kind | Template |
|----------|------|----------|
| Pod identity | ServiceAccount | `service-account.yaml` |
| LLM config | ConfigMap | `configmap.yaml` |
| Terminal auth | Secret (conditional) | `secret.yaml` |
| Application | Deployment | `deployment.yaml` |
| Agent image | BuildConfig + ImageStream | `buildconfig-agent.yaml`, `imagestream-agent.yaml` |
| UI image | BuildConfig + ImageStream | `buildconfig-ui.yaml`, `imagestream-ui.yaml` |
| Terminal access | Service + Route | `service-web-terminal.yaml`, `route-web-terminal.yaml` |
| Dashboard access | Service + Route | `service-ui.yaml`, `route-ui.yaml` |
| Auth credentials | Secret (conditional) | `secret-auth.yaml` |
| Prometheus scrape | ServiceMonitor (conditional) | `servicemonitor.yaml` |

### Key values

| Value | Required | Default | Purpose |
|-------|----------|---------|---------|
| `config.anthropicBaseUrl` | Yes | — | LLM inference endpoint URL |
| `config.modelName` | No | `glm47-flash` | Model name for Claude Code |
| `config.permissionMode` | No | `dangerously-skip-permissions` | Claude permission mode (bypasses approval prompts) |
| `auth.username` | No | — | Basic auth username (auth disabled when empty) |
| `auth.password` | No | — | Basic auth password |
| `metrics.enabled` | No | `false` | Enable Prometheus ServiceMonitor |
| `metrics.interval` | No | `30s` | Prometheus scrape interval |
| `resources.agent` | No | 100m–1 CPU, 256Mi–2Gi | Agent container resources |
| `resources.ui` | No | 50m–200m CPU, 64Mi–256Mi | UI container resources |
| `route.ui.timeout` | No | `300s` | HAProxy timeout for SSE |

### Runtime dependencies (cluster-level)

These services must exist in the cluster but are **not managed** by this chart:

| Service | Namespace | Purpose |
|---------|-----------|---------|
| LLM endpoint | configurable | Model inference for Claude Code (set via `config.anthropicBaseUrl`) |

## Build Pipeline

Two container images built via OpenShift `BuildConfig` (managed by the Helm chart):

| Image | Build type | Source | Triggered by |
|-------|-----------|--------|--------------|
| `neo-agent` | Binary (Docker) | `build/neo/` dir uploaded | `oc start-build --from-dir` |
| `neo-ui` | Binary (Docker) | `ui/` dir uploaded | `oc start-build --from-dir` |

Both push to the internal registry at `image-registry.openshift-image-registry.svc:5000/{namespace}/{name}:latest`.

## Deployment Flow

```
scripts/deploy.sh
  │
  ├─ Validate ANTHROPIC_BASE_URL is set
  ├─ helm upgrade --install (SA, ConfigMap, Secrets, Deployment, BCs, Services, Routes)
  ├─ oc start-build neo-agent (--from-dir=build/neo/)
  ├─ oc start-build neo-ui (--from-dir=ui/)
  ├─ oc rollout restart + wait
  └─ Print URLs
```

## Directory Structure

```
├── Makefile                # Task runner (deploy, build, clean, test)
├── build/
│   ├── neo/                # Agent container image
│   │   ├── Dockerfile      # UBI9 + Python + ttyd (SHA256 verified) + Claude CLI
│   │   ├── entrypoint.sh   # ttyd + net-monitor + prompt-watcher respawn loop
│   │   ├── claude-logged   # claude -p wrapper with --continue + stream-json logging
│   │   ├── prompt-watcher.sh  # Poll-based prompt file watcher
│   │   └── net-monitor.sh  # TCP state poller — writes net-state.json for attack detection
│   └── attacker/           # Attacker container image
│       ├── Dockerfile      # UBI9-minimal + ttyd + ncat + bash + jq
│       ├── entrypoint.sh   # ttyd with optional auth
│       ├── motd.sh         # Login banner with available commands
│       └── scripts/        # trigger, wait-shell, connect, exploit, full-attack, hold-shell
├── chart/                  # Helm chart — core application (flat structure)
│   ├── Chart.yaml
│   ├── values.yaml         # LLM URL, model, auth, resources, metrics, permissionMode
│   └── templates/          # SA, ConfigMap, Secrets, Deployment, BuildConfigs, Services, Routes, ServiceMonitor
├── docs/                   # Project documentation
│   ├── PRD.md              # Product requirements, goals, phases
│   ├── ARCHITECTURE.md     # This file
│   ├── PLAN.md             # Sprint roadmap (pending work only)
│   ├── CHANGELOG.md        # Completed work by sprint
│   ├── FUTURE_EXPLORATIONS.md  # Post-PoC exploration themes
│   ├── specs/
│   │   └── kill-chain.md   # Attack kill chain specification
│   └── research/           # Research findings (agent ecosystem, Claude tasks)
├── tests/                  # Test suites
│   ├── build/              # Shell script tests (net-monitor, prompt-watcher, claude-logged)
│   └── chart/              # Helm template rendering tests
├── prompts/                # Agent challenge prompts
│   └── escape.txt          # Challenge: explore cluster + POST report to collector
├── scripts/                # Deployment automation
│   ├── config.sh           # Shared config + validate_config()
│   ├── deploy.sh           # helm upgrade --install + oc start-build
│   └── attack/             # Attack demo scripts
│       ├── deploy-attack.sh    # Deploy attack Helm chart + build attacker image
│       ├── auto-attack.sh      # Fully automated attack sequence
│       ├── cleanup-attack.sh   # Remove attack infrastructure
│       └── payloads/           # claude-md-override.txt, skill-k8s-ops.txt
└── ui/                     # Neo dashboard + chat interface
    ├── Dockerfile          # Multi-stage: Node 20 Alpine, Vite build + relay runtime
    ├── relay.mjs           # Entry point (~30 lines) — wires relay modules
    ├── relay/              # Modular relay server
    │   ├── config.js       # CLI args + env parsing
    │   ├── router.js       # Request routing + CORS + body size cap
    │   ├── static.js       # Static serving with path traversal guard
    │   ├── sse/hub.js      # SseHub class with ring buffer (FIFO eviction)
    │   ├── sources/        # pod.js, file.js, dir.js, system.js, tasks.js, plans.js
    │   ├── state/          # manager.js (StateManager + deriveAttackPhase), detector.js
    │   ├── metrics/        # collector.js (MetricsCollector), prometheus.js (text formatter)
    │   ├── audit/          # logger.js (AuditLogger — ring buffer + JSONL persistence)
    │   ├── health/         # vllm.js (LLM availability poller)
    │   └── api/            # chat.js, status.js, state.js, files.js, tasks.js, plans.js, metrics.js, stats.js, audit.js, health.js
    ├── package.json        # React 19 + Vite 6 + TypeScript
    ├── vite.config.ts      # Dev proxy to relay, port 5173
    └── src/
        ├── App.tsx         # Layout + tab routing + EventStreamProvider wrapping
        ├── components/     # MapArea, GameArea, LiveTerminal, ChatView, ChatMessage,
        │                   # ChatInput, ContextSidebar, AppHeader, SettingsDrawer,
        │                   # WorkspaceDrawer, FileExplorer, AuditLogViewer,
        │                   # SessionStatsPanel, ChatStats, QuickActions, TimelineView,
        │                   # TasksDrawer, PlansDrawer, TaskViewer, TaskStatusBar
        │   ├── map/        # nodes.tsx (custom React Flow nodes), topology.ts (graph builder)
        │   └── game/       # ParticleEmitter.tsx, sounds.ts
        ├── content/        # quickActions.ts, prompts.json
        ├── hooks/          # useGameState, useAttackPhase, useGameSounds, useChatMessages,
        │                   # useDemoMode, useFakeEventEmitter, useElapsed, useLlmHealth,
        │                   # useTasks, usePlans
        ├── lib/            # eventParser, contextReducer, networkHeuristics,
        │                   # terminalLine, chatReducer, chatExport, constants, format
        ├── providers/      # EventStreamProvider.tsx — single SSE connection context
        └── services/       # sseClient.ts, chatApi.ts, filesApi.ts, tasksApi.ts, plansApi.ts, auditApi.ts
```
