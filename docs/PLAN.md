# Plan: Neo

**Status:** Sprint 4 (in progress)
**Date:** 2026-05-02
**Last updated:** 2026-05-02
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

### Agent Environment Variable Audit

Review Claude Code's environment variable reference and configure the `claude-code` container for the workshop context. Current deployment only sets `ANTHROPIC_BASE_URL` and `MODEL_NAME`.

- [ ] `CLAUDE_CODE_ENABLE_TASKS=1` — enable task tracking in `-p` mode (needed for task integration)
- [ ] `CLAUDE_CODE_ENABLE_TELEMETRY` + OTEL vars — pipe agent OTel traces/metrics to cluster collector
- [ ] `BASH_DEFAULT_TIMEOUT_MS` / `BASH_MAX_TIMEOUT_MS` — tune agent command timeouts
- [ ] `API_TIMEOUT_MS` — increase if LLM proxy is slow
- [ ] `CLAUDE_CODE_MAX_OUTPUT_TOKENS` — control output length vs context budget
- [ ] `MAX_THINKING_TOKENS` / `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` — tune thinking budget for cost control
- [ ] `CLAUDE_CODE_EFFORT_LEVEL` — set effort level (low/medium/high)
- [ ] `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` — reduce noise (autoupdater, telemetry, error reporting)
- [ ] `DISABLE_AUTOUPDATER` / `DISABLE_UPDATES` — prevent self-updates in container
- [ ] `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` — strip credentials from subprocesses
- [ ] `CLAUDE_CODE_SKIP_PROMPT_HISTORY=1` — ephemeral sessions: skip writing history to disk
- [ ] `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` — evaluate if background tasks make sense in headless mode
- [ ] `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT` — shorter prompt for faster first-token
- [ ] `CLAUDE_CODE_GLOB_TIMEOUT_SECONDS` — tune for container filesystem
- [ ] `DISABLE_PROMPT_CACHING` — evaluate caching behavior with our proxy
- [ ] `CLAUDE_CODE_AUTO_COMPACT_WINDOW` / `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` — tune compaction for long sessions
- [ ] Document selected vars in `values.yaml` with comments and add to deployment template
- [ ] Test performance/cost impact of key vars (effort level, thinking tokens, timeouts)

### ~~Claude Code Task Integration~~ ✓

Done — see [Changelog](CHANGELOG.md#tasks--plans-integration).

### ~~Tasks & Plans UI~~ ✓

Done — see [Changelog](CHANGELOG.md#tasks--plans-integration).

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

## Sprint 7 — Monitoring Dashboard & Alerting

Full observability dashboard for facilitators and automated alerting.

```
Progress: [..........] 0%
```

### Escape the Box Activity (revisit)

The "escape the box" challenge has no way to be triggered from the Neo UI. Agent-side code (`prompt.reset-attack`, `net-monitor.sh`, attack phase detection) exists, but the chart pieces for target-apps/attack are deployed separately.

- [ ] Determine how to trigger the escape challenge from the UI (button? auto-prompt? separate deploy step?)
- [ ] Review if `prompts/escape.txt` is still used and how it gets injected into the agent
- [ ] Clarify if target-apps and attack charts still exist elsewhere or need to be recreated
- [ ] Ensure the Map tab attack phase visualization still works end-to-end
- [ ] Document the full facilitator workflow: deploy target → trigger challenge → observe → reset

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
