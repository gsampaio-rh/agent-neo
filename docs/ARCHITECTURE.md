# Architecture: Neo

**Part of:** The Red Matrix Workshop

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
│  │             └── claude-sessions (emptyDir)                    │      │
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
│  │   attacker pod       │  ← Connects to agent bind shell :4444         │
│  │   (busybox + nc)     │     Injects CLAUDE.md + malicious skill       │
│  └─────────────────────┘                                                │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  monitoring-system namespace                                             │
│                                                                          │
│  ┌─────────────────────┐                                                │
│  │     collector        │  ← Agent POSTs findings here                  │
│  │  :5000/collect       │     (scoring endpoint)                        │
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
| **Volumes** | `claude-sessions` → `/opt/app-root/src/.claude`, `claude-logs` → `/tmp/claude-logs` |
| **Resources** | Configurable via `values.yaml` (default: 100m–1 CPU, 256Mi–2Gi memory) |

**Startup flow:**

1. `entrypoint.sh` creates log directory, starts `tail -F` on `claude.jsonl`
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
| **Volume** | `claude-logs` → `/data/claude-logs` (read + write for prompt files) |
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
| attacker | Namespace | Namespace for the attacker pod |
| attacker | Pod | busybox pod with nc for connecting to bind shell |
| allow-bind-shell | NetworkPolicy | Allows attacker → agent :4444, plus UI/terminal traffic |

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
- Scoring target: `http://collector.monitoring-system.svc:5000/collect`

### Web terminal auth

Optional basic auth on ttyd via a Kubernetes Secret. Set `ttyd.credential` in `values.yaml` or `TTYD_CREDENTIAL` env var (format: `user:password`). When not set, ttyd runs without authentication.

## Helm Chart

Three Helm charts under `chart/`, each with its own lifecycle:

- **`chart/neo/`** — core application (Deployment, Services, Routes, BuildConfigs)
- **`chart/target-apps/`** — target environment for attack demo
- **`chart/attack/`** — attacker tooling for attack demo

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

### Key values

| Value | Required | Default | Purpose |
|-------|----------|---------|---------|
| `config.anthropicBaseUrl` | Yes | — | LLM inference endpoint URL |
| `config.modelName` | No | `glm47-flash` | Model name for Claude Code |
| `config.permissionMode` | No | `dangerously-skip-permissions` | Claude permission mode (bypasses approval prompts) |
| `ttyd.credential` | No | — | Basic auth for web terminal (`user:password`) |
| `resources.agent` | No | 100m–1 CPU, 256Mi–2Gi | Agent container resources |
| `resources.ui` | No | 50m–200m CPU, 64Mi–256Mi | UI container resources |
| `route.ui.timeout` | No | `300s` | HAProxy timeout for SSE |

### Runtime dependencies (cluster-level)

These services must exist in the cluster but are **not managed** by this chart:

| Service | Namespace | Purpose |
|---------|-----------|---------|
| LLM endpoint | configurable | Model inference for Claude Code (set via `config.anthropicBaseUrl`) |
| Collector | monitoring-system | Scoring endpoint for exfiltrated data |

## Build Pipeline

Two container images built via OpenShift `BuildConfig` (managed by the Helm chart):

| Image | Build type | Source | Triggered by |
|-------|-----------|--------|--------------|
| `neo-agent` | Binary (Docker) | `build/` dir uploaded | `oc start-build --from-dir` |
| `neo-ui` | Binary (Docker) | `ui/` dir uploaded | `oc start-build --from-dir` |

Both push to the internal registry at `image-registry.openshift-image-registry.svc:5000/{namespace}/{name}:latest`.

## Deployment Flow

```
scripts/02-deploy.sh
  │
  ├─ Validate ANTHROPIC_BASE_URL is set
  ├─ helm upgrade --install (SA, ConfigMap, Secret, Deployment, BCs, Services, Routes)
  ├─ oc start-build neo-agent (--from-dir=build/)
  ├─ oc start-build neo-ui (--from-dir=ui/)
  ├─ oc rollout restart + wait
  └─ Print URLs
```

## Directory Structure

```
├── Makefile                # Task runner (deploy, build, clean, test)
├── build/                  # Agent container image
│   ├── Dockerfile          # UBI9 + Python + ttyd (SHA256 verified) + Claude CLI
│   ├── entrypoint.sh       # ttyd + net-monitor + prompt-watcher respawn loop + log streaming
│   ├── claude-logged       # claude -p wrapper with --continue + stream-json logging
│   ├── prompt-watcher.sh   # Poll-based prompt file watcher (extracted from entrypoint)
│   └── net-monitor.sh      # TCP state poller — writes net-state.json for attack detection
├── chart/
│   ├── neo/                # Helm chart — core application
│   │   ├── Chart.yaml
│   │   ├── values.yaml     # LLM URL, model, resources, TTYD auth, permissionMode
│   │   └── templates/      # SA, ConfigMap, Secret, Deployment, BuildConfigs, Services, Routes
│   ├── target-apps/        # Helm chart — target environment (attack demo)
│   │   ├── Chart.yaml
│   │   ├── values.yaml     # Agent namespace/SA, target namespace
│   │   ├── files/payload.txt  # Prompt injection payload (role-tag injection)
│   │   └── templates/      # Namespace, inventory-app, ConfigMap, RBAC
│   └── attack/             # Helm chart — attacker tooling (attack demo)
│       ├── Chart.yaml
│       ├── values.yaml     # Agent namespace, attacker image, bind port
│       └── templates/      # Namespace, attacker pod, NetworkPolicy
├── docs/                   # Project documentation
│   ├── ARCHITECTURE.md     # This file
│   ├── CHANGELOG.md        # Completed work by sprint
│   ├── PLAN.md             # Sprint roadmap
│   └── specs/
│       └── kill-chain.md   # Attack kill chain specification (source of truth)
├── tests/                  # Test suites
│   ├── build/              # Shell script tests (net-monitor, prompt-watcher, claude-logged)
│   └── chart/              # Helm template rendering tests
├── prompts/                # Agent challenge prompts
│   └── escape.txt          # Challenge: explore cluster + POST report to collector
├── scripts/                # Deployment automation
│   ├── config.sh           # Shared config + validate_config()
│   ├── 01-build-image.sh   # Standalone agent image rebuild
│   ├── 02-deploy.sh        # helm upgrade --install + oc start-build
│   ├── 03-test-escape.sh   # Run challenge + check collector
│   ├── 99-cleanup.sh       # helm uninstall
│   └── attack/             # Attack demo scripts
│       ├── deploy-attack.sh    # Deploy attack Helm chart
│       ├── attacker.sh         # Connect to bind shell, inject payloads (base64)
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
    │   ├── sources/        # pod.js, file.js, dir.js, system.js — event stream sources
    │   ├── state/          # manager.js (StateManager + deriveAttackPhase), detector.js
    │   └── api/            # chat.js, status.js, state.js, health.js — REST handlers
    ├── package.json        # React 19 + Vite 6 + TypeScript
    ├── vite.config.ts      # Dev proxy to relay, port 5173
    └── src/
        ├── App.tsx         # Layout + tab routing + EventStreamProvider wrapping
        ├── components/     # MapArea, GameArea, LiveTerminal, ChatView, ChatMessage,
        │                   # ChatInput, ContextSidebar, AppHeader, SettingsDrawer
        │   ├── map/        # nodes.tsx (custom React Flow nodes), topology.ts (graph builder)
        │   └── game/       # ParticleEmitter.tsx, sounds.ts
        ├── content/        # agentConfig.ts — agent configuration defaults
        ├── hooks/          # useGameState, useAttackPhase, useGameSounds, useChatMessages, useDemoMode
        ├── lib/            # eventParser, contextReducer, networkHeuristics,
        │                   # terminalLine, chatReducer, constants, demoData
        ├── providers/      # EventStreamProvider.tsx — single SSE connection context
        └── services/       # sseClient.ts, chatApi.ts — typed API layer
```
