# Future Explorations

Ideas and themes for post-PoC investigation. These are out of current sprint scope but worth pursuing once the core platform stabilizes.

**Related:** [Plan](PLAN.md) | [Changelog](CHANGELOG.md) | [Architecture](ARCHITECTURE.md)

---

## Exploration A — Framework-Agnostic Agent Support

**Objective:** Make Neo host different agentic frameworks (OpenClaw, Hermes, OpenCode, DeepAgents, or custom agents) with minimal changes, not just Claude Code.

**Exit criteria:** A second agent framework runs in Neo with chat, metrics, and file browsing working through the same UI.

See [agent-ecosystem-comparison.md](research/agent-ecosystem-comparison.md) for research on each framework's execution model, IPC, and context patterns.

### Agent abstraction layer

- Define a common Agent Interface contract: how the relay communicates with any agent (prompt in, stream out, stop, reset)
- Identify the minimal IPC protocol that works across frameworks (JSONL stream? stdout? file-based? gRPC?)
- Design a plugin/adapter model: each agent framework gets an adapter that translates its native output into Neo's SSE event format
- Determine which features are framework-specific vs. universal (tasks, plans, memory, tools)

### Container abstraction

- Factor the `claude-code` container into a generic "agent sidecar" pattern with a well-defined interface
- Define the volume contract: what shared volumes an agent must mount and what files it must produce
- Create a `values.yaml` config for selecting the agent framework (`agent.type: claude-code | openclaw | hermes | opencode | custom`)
- Support custom agent images via `agent.image` + `agent.command` overrides

### Relay adaptations

- Abstract `sources/dir.js` to handle different output formats (not just Claude's JSONL)
- Make `MetricsCollector` framework-aware (different agents report tokens/cost differently)
- Make task integration optional and pluggable (Claude has `tasks/`, others don't)
- Define a generic "agent capabilities" manifest that the UI reads to enable/disable features

### UI flexibility

- Show/hide UI features based on agent capabilities (tasks panel only if agent supports tasks, plans panel only if agent writes plans)
- Agent-specific settings in the workspace drawer (CLAUDE.md for Claude, SOUL.md for OpenClaw, etc.)
- Generic tool call visualization that works across frameworks

---

## Exploration B — Multi-Participant Facilitator Dashboard

**Objective:** Give facilitators a single view across all participant pods in a workshop.

**Exit criteria:** A facilitator can see agent status, attack phase, and token usage for all participants on one screen.

- Aggregate `/api/stats` and `/api/state` from all participant pods
- Grid view showing each participant's status, current prompt, attack phase
- Click-through to individual participant dashboards
- Bulk operations: reset all, stop all, trigger challenge for all

---

## Exploration C — Session Recording & Replay

**Objective:** Record full workshop sessions for post-event analysis and training material creation.

**Exit criteria:** A complete session can be replayed at variable speed with all events, chat, and map state reconstructed.

- Record all SSE events with wall-clock timestamps
- Build a replay player with timeline scrubbing and variable speed
- Export recorded sessions as standalone HTML (self-contained replay)
- Annotate sessions with facilitator notes for training material

---

## Exploration D — Full OpenTelemetry Pipeline

**Objective:** Replace the Prometheus-only metrics path with a full OTEL pipeline that captures metrics, structured log events, and distributed traces from the agent.

**Exit criteria:** Agent telemetry (all three signals) flows through an OTel Collector to Prometheus (metrics), Loki (logs), and Tempo (traces), with Grafana dashboards for each.

Claude Code already supports all three signals via standard OTEL env vars. The Helm chart (`config.telemetry`) is wired to toggle exporters, OTLP endpoint, protocol, and headers. Current deployment uses `prometheus` exporter for metrics only.

### OTel Collector

- Deploy an OpenTelemetry Collector (sidecar or shared Deployment) to receive OTLP from claude-code
- Configure pipelines: metrics → Prometheus remote-write, logs → Loki, traces → Tempo
- Switch `values.yaml` from `metricsExporter: "prometheus"` to `metricsExporter: "otlp"` + `logsExporter: "otlp"`
- Evaluate collector as sidecar (per-pod) vs. central deployment (shared across participants)

### Log Events

- Enable `OTEL_LOGS_EXPORTER=otlp` to capture structured events: `user_prompt`, `api_request`, `tool_result`
- Evaluate `OTEL_LOG_TOOL_DETAILS=1` for richer data (file paths, commands, skill names)
- Build Grafana dashboard panels for prompt/tool activity timeline
- Consider privacy implications of `OTEL_LOG_USER_PROMPTS` in a workshop setting

### Traces (beta)

- Enable `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` + `OTEL_TRACES_EXPORTER=otlp`
- Visualize `claude_code.interaction` → `llm_request` → `tool` span hierarchy in Tempo/Jaeger
- Correlate traces with Neo's existing audit log and SSE events
- Explore W3C `TRACEPARENT` propagation into agent subprocess commands

### Grafana Dashboards

- Agent cost/token dashboard (already possible with Prometheus-only path)
- Tool usage heatmap (which tools, how often, duration)
- Prompt timeline (from log events)
- Trace explorer for debugging slow agent turns

---

## Exploration E — Achievements & Badges

Visual reward system for onboarding completion and feature exploration. The milestone infrastructure (`useMilestones` hook, `MilestoneProvider` context, `localStorage` persistence at `neo:milestones`) is already in place — it tracks `persona_set`, `first_response`, `log_expanded`, `visited_map`, `file_read`. What's missing is the visual layer.

### Badge UI

- Badge grid in Settings drawer or About page (small icons with earned/locked states)
- Achievement toast: brief notification when a badge is earned (slide-in from corner, auto-dismiss)
- Badge definitions: map milestone IDs to visual representations (icon, title, description)

### Extended Milestones

- `visited_map` — switch to the Map tab
- `escape_witnessed` — be present during a bind shell breach
- `tool_master` — trigger N distinct tool calls
- `session_veteran` — complete N chat sessions

### Considerations

- Keep it lightweight — no backend, no persistence beyond `localStorage`
- Avoid gamification fatigue — badges should feel like easter eggs, not homework
- Consider whether badges survive onboarding reset (currently milestones are independent of onboarding state)

