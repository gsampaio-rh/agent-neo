# Plan: Neo

**Status:** Active
**Date:** 2026-04-30
**Related:** [Architecture](ARCHITECTURE.md) | [Changelog](CHANGELOG.md)

---

## Neo UI Enhancements

Remaining improvements: reliable stop, unified reset, and expandable log details. Completed items (expandable logs, timeline view, unified fake event stream, chat stats/KPIs, export chat) moved to [CHANGELOG.md](CHANGELOG.md).

```
Progress: [######....] 60%
```

### Expandable Log Details — DONE

Moved to [CHANGELOG.md](CHANGELOG.md).

### Reliable Agent Stop

Current stop sends SIGTERM to `claude-logged` (bash wrapper) but the `claude` child in the pipeline may continue. Also, `prompt.stop` doesn't dequeue a pending `prompt.json`.

- [ ] In `prompt-watcher.sh` stop handler: also `rm -f "$LOG_DIR/prompt.json"` to dequeue pending prompts
- [ ] Launch `claude-logged` with `setsid` so `kill -- -$PID` can kill the entire process group
- [ ] Add `pkill -f "claude -p"` fallback in the stop handler
- [ ] Add `--max-turns` flag to `claude-logged` as a safety limit (configurable via env var `CLAUDE_MAX_TURNS`)

### Unified Reset

Merge `prompt.reset` (session only) and `prompt.reset-attack` (attack cleanup) into a single reset. One button, one handler, full cleanup.

- [ ] Merge `prompt.reset-attack` block into `prompt.reset` in `prompt-watcher.sh` — session truncation + bind shell kill + CLAUDE.md restore + skill removal
- [ ] Remove the separate `prompt.reset-attack` handler
- [ ] Add `stateManager.reset()` call in relay's `handleReset` so `escaped` flag clears on reset
- [ ] Update `prompt-watcher-attack-reset.test.sh` to test the merged handler

### Reset Loading State — DONE

Moved to [CHANGELOG.md](CHANGELOG.md).

### vLLM Health Check — DONE

Moved to [CHANGELOG.md](CHANGELOG.md).

---

## Authentication

Login/password protection for both neo-ui and web terminal.

```
Progress: [##########] 100%
```

- [x] Add `auth.username` and `auth.password` to Helm `values.yaml`
- [x] Create conditional Kubernetes Secret template for auth credentials
- [x] Add Basic Auth middleware to relay router (all routes except `/health`)
- [x] Wire TTYD `--credential` from the same Secret into agent container
- [x] UI: browser-native Basic Auth prompt (no custom login page for MVP)
- [x] Document upgrade path to OpenShift OAuth proxy / OIDC

---

## Claude Code Config Management via UI

New API endpoints in relay + new UI pages for managing Claude Code configuration.

```
Progress: [..........] 0%
```

### File management API

New relay endpoints reading/writing files on the shared `claude-sessions` volume:

```
GET    /api/files/:path    # Read file content
PUT    /api/files/:path    # Write/create file
DELETE /api/files/:path    # Delete file
GET    /api/files          # List directory tree
```

- [ ] Add read-write mount of `claude-sessions` volume to neo-ui container
- [ ] Implement `GET /api/files` — directory tree listing
- [ ] Implement `GET /api/files/:path` — read file content
- [ ] Implement `PUT /api/files/:path` — write/create file
- [ ] Implement `DELETE /api/files/:path` — delete file
- [ ] Add path traversal guard on file API

### Config editors

| File | UI Feature | Description |
|------|-----------|-------------|
| `CLAUDE.md` | Rich text editor | Project instructions for Claude |
| `skills/*.md` | CRUD list + editor | Skill definitions |
| `rules/*.md` | CRUD list + editor | Rule definitions |
| `settings.json` | Structured form | Claude Code settings (permissions, model, etc.) |

- [ ] `CLAUDE.md` editor page (markdown editor)
- [ ] Skills management page (list + create/edit/delete `skills/*.md`)
- [ ] Rules management page (list + create/edit/delete `rules/*.md`)
- [ ] Settings editor page (structured form for `settings.json`)

### .claude folder explorer

- [x] File tree component showing the full `.claude/` directory (read-only drawer)
- [x] REST file API in relay (`GET /api/files`, `GET /api/files/:path`)
- [x] Volume rename `claude-sessions` → `claude-workspace`, mount in neo-ui
- [x] Local dev mode: fake workspace files seeded by `make dev`
- [ ] Edit files in-browser (write API exists in relay, wire to UI)
- [ ] Upload/download files

### Settings drawer refactor

- [x] Replace "System Prompt" section with `CLAUDE.md` content (fetched from `/api/files/CLAUDE.md`)
- [x] Remove "Objective" field (no longer relevant)
- [x] Rename "Available Tools" → "Skills" (show skills from `/api/files` tree under `skills/`)
- [x] Replace "Sandbox" with Environment info (model, namespace, pod name, permission mode)
- [x] Remove "Connection" section (URL input + Connect button)
- [x] Remove "Run Demo" button
- [x] Delete `AgentConfig` interface and `DEFAULT_CONFIG` — drawer fetches everything live
- [x] Update tests

### Markdown rendering for agent messages

Agent responses contain markdown (headers, bold, lists, code blocks, etc.) but are currently rendered as plain text in the chat view. Need to render them with proper formatting.

- [x] Add a lightweight markdown renderer (`react-markdown` + `remark-gfm`)
- [x] Apply to assistant messages in `ChatView` / message bubbles
- [x] Style rendered markdown (headers, code blocks, lists, bold/italic, tables) to match the Neo theme
- [x] Ensure code blocks have monospace font and subtle background

---

## Multi-Agent, MCP/Tools, RAG

```
Progress: [..........] 0%
```

### Multi-agent toggle

- [ ] Add UI toggle for multi-agent mode
- [ ] Map toggle to `--multi-agent` flag in `claude-logged` wrapper
- [ ] Expose as `CLAUDE_MULTI_AGENT=true|false` env var in ConfigMap

### MCP/Tools management

- [ ] UI to manage `.claude/settings.json` → `mcpServers` section
- [ ] Add/remove/configure MCP server entries (name, command, args, env)
- [ ] Add/remove allowed/disallowed tools
- [ ] Structured form with live JSON preview

### RAG management

- [ ] UI to manage Claude Code's built-in context/RAG features
- [ ] Configure which directories/files are indexed
- [ ] Manage `.claude/settings.json` → context/memory settings
- [ ] Upload reference documents to the agent container

---

## Monitoring, Metrics, and Observability

```
Progress: [..........] 0%
```

### Agent metrics

Instrument relay and event stream to extract agent-level metrics:

- [ ] Extract token counts (input/output) from `stream-json` result events
- [ ] Track response time (prompt-to-completion latency)
- [ ] Count tool calls by name, success/failure rate
- [ ] Track agent errors (crashes, permission denials, timeouts)
- [ ] Session stats (prompts per session, total sessions, active time)
- [ ] Expose `GET /api/metrics` — Prometheus-compatible text format
- [ ] Expose `GET /api/stats` — JSON summary for UI dashboard

### Infrastructure metrics

- [ ] Add `ServiceMonitor` to Helm chart (opt-in via `metrics.enabled`)
- [ ] Configure scraping of relay `/api/metrics` endpoint
- [ ] Add custom metrics labels: `release`, `namespace`, `component`

### Audit log

Persistent log of all user and system actions:

- [ ] Define audit event schema (login, prompts, config changes, start/stop/reset)
- [ ] Write audit events to `audit.jsonl` on shared volume
- [ ] Implement `GET /api/audit` — paginated, filterable by event type and time range
- [ ] Build audit log viewer page in UI with filters and search
- [ ] Add configurable retention (max size / rotation via `values.yaml`)

### Session history

Record and replay past agent sessions:

- [ ] Each `claude-logged` invocation produces a timestamped JSONL file
- [ ] Implement `GET /api/sessions` — list past sessions (timestamp, prompt, duration, tokens)
- [ ] Implement `GET /api/sessions/:id/events` — SSE replay of specific session
- [ ] Build session list page + replay viewer in UI
- [ ] Add configurable retention (max sessions, max age)

### Monitoring dashboard

New Dashboard tab in the UI:

- [ ] Real-time agent status panel (idle/running/error, current prompt, elapsed)
- [ ] Usage charts (tokens over time, response latency histogram, tool call breakdown)
- [ ] Resource gauges (CPU/memory from Prometheus or Kubernetes metrics API)
- [ ] Session timeline (visual timeline of past sessions with outcomes)
- [ ] Add charting library (`recharts` or `chart.js` via `react-chartjs-2`)

### Alerting

OpenShift/Prometheus alerting rules via Helm chart `PrometheusRule`:

| Alert | Condition | Severity |
|-------|-----------|----------|
| `NeoAgentDown` | Pod not ready for > 5 min | critical |
| `NeoAgentStuck` | Agent running > 30 min without output | warning |
| `NeoAgentHighErrorRate` | > 50% tool calls failing in 10 min window | warning |
| `NeoAgentEscapeDetected` | Outbound HTTP detected | info |
| `NeoHighTokenUsage` | > N tokens in 1 hour | warning |

- [ ] Add `PrometheusRule` template to Helm chart
- [ ] Make thresholds configurable via `values.yaml` → `alerting.rules`
- [ ] Opt-in via `alerting.enabled` (default: false)
