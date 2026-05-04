# Plan: Neo

**Status:** Sprint 4 (in progress)
**Date:** 2026-05-02
**Last updated:** 2026-05-04
**Related:** [Architecture](ARCHITECTURE.md) | [Changelog](CHANGELOG.md) | [Future Explorations](FUTURE_EXPLORATIONS.md)

Conventions: `[ ]` = pending | `[!]` = blocked | **Gate** = required criterion

---

## Sprint 4 — Reliability & Agent Intelligence

Harden agent lifecycle (stop/reset), tune the agent container environment, integrate Claude Code's native task and plan systems.

```
Progress: [####......] 40%
```

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

### ~~Agent Environment Variable Audit~~

Moved to its own sprint — see [Sprint 4b](#sprint-4b--agent-environment-tuning).

### ~~Claude Code Task Integration~~ ✓

Done — see [Changelog](CHANGELOG.md#tasks--plans-integration).

### ~~Tasks & Plans UI~~ ✓

Done — see [Changelog](CHANGELOG.md#tasks--plans-integration).

---

## Sprint 4b — Agent Environment Tuning

Configure Claude Code's environment variables for the workshop context. The container currently only sets `ANTHROPIC_BASE_URL` and `MODEL_NAME` — the agent runtime has dozens of knobs that affect performance, cost, security, and behavior.

```
Progress: [##........] 20%
```

### Cost & Performance

Control token budget, thinking time, and latency:

- [ ] `CLAUDE_CODE_MAX_OUTPUT_TOKENS` — control output length vs context budget
- [ ] `MAX_THINKING_TOKENS` / `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` — tune thinking budget for cost control
- [ ] `CLAUDE_CODE_EFFORT_LEVEL` — set effort level (low/medium/high)
- [ ] `API_TIMEOUT_MS` — increase if LLM proxy is slow
- [ ] `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT` — shorter prompt for faster first-token
- [ ] `DISABLE_PROMPT_CACHING` — evaluate caching behavior with our proxy

### Execution Safety

Timeouts, subprocess isolation, and session hygiene:

- [ ] `BASH_DEFAULT_TIMEOUT_MS` / `BASH_MAX_TIMEOUT_MS` — tune agent command timeouts
- [ ] `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` — strip API keys (ANTHROPIC_API_KEY, AWS creds, etc.) from subprocess env; **caveat:** may force permission mode to `default` and reject `--dangerously-skip-permissions` — verify compatibility
- [ ] `CLAUDE_CODE_SKIP_PROMPT_HISTORY=1` — ephemeral sessions: skip writing history to disk
- [ ] `CLAUDE_CODE_GLOB_TIMEOUT_SECONDS` — tune for container filesystem

### Noise Reduction & Container Hardening

Disable features that don't make sense in a sandboxed headless pod:

- [ ] `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` — reduce noise (autoupdater, telemetry, error reporting)
- [ ] `DISABLE_AUTOUPDATER` / `DISABLE_UPDATES` — prevent self-updates in container
- [ ] `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` — evaluate if background tasks make sense in headless mode

### Observability

Wire agent telemetry into the cluster's monitoring stack. Claude Code supports three OTEL signals: **metrics**, **log events**, and **traces** (beta). Current approach: Prometheus exporter for metrics (no collector needed). Full OTEL pipeline (collector + Loki + Tempo) is a future exploration — see [Future Explorations](FUTURE_EXPLORATIONS.md#exploration-d--full-opentelemetry-pipeline).

- [x] `CLAUDE_CODE_ENABLE_TASKS=1` — enable task tracking in `-p` mode (already done via Helm)
- [x] `CLAUDE_CODE_ENABLE_TELEMETRY` + OTEL vars — Helm chart wired with conditional rendering (metrics/logs/traces exporters, OTLP endpoint, export intervals, tool detail logging)
- [x] Set `metricsExporter: "prometheus"` and expose Prometheus scrape port from `claude-code` container — deployed (Helm rev 30)
- [x] Add ServiceMonitor (or PodMonitor) to scrape Claude Code's Prometheus metrics endpoint — `servicemonitor-agent.yaml` + `service-agent-metrics.yaml`
- [x] Create Grafana dashboard for agent metrics (tokens, cost, sessions, tool usage) — lives in `matrix-iac`

### Context & Session Management

Tune compaction and context window for long-running workshop sessions:

- [ ] `CLAUDE_CODE_AUTO_COMPACT_WINDOW` / `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` — tune compaction for long sessions

### Delivery

- [ ] Document selected vars in `values.yaml` with comments and add to deployment template
- [ ] Test performance/cost impact of key vars (effort level, thinking tokens, timeouts)

---

## Sprint 5 — Config & File Management

Complete the file management UX: in-browser editing, upload/download, and structured editors for Claude Code config files.

```
Progress: [..........] 0%
```

### File Editing in Browser

The relay already has `PUT /api/files/:path` implemented. Wire it to the UI.

- [ ] Add edit mode to file viewer in `FileExplorer.tsx` (toggle read-only → editable textarea)
- [ ] Wire save action to `PUT /api/files/:path`
- [ ] Add unsaved changes indicator + confirm-before-close
- [ ] Upload files from local machine to workspace
- [ ] Download files from workspace to local machine

### Config Editors

Structured editors for Claude Code configuration files:

| File | UI Feature | Description |
|------|-----------|-------------|
| `CLAUDE.md` | Rich text editor | Project instructions for Claude |
| `skills/*.md` | CRUD list + editor | Skill definitions |
| `rules/*.md` | CRUD list + editor | Rule definitions |
| `settings.json` | Structured form | Claude Code settings (permissions, model, etc.) |

- [ ] `CLAUDE.md` editor page (markdown editor with preview)
- [ ] Skills management page (list + create/edit/delete `skills/*.md`)
- [ ] Rules management page (list + create/edit/delete `rules/*.md`)
- [ ] Settings editor page (structured form for `settings.json`)

---

## Sprint 6 — Multi-Agent & Session History

Extend the platform beyond single-agent mode with session recording and replay.

```
Progress: [..........] 0%
```

### Multi-Agent Toggle

- [ ] Add UI toggle for multi-agent mode
- [ ] Map toggle to `--multi-agent` flag in `claude-logged` wrapper
- [ ] Expose as `CLAUDE_MULTI_AGENT=true|false` env var in ConfigMap

### MCP/Tools Management

- [ ] UI to manage `.claude/settings.json` → `mcpServers` section
- [ ] Add/remove/configure MCP server entries (name, command, args, env)
- [ ] Add/remove allowed/disallowed tools
- [ ] Structured form with live JSON preview

### RAG Management

- [ ] UI to manage Claude Code's built-in context/RAG features
- [ ] Configure which directories/files are indexed
- [ ] Manage `.claude/settings.json` → context/memory settings
- [ ] Upload reference documents to the agent container

### Session History

Record and replay past agent sessions:

- [ ] Each `claude-logged` invocation produces a timestamped JSONL file
- [ ] Implement `GET /api/sessions` — list past sessions (timestamp, prompt, duration, tokens)
- [ ] Implement `GET /api/sessions/:id/events` — SSE replay of specific session
- [ ] Build session list page + replay viewer in UI
- [ ] Add configurable retention (max sessions, max age)

---

## Sprint 7 — Escape the Box (revisit)

Revisit the "escape the box" challenge. The Map tab and the escape mechanic are **not necessarily coupled** — the map shows network topology (bind shell state), but the "escape" concept could be broader (data exfiltration, privilege escalation, etc.). Need to decide whether they remain tied together or become independent features.

```
Progress: [####......] 40%
```

### Escape Activity Integration

The challenge has no way to be triggered from the Neo UI. Agent-side code (`prompt.reset-attack`, `net-monitor.sh`, attack phase detection) exists, but the chart pieces for target-apps/attack are deployed separately.

- [ ] Revisit the relationship between Map tab visualization and escape mechanic — decouple or redesign
- [ ] Determine how to trigger the escape challenge from the UI (button? auto-prompt? separate deploy step?)
- [ ] Review if `prompts/escape.txt` is still used and how it gets injected into the agent
- [ ] Clarify if target-apps and attack charts still exist elsewhere or need to be recreated
- [ ] Ensure the Map tab attack phase visualization still works end-to-end
- [ ] Document the full facilitator workflow: deploy target → trigger challenge → observe → reset

### ~~Dev Mode Toggles~~ ✓

Done — see [Changelog](CHANGELOG.md#dev-mode-map-toggles).

---

## Sprint 8 — Monitoring Dashboard & Alerting

Full observability dashboard for facilitators and automated alerting.

```
Progress: [..........] 0%
```

### Monitoring Dashboard

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

---

## Sprint 9 — About Page Redesign

Revisit the About page design — information architecture, UI/UX, and visual presentation.

```
Progress: [..........] 0%
```

- [ ] Audit current About page content (architecture diagram, prompt/event flow, tech stack)
- [ ] Define information hierarchy: what matters most to a first-time viewer vs. a returning user
- [ ] Redesign layout — consider sections, cards, interactive diagrams, or scroll-based narrative
- [ ] Visual polish: typography, spacing, color, illustrations
- [ ] Add links to source code, documentation, and related resources
- [ ] Mobile/responsive considerations
- [ ] Accessibility review (heading structure, contrast, screen reader flow)

---

## ~~Sprint 10 — Agent Persona & Interactive Onboarding~~ ✓

Done — see [Changelog](CHANGELOG.md#agent-persona--interactive-onboarding).

Achievements & Badges deferred — milestone infrastructure (`useMilestones`) exists but visual badge UI and achievement toasts are not yet built. See [Future Explorations](FUTURE_EXPLORATIONS.md).

---

## ~~Sprint 11 — Map Layout & Node Positioning~~ ✓

Done — see [Changelog](CHANGELOG.md#map-layout--node-positioning).

---

## ~~Sprint 12 — Onboarding Experience~~ ✓

Done — see [Changelog](CHANGELOG.md#onboarding-experience).
