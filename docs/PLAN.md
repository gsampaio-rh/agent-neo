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
Progress: [######....] 60%
```

### Agent metrics — DONE

Moved to [CHANGELOG.md](CHANGELOG.md).

### Infrastructure metrics — DONE

Moved to [CHANGELOG.md](CHANGELOG.md).

### Audit log — DONE

Moved to [CHANGELOG.md](CHANGELOG.md).

### Escape the Box activity (revisit)

The "escape the box" challenge currently has no way to be triggered from the Neo UI. The attack infrastructure (`chart/target-apps/`, `chart/attack/`) was removed from the chart structure but the agent-side code (`prompt.reset-attack`, `net-monitor.sh`, attack phase detection) still exists. Need to revisit how this activity is started, monitored, and reset.

- [ ] Determine how to trigger the escape challenge from the UI (button? auto-prompt? separate deploy step?)
- [ ] Review if `prompts/escape.txt` is still used and how it gets injected into the agent
- [ ] Clarify if target-apps and attack charts still exist elsewhere or need to be recreated
- [ ] Ensure the Map tab attack phase visualization still works end-to-end
- [ ] Document the full facilitator workflow: deploy target → trigger challenge → observe → reset

### Claude Code task integration

Research and integrate Claude Code's native task system (`~/.claude/tasks/`) into Neo.

- [ ] Research: what conditions enable task creation (env var `CLAUDE_CODE_TASK_LIST_ID`, version >= v2.1.16, `CLAUDE_CODE_ENABLE_TASKS`)
- [ ] Research: confirm task file path inside our container (`/opt/app-root/src/.claude/tasks/` = volume `claude-workspace`)
- [ ] Research: determine if tasks appear in the `claude.jsonl` stream as `TaskCreate`/`TaskUpdate` tool-use events
- [ ] Research: investigate `~/.claude/projects/` folder (session JSONL logs, `sessions-index.json`, custom titles, slugs, project paths)
- [ ] Research: investigate `~/.claude/plans/` folder (what gets stored there, format, lifecycle)
- [ ] Research: investigate `~/.claude/sessions/` folder (session metadata, how it relates to projects/)
- [ ] Decide approach: watch task files on disk (chokidar on `/data/claude-workspace/tasks/`) vs. parse tool-use events from JSONL
- [ ] Expose task state via API: `GET /api/tasks` (list), `GET /api/tasks/:id` (detail)
- [ ] Build task viewer component in UI (Kanban or list view with status + dependencies)
- [ ] Configure agent container: set `CLAUDE_CODE_TASK_LIST_ID` env var in deployment (so tasks persist across sessions)

### Tasks & Plans UI

Design and implement the UI for viewing agent tasks and plans alongside the existing chat and file browser.

**Layout — top-right icon bar (beside the existing folder icon):**

- [ ] Add a "tasks" icon (checklist/clipboard) next to the folder icon in the top-right header
- [ ] Add a "plans" icon (map/lightbulb) next to the tasks icon
- [ ] Icons open a drawer/panel (similar to WorkspaceDrawer) showing the respective content
- [ ] Hover on task icon shows a tooltip preview: task count + active task name
- [ ] Hover on plans icon shows tooltip: plan title or "No active plan"

**Icon animations:**

- [ ] Task icon pulses/glows when a task status changes (new task created, status update)
- [ ] Plans icon animates when a new plan is created
- [ ] Subtle badge/dot on icons when there's activity the user hasn't seen
- [ ] Idle state: gentle breathing animation to signal availability

**Chat integration — task status bar above the text input:**

- [ ] Compact horizontal bar above the chat input showing current task progress
- [ ] Format: mini progress indicator + active task `activeForm` text (e.g., "Writing tests — 2/5 done")
- [ ] Clicking the bar opens the full task panel
- [ ] Bar hides when no tasks are active
- [ ] Transitions animate smoothly (slide in/out, progress fill)

**Task panel content:**

- [ ] List view with status badges (pending = gray, in_progress = yellow/pulse, completed = green)
- [ ] Show dependency arrows or indentation (blockedBy relationship)
- [ ] Active task highlighted with `activeForm` text
- [ ] Completed tasks show checkmark with strikethrough

**Plans panel content:**

- [ ] List of plan files (title from `# Plan:` header)
- [ ] Click to expand and read full plan content (markdown rendered)
- [ ] Most recent plan shown first

### Agent environment variable audit

Review Claude Code's full environment variable reference and identify variables that should be configured in the `claude-code` container for better performance, security, and observability. Current deployment only sets `ANTHROPIC_BASE_URL` and `MODEL_NAME`.

Candidates to evaluate:

- [ ] `CLAUDE_CODE_ENABLE_TASKS=1` — enable task tracking in `-p` mode (needed for task integration above)
- [ ] `CLAUDE_CODE_ENABLE_TELEMETRY` + OTEL vars — pipe agent OTel traces/metrics to cluster collector
- [ ] `BASH_DEFAULT_TIMEOUT_MS` / `BASH_MAX_TIMEOUT_MS` — tune agent command timeouts for workshop context
- [ ] `API_TIMEOUT_MS` — increase if LLM proxy is slow
- [ ] `CLAUDE_CODE_MAX_OUTPUT_TOKENS` — control output length vs context budget
- [ ] `MAX_THINKING_TOKENS` / `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` — tune thinking budget for cost control
- [ ] `CLAUDE_CODE_EFFORT_LEVEL` — set effort level (low/medium/high) to balance speed vs thoroughness
- [ ] `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` — reduce noise (autoupdater, telemetry, error reporting)
- [ ] `DISABLE_AUTOUPDATER` / `DISABLE_UPDATES` — prevent self-updates in container
- [ ] `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` — security: strip credentials from subprocesses
- [ ] `CLAUDE_CODE_SKIP_PROMPT_HISTORY=1` — ephemeral sessions: skip writing history to disk
- [ ] `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` — evaluate if background tasks make sense in our headless mode
- [ ] `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT` — shorter prompt for faster first-token
- [ ] `CLAUDE_CODE_GLOB_TIMEOUT_SECONDS` — tune for container filesystem
- [ ] `DISABLE_PROMPT_CACHING` — evaluate caching behavior with our proxy
- [ ] `CLAUDE_CODE_AUTO_COMPACT_WINDOW` / `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` — tune compaction for long sessions
- [ ] Document selected vars in `values.yaml` with comments and add to deployment template
- [ ] Test performance/cost impact of key vars (effort level, thinking tokens, timeouts)

### Framework-agnostic agent support

Neo currently only supports Claude Code as its agent backend. Explore how to make the platform framework-agnostic so it can host different agentic frameworks (OpenClaw, Hermes, OpenCode, DeepAgents, or custom agents) with minimal changes.

See [agent-ecosystem-comparison.md](research/agent-ecosystem-comparison.md) for research on each framework's execution model, IPC, and context patterns.

**Agent abstraction layer:**

- [ ] Define a common Agent Interface contract: how the relay communicates with any agent (prompt in, stream out, stop, reset)
- [ ] Identify the minimal IPC protocol that works across frameworks (JSONL stream? stdout? file-based? gRPC?)
- [ ] Design a plugin/adapter model: each agent framework gets an adapter that translates its native output into Neo's SSE event format
- [ ] Determine which features are framework-specific vs. universal (tasks, plans, memory, tools)

**Container abstraction:**

- [ ] Factor the `claude-code` container into a generic "agent sidecar" pattern with a well-defined interface
- [ ] Define the volume contract: what shared volumes an agent must mount and what files it must produce
- [ ] Create a `values.yaml` config for selecting the agent framework (`agent.type: claude-code | openclaw | hermes | opencode | custom`)
- [ ] Support custom agent images via `agent.image` + `agent.command` overrides

**Relay adaptations:**

- [ ] Abstract `sources/dir.js` to handle different output formats (not just Claude's JSONL)
- [ ] Make `MetricsCollector` framework-aware (different agents report tokens/cost differently)
- [ ] Make task integration optional and pluggable (Claude has `tasks/`, others don't)
- [ ] Define a generic "agent capabilities" manifest that the UI reads to enable/disable features

**UI flexibility:**

- [ ] Show/hide UI features based on agent capabilities (tasks panel only if agent supports tasks, plans panel only if agent writes plans)
- [ ] Agent-specific settings in the workspace drawer (CLAUDE.md for Claude, SOUL.md for OpenClaw, etc.)
- [ ] Generic tool call visualization that works across frameworks

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
