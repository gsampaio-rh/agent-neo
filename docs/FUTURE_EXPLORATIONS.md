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
