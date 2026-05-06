# Changelog: Neo

**Related:** [Plan](PLAN.md) | [Architecture](ARCHITECTURE.md) | [Future Explorations](FUTURE_EXPLORATIONS.md)

---

## Fix Profiler Test Build + Add TypeScript Typecheck Gate

**Date:** 2026-05-06
**Status:** Done

Fixed a TypeScript build error (missing `isolation` prop in `profiler.test.tsx`) that broke the OpenShift container build but was invisible during local dev. Root cause: Vite and Vitest both transpile TypeScript without type checking, so errors only surfaced in the Dockerfile's `tsc -b && vite build` step.

Added a typecheck gate at three levels to prevent this class of bug from reaching production again.

### Build Fix

- `ui/src/__tests__/profiler.test.tsx`: Added `isolation: null` to all `GameArea` renders (required after Kata isolation support added the prop to `GameAreaProps`)

### Typecheck Infrastructure

| Layer | What |
|-------|------|
| `npm run typecheck` | New script in `ui/package.json` — runs `tsc -b --noEmit` |
| `make typecheck` | New Makefile target — runs `npm run typecheck` in `ui/` |
| `make test` | Now runs `typecheck` as the first step before all test suites |
| `.githooks/pre-commit` | Runs typecheck when `ui/` files are staged — blocks commit on type errors |
| `make setup-hooks` | One-time setup: `git config core.hooksPath .githooks` |

### Files

| File | Change |
|------|--------|
| `ui/src/__tests__/profiler.test.tsx` | Added `isolation: null` to GameArea test props |
| `ui/package.json` | Added `typecheck` script |
| `Makefile` | Added `typecheck`, `setup-hooks` targets; wired typecheck into `test` |
| `.githooks/pre-commit` | New: runs typecheck on staged `ui/` files |

---

## Kata Container Support & Isolation Status

**Date:** 2026-05-06
**Status:** Done

Added Kata microVM support via Helm values and a full-stack isolation status feature: agent-side checks capture real evidence of container breakout capabilities, the relay exposes results, and the Box tab displays per-check BLOCKED/EXPOSED status with detail text. Participants can see at a glance whether the container is running on runc (exposed) or Kata (protected).

**Spec:** [Kata Requirements](specs/agent-neo-kata-requirements.md)

### Helm: Kata Runtime

Added `runtime.kata.enabled` (default: `false`) and `runtime.nodeSelector` to `chart/values.yaml`. When enabled, the deployment renders `runtimeClassName: kata` and optional `nodeSelector` in the pod spec. Fully reversible — defaults produce no Kata-related fields.

| File | Change |
|------|--------|
| `chart/values.yaml` | `runtime.kata.enabled`, `runtime.nodeSelector`, Kata resource overhead comments |
| `chart/templates/deployment.yaml` | Conditional `runtimeClassName` and `nodeSelector` |
| `tests/helm/template.test.sh` | +30 assertions: Kata on/off, nodeSelector, runtimeClassName, no-regression defaults |

### Agent: Isolation Checks

New `build/isolation-check.sh` runs three checks at container startup, each trying an operation that succeeds on runc but fails on Kata. Results are written atomically to `isolation-state.json` in the shared logs volume. Each check captures a `detail` field with real evidence (e.g., the host filesystem listing visible through `/proc/1/root/`).

| Check | runc (exposed) | Kata (blocked) |
|-------|---------------|----------------|
| Namespace escape (`unshare`) | "unshare succeeded — PID/mount namespaces can be created, container escape possible" | "unshare blocked by guest kernel boundary" |
| Host filesystem (`/proc/1/root/`) | "host root visible: bin, dev, etc, home, lib, proc, root, usr" | "host filesystem isolated by Kata guest kernel" |
| Kernel modules (`modprobe`) | "modprobe succeeded — kernel modules loadable from container" | "modprobe blocked by hypervisor boundary" |

| File | Change |
|------|--------|
| `build/isolation-check.sh` | New: standalone check script with evidence capture |
| `build/entrypoint.sh` | Calls isolation-check.sh on startup |
| `build/Dockerfile` | Copies + chmods the new script |
| `tests/build/isolation-check.test.sh` | New: 4 tests — JSON schema, detail field, runtime consistency, atomic write |

### Relay: State Integration

`StateManager` polls `isolation-state.json` alongside `net-state.json` and includes `isolation` in the `getState()` response. Graceful degradation when the file is missing or corrupt.

| File | Change |
|------|--------|
| `ui/relay/state/manager.js` | `_pollIsolationState()`, `isolation` in constructor + `getState()` |
| `ui/relay/__tests__/state.test.js` | +7 tests: absent/corrupt file, kata/runc parsing, reset behavior, API response, dynamic polling |

### UI: Box Tab Isolation Display

The `IsolationStatus` component renders in the Box sidebar with:
- Runtime badge (red `runc` / green `kata`) next to the heading
- Per-check row: colored dot + label + BLOCKED/EXPOSED status
- Evidence detail line underneath each check (mono font, line-clamped to 2 lines)

Compact styling matches the existing sidebar design system (mono font for content, 7px pixel font for headings, consistent spacing).

| File | Change |
|------|--------|
| `ui/src/hooks/useSharedState.tsx` | `IsolationCheck`, `IsolationState` types, dev override with detail |
| `ui/src/lib/contextReducer.ts` | `isolation` in `AgentState` |
| `ui/src/hooks/useGameState.ts` | Forwards isolation from shared state |
| `ui/src/App.tsx` | Passes `isolation` prop to GameArea |
| `ui/src/components/GameArea.tsx` | `IsolationStatus` component with labels, status, detail |
| `ui/src/components/SettingsDrawer.tsx` | Isolation runtime toggle in dev tools (server/runc/kata) |
| `ui/src/styles/neo.css` | Isolation section: mono font labels, compact spacing, line-clamped detail, runtime badge |
| `ui/src/components/__tests__/GameArea.test.tsx` | +7 tests: null/kata/runc, labels, BLOCKED/EXPOSED, detail text |
| `ui/src/hooks/__tests__/useSharedState.test.tsx` | Updated initial state assertion |

### Dev Mode

- `Makefile` seeds `isolation-state.json` (runc defaults with detail evidence) in `.dev-data/`
- Settings drawer toggle simulates server/runc/kata with full detail text

### Tests

733 total tests pass (460 UI + 192 relay + 66 Helm + 11 scripts + 4 build).

---

## Map Layout & Node Positioning

**Date:** 2026-05-04
**Status:** Done

Simplified the Map tab topology and introduced phase-aware dynamic layout. Removed obsolete `k8s-api` and `collector` nodes (remnants from pre-bind-shell detection), replaced static hardcoded positions with a `computeLayout()` function that produces different layouts per attack phase, and added animated viewport transitions on phase changes.

### Key Changes

- **Removed obsolete nodes:** `k8s-api`, `collector` nodes and their edges (`agent-k8s`, `agent-collector`) deleted from topology. `ExternalTargetNode` component and `externalTarget` node type removed. Associated CSS (`.map-node--target`, `.map-edge--exploit`, `map-edge-flow-exploit` keyframes) cleaned up. Node count in `exploiting` phase reduced from 7 to 5, edges from 4 to 2.
- **Phase-aware layout:** Static `LAYOUT` object replaced with `computeLayout(attackPhase)`. In `normal`/`compromised`, namespaces sit side-by-side centered. In `exploiting`, graph shifts right to make room for the attacker node, which is positioned relative to the agent namespace (not at a fixed absolute offset). Decision documented: dagre/elkjs skipped — manual positioning gives pixel-perfect control for 3-5 nodes.
- **Edge routing:** Switched from default bezier to `smoothstep` edges for cleaner right-angle routing around namespace group boundaries. Increased label background padding to prevent overlap with node borders.
- **Responsive fitView:** Added `useReactFlow().fitView()` call on `attackPhase` transitions with 300ms animated duration, so the viewport auto-adjusts when nodes appear/disappear.
- **Visual polish:** Added CSS transition on namespace border/background for smoother phase changes. Tightened namespace padding.

### Modified Files

| File | Change |
|---|---|
| `ui/src/components/map/topology.ts` | Replaced `LAYOUT` with `computeLayout()`, removed k8s-api/collector nodes and edges, switched to smoothstep edges |
| `ui/src/components/map/nodes.tsx` | Removed `ExternalTargetNode`, `bottom` handle from `AgentPodNode`, `externalTarget` from registry |
| `ui/src/components/MapArea.tsx` | Added `useReactFlow().fitView()` on phase transitions |
| `ui/src/components/__tests__/MapArea.test.tsx` | Updated counts (5 nodes/2 edges in exploiting), added `computeLayout` tests |
| `ui/src/styles/neo.css` | Removed `.map-node--target`, `.map-edge--exploit` styles, added namespace transition |

---

## Agent Persona & Interactive Onboarding

**Date:** 2026-05-04
**Status:** Done

Redesigned the onboarding from a passive slide walkthrough into a full-screen, blocking, interactive modal with 6 steps. Added agent persona customization (name + avatar) that persists across the UI. Each step contains a simulated interactive illustration that teaches a concept by doing — not just reading.

### Design Decisions

- **Gated modal**: The main app is locked behind onboarding. Steps can be `gated` (require interaction to enable "Next") or non-gated (auto-advance). Skip available at any point.
- **Simulated illustrations over real interactions**: Instead of requiring the user to perform actions in the actual app (send a prompt, switch tabs), each concept is taught through a self-contained mini-illustration inside the modal card. This avoids coupling onboarding to app state and keeps the flow self-contained.
- **Persona-first**: Step 1 is `PersonaSetup` — name input + avatar picker. The persona then appears in the header, chat messages, typing indicator, and Settings drawer throughout the session.
- **Modular illustration files**: Each diagram is a standalone component in `content/illustrations/`, keeping the step data file slim (~65 lines).
- **Milestone infrastructure**: `MilestoneProvider` context tracks post-onboarding user actions (`first_response`, `log_expanded`, `file_read`, `visited_map`, `persona_set`) in `localStorage`. No visual badge UI yet — infrastructure ready for future achievements sprint.

### Steps

| # | ID | Title | Illustration | Gated? |
|---|---|---|---|---|
| 1 | `name-agent` | Name Your Agent | `PersonaSetup` (name + avatar picker) | Yes |
| 2 | `what-is-agent` | What is an AI Agent? | `AgentLoopDiagram` (auto-cycling Think→Plan→Act→Observe) | No |
| 3 | `not-a-chatbot` | Not a Chatbot | `AgentVsLlmInteractive` (prompt selection → side-by-side LLM vs Agent animation) | Yes |
| 4 | `agent-vs-llm` | Agent ≠ LLM | `AgentVsLlmMapDiagram` (two-pod topology with descriptions) | No |
| 5 | `tools-skills` | Tools & Skills | `ToolsAndSkillsDiagram` (tabbed Tools/Skills explorer) | No |
| 6 | `get-started` | Get Started | `TryItDiagram` (simulated typing animation) | No |

### New Files

| File | Purpose |
|---|---|
| `ui/src/hooks/usePersona.ts` | Persona state + localStorage persistence |
| `ui/src/hooks/useMilestones.tsx` | MilestoneProvider context + emit/reset hooks |
| `ui/src/content/avatars.ts` | 12 avatar definitions (emoji + label) |
| `ui/src/components/PersonaSetup.tsx` | Name input + avatar grid, used in onboarding step 1 and Settings edit |
| `ui/src/content/illustrations/types.ts` | Shared `IllustrationProps` interface |
| `ui/src/content/illustrations/useTypingAnimation.ts` | Typing animation hook for side-by-side demos |
| `ui/src/content/illustrations/AgentLoopDiagram.tsx` | Auto-cycling Think→Plan→Act→Observe loop |
| `ui/src/content/illustrations/AgentVsLlmInteractive.tsx` | Prompt-selection → side-by-side LLM vs Agent output |
| `ui/src/content/illustrations/AgentVsLlmMapDiagram.tsx` | Two-pod Agent/LLM topology diagram |
| `ui/src/content/illustrations/ToolsAndSkillsDiagram.tsx` | Tabbed Tools/Skills explorer with "Why" callout |
| `ui/src/content/illustrations/TryItDiagram.tsx` | Simulated typing animation |

### Modified Files

| File | Change |
|---|---|
| `ui/src/content/onboardingSteps.tsx` | Rewritten as slim data-only file importing from `illustrations/` |
| `ui/src/hooks/useOnboarding.ts` | Step-based nav (`next`/`back`/`skip`/`complete`/`restart`), `gated` support |
| `ui/src/components/Onboarding.tsx` | Full-screen gated modal, persona step, keyboard nav, skip button |
| `ui/src/App.tsx` | Wired `usePersona`, `MilestoneProvider`, persona editing flow, persona prop threading |
| `ui/src/components/AppHeader.tsx` | Persona avatar + name display, edit persona callback |
| `ui/src/components/ChatMessage.tsx` | Persona avatar emoji for agent messages |
| `ui/src/components/ChatView.tsx` | Persona in typing indicator, `first_response` milestone emission |
| `ui/src/components/FileExplorer.tsx` | `file_read` milestone emission |
| `ui/src/components/LiveTerminal.tsx` | `log_expanded` milestone emission |
| `ui/src/components/SettingsDrawer.tsx` | Persona section with Edit button, `setDevOverride` callback updater |
| `ui/src/hooks/useSharedState.tsx` | `setDevOverride` accepts functional updater (fixes stale closure) |
| `ui/src/styles/neo.css` | Onboarding card layout, illustration styles, persona header styles |

### Tests (33 new tests across 8 new test files + 8 updated tests across 3 existing files)

**New test files:**
- `AgentLoopDiagram.test.tsx` (5): node rendering, active cycling, wrap-around, feedback label
- `AgentVsLlmInteractive.test.tsx` (6): prompt buttons, placeholder, panel display, interaction callback, idempotent callback, active state
- `AgentVsLlmMapDiagram.test.tsx` (5): pod labels, descriptions, arrow label, hint, pod elements
- `ToolsAndSkillsDiagram.test.tsx` (6): tab rendering, tools tab content, skills tab switch, interaction callback on both tabs visited, idempotent callback, why section
- `TryItDiagram.test.tsx` (3): input area, empty start, typing over time
- `usePersona.test.ts` (7): initial null, localStorage load, set/persist, trim, empty name guard, clear, corrupted JSON
- `useMilestones.test.tsx` (6): empty set, localStorage load, emit/persist, idempotent, reset, corrupted JSON
- `PersonaSetup.test.tsx` (8): title/input, avatar count, disabled states, complete payload, skip, selected class, prefill

**Updated test files:**
- `AppHeader.test.tsx` (+3): persona name/avatar, breached overrides persona, null fallback
- `ChatMessage.test.tsx` (+3): persona emoji for assistant, robot fallback, user always shows 👤
- `ChatView.test.tsx` (+2): persona avatar in typing indicator, robot fallback

**Existing test files updated for new API:**
- `useOnboarding.test.ts` (8): step nav, skip/complete, restart, totalSteps from data
- `Onboarding.test.tsx` (12): gated/non-gated steps, persona step, layout order, dot count, keyboard nav
- `SettingsDrawer.test.tsx` (15): persona section, dev tools with callback updater

### Bugs Fixed

- **Stale `emitMilestone` in `FileExplorer.tsx`**: `handleSelect` callback captured outdated `emitMilestone` ref — added to dependency array
- **Stale `devOverride` in `SettingsDrawer.tsx`**: `setPhase`/`toggleEscaped` used stale state in quick succession — switched `setDevOverride` to accept functional updater

---

## Dev Mode Map Toggles

**Date:** 2026-05-03
**Status:** Done

Added developer-only controls in the Settings drawer to force the Map tab and header banner into specific attack phase states without needing the full escape infrastructure. Useful for testing map visualizations, CSS states, and demos.

### What shipped

- **`SharedStateProvider` context** — converted `useSharedState` from a standalone hook to a React context provider. All consumers (`useAttackPhase`, `useGameState`) now share a single polling instance. The provider supports a `devOverride` that merges over polled server state.
- **Dev Tools section in SettingsDrawer** — gated on `import.meta.env.DEV` (tree-shaken from production builds). Controls: attack phase buttons (`normal` / `compromised` / `exploiting`), escaped toggle (ON/OFF), and "Reset to live state" button.
- **Client-side only** — no relay changes, no new API endpoints, no env vars. Override lives in React state and resets on page refresh.

### Files

| File | Change |
|------|--------|
| `ui/src/hooks/useSharedState.tsx` | New — context provider with polling + `devOverride` + `useDevOverride()` hook |
| `ui/src/hooks/useSharedState.ts` | Deleted — replaced by `.tsx` version |
| `ui/src/App.tsx` | Wrapped `AppContent` with `<SharedStateProvider>` |
| `ui/src/components/SettingsDrawer.tsx` | Added `DevToolsSection` component with phase buttons, escaped toggle, reset |
| `ui/src/styles/neo.css` | +74 lines: `.settings-drawer__dev` section, phase buttons, toggle, reset styles |

### Tests

- **`useSharedState`** (`useSharedState.test.tsx`): 6 tests — initial state, polling, override replaces phase/escaped, clearing reverts, eventCount unaffected
- **`useAttackPhase`** (`useAttackPhase.test.ts`): 8 tests updated to use `SharedStateProvider` wrapper
- **`SettingsDrawer`** (`SettingsDrawer.test.tsx`): 7 new Dev Tools tests + 8 existing tests updated with provider wrapper (15 total)

---

## Agent Telemetry — Prometheus Metrics Pipeline

**Date:** 2026-05-02
**Status:** Done

Wired Claude Code's native OpenTelemetry support into the cluster's Prometheus stack. The agent now exposes metrics (tokens, cost, sessions, tool usage) via a Prometheus scrape endpoint — no OTel Collector needed for this path. Full OTEL pipeline (logs + traces via Collector → Loki/Tempo) deferred to [Future Explorations](FUTURE_EXPLORATIONS.md#exploration-d--full-opentelemetry-pipeline).

### What shipped

| Layer | Change |
|-------|--------|
| `chart/values.yaml` | New `config.telemetry` block: toggles for metrics/logs/traces exporters, OTLP config, Prometheus port (9464), export intervals, tool detail logging |
| `chart/templates/configmap.yaml` | Conditional OTEL env vars: `CLAUDE_CODE_ENABLE_TELEMETRY`, `OTEL_METRICS_EXPORTER`, `OTEL_EXPORTER_PROMETHEUS_PORT`, traces beta flag, OTLP endpoint/protocol/headers, export intervals |
| `chart/templates/deployment.yaml` | Conditional `otel-metrics` container port (9464) on `claude-code` container |
| `chart/templates/service-agent-metrics.yaml` | New Service exposing the agent's Prometheus endpoint within the cluster |
| `chart/templates/servicemonitor-agent.yaml` | New ServiceMonitor for Prometheus to scrape agent metrics (gated on `metrics.enabled`) |
| `docs/FUTURE_EXPLORATIONS.md` | New "Exploration D — Full OpenTelemetry Pipeline" section |

### Defaults

```yaml
telemetry:
  enabled: true
  metricsExporter: "prometheus"
  logsExporter: "none"
  tracesExporter: "none"
  prometheusPort: 9464
```

### Tests

- **Helm** (`tests/helm/template.test.sh`): +18 assertions (50 total) — telemetry env vars, Prometheus port, agent-metrics Service, ServiceMonitor conditional rendering, OTLP endpoint/traces toggles

---

## Onboarding Experience

**Date:** 2026-05-02
**Status:** Done

Built a 6-step interactive onboarding walkthrough for first-time workshop participants. Introduces what AI agents are, how they differ from chat LLMs, what tools and skills are (and why they exist), and then tours the Neo dashboard — all before prompting the user to send their first message.

### Design Decisions

- **No new dependencies**: Pure CSS animations and transitions; inline SVG/React illustrations.
- **Content separated from layout**: Step definitions live in `ui/src/content/onboardingSteps.tsx`, following the `content/quickActions.ts` pattern.
- **localStorage persistence**: Single key (`neo:onboarding-complete`) — no API needed.
- **Interactive illustrations**: Animated typing side-by-side (LLM vs Agent), tabbed tools/skills explorer, hover-to-explore dashboard, animated task progress.

### Steps

| # | Title | Interactive Element |
|---|-------|-------------------|
| 1 | What is an AI Agent? | Animated loop: Think → Plan → Act → Observe |
| 2 | Agent vs. Chat LLM | Side-by-side terminals with live typing animation |
| 3 | Tools & Skills | Tabbed panel (click Tools/Skills) with callout |
| 4 | Tasks & Plans | Tabbed plan/task view with animated progress |
| 5 | Meet Neo | Hover-to-explore dashboard tabs |
| 6 | Try It | Simulated typing + quick action buttons |

### New Files

| File | Purpose |
|------|---------|
| `ui/src/content/onboardingSteps.tsx` | Step definitions: id, title, body, illustration component, spotlight selector |
| `ui/src/hooks/useOnboarding.ts` | State hook: localStorage detection, step navigation, restart |
| `ui/src/hooks/__tests__/useOnboarding.test.ts` | 9 unit tests for the hook |
| `ui/src/components/Onboarding.tsx` | Overlay component: spotlight (SVG mask), card, dots, keyboard nav |
| `ui/src/components/__tests__/Onboarding.test.tsx` | 15 component tests |

### Modified Files

| File | Change |
|------|--------|
| `ui/src/App.tsx` | Wire `useOnboarding` hook + render `<Onboarding>` overlay |
| `ui/src/components/AppHeader.tsx` | Pass `onRestartOnboarding` prop through to SettingsDrawer |
| `ui/src/components/SettingsDrawer.tsx` | Accept prop, render "Show onboarding again" button |
| `ui/src/styles/neo.css` | ~300 lines: onboarding overlay, card, spotlight, all illustration styles |

### Key Behaviors

- Auto-shows on first visit (no `neo:onboarding-complete` in localStorage)
- Skip/dismiss at any point (button + Escape key)
- Keyboard nav: ArrowRight/ArrowLeft for next/back
- "Get Started" on last step → completes onboarding + switches to Chat tab
- Re-triggerable from Settings drawer

---

## Tasks & Plans Integration

**Date:** 2026-05-02
**Status:** Done

Integrated Claude Code's native task and plan systems into Neo. The relay watches task files on disk (`fs.watch` + 2s polling) and broadcasts state changes via SSE. Plans are fetched on-demand via REST. UI includes drawer panels for both tasks and plans, a task status bar above chat input, and a clickable task detail view showing description, status, active form, and dependency relationships.

### Architecture

- **Disk watch, not JSONL parsing**: Task files are written synchronously by Claude Code — disk state is authoritative. `fs.watch` + polling catches changes within milliseconds without coupling to JSONL format.
- **SSE for tasks, REST for plans**: Tasks change rapidly during execution → real-time via SSE broadcast. Plans are write-once markdown → fetched on demand.
- **Helm-managed env vars**: `CLAUDE_CODE_ENABLE_TASKS=1` injected via ConfigMap into the `claude-code` container.

### Relay Backend

| New file | Purpose |
|---|---|
| `ui/relay/sources/tasks.js` | TaskWatcher — `fs.watch` + poll, debounced SSE broadcasts, `getTasks()`/`getTask(id)` |
| `ui/relay/sources/plans.js` | PlanReader — read `plans/*.md` on demand, title extraction from `# Plan:` header |
| `ui/relay/api/tasks.js` | REST handlers: `GET /api/tasks`, `GET /api/tasks/:id` |
| `ui/relay/api/plans.js` | REST handlers: `GET /api/plans`, `GET /api/plans/:filename` |

| Modified file | Change |
|---|---|
| `ui/relay/config.js` | Added `taskListId` from `CLAUDE_CODE_TASK_LIST_ID` env var |
| `ui/relay.mjs` | Wire TaskWatcher + PlanReader, shutdown cleanup |
| `ui/relay/router.js` | 4 new routes, `taskWatcher`/`planReader` in context |

### UI

| New file | Purpose |
|---|---|
| `ui/src/services/tasksApi.ts` | Typed fetch client for tasks |
| `ui/src/services/plansApi.ts` | Typed fetch client for plans |
| `ui/src/hooks/useTasks.ts` | Dual-source hook (SSE + REST initial load) |
| `ui/src/hooks/usePlans.ts` | REST polling hook (10s interval) |
| `ui/src/components/TaskViewer.tsx` | Task list with status badges + clickable detail view |
| `ui/src/components/TasksDrawer.tsx` | Header icon + drawer panel with badge dot |
| `ui/src/components/PlansDrawer.tsx` | Header icon + drawer with markdown rendering |
| `ui/src/components/TaskStatusBar.tsx` | Compact progress dots above chat input |

| Modified file | Change |
|---|---|
| `ui/src/lib/eventParser.ts` | Added `task_state` event type |
| `ui/src/components/AppHeader.tsx` | Added TasksDrawer + PlansDrawer |
| `ui/src/components/ChatView.tsx` | Added TaskStatusBar |
| `ui/src/App.tsx` | Wire `useTasks`/`usePlans`, pass to components |

### Helm

| Modified file | Change |
|---|---|
| `chart/values.yaml` | Added `config.enableTasks: true`, `config.taskListId: ""` |
| `chart/templates/configmap.yaml` | Conditional `CLAUDE_CODE_ENABLE_TASKS` + `CLAUDE_CODE_TASK_LIST_ID` |

### Dev Tooling

- `scripts/seed-dev-tasks.sh`: Seeds 5 task files + 1 plan for `make dev`
- Makefile `dev` target updated to call seed script

### Tests

- **Relay** (`ui/relay/__tests__/tasks.test.js`): 11 tests — TaskWatcher reads, empty states, auto-detect list, explicit list, getTask, malformed JSON, REST handlers
- **Relay** (`ui/relay/__tests__/plans.test.js`): 10 tests — PlanReader list, empty, sort, getPlan, path traversal, REST handlers
- **UI hooks** (`useTasks.test.ts`, `usePlans.test.ts`): 10 tests — REST fetch, SSE updates, activeTask derivation, clearActivity, selectPlan toggle
- **UI components** (`TaskViewer`, `TasksDrawer`, `PlansDrawer`, `TaskStatusBar`): 20 tests — rendering, interaction, detail view, badge dot, status bars
- **Helm** (`tests/helm/template.test.sh`): +4 assertions — CLAUDE_CODE_ENABLE_TASKS presence, envFrom wiring, optional CLAUDE_CODE_TASK_LIST_ID

---

## Monitoring, Metrics, and Observability

**Date:** 2026-05-01
**Status:** Done

Added agent-level metrics collection, Prometheus and JSON stats endpoints, a Helm ServiceMonitor, and a full audit logging system with UI viewer.

### Agent metrics

`MetricsCollector` wired into the relay broadcast path extracts token usage, cost, latency, tool call counts, and error rates from JSONL events. Uses a fast-path string `includes()` pre-filter — only `result`, `tool_use`, `init`, and `api_retry` lines trigger `JSON.parse`; the 99%+ of streaming text/thinking lines are skipped with zero parsing overhead.

- **`GET /api/metrics`** — Prometheus-compatible `text/plain` exposition (counters: `neo_tokens_input_total`, `neo_tokens_output_total`, `neo_cost_usd_total`, `neo_prompts_total`, `neo_sessions_total`, `neo_tool_calls_total{name}`, `neo_errors_total{category}`, `neo_response_duration_seconds_sum/count`; gauges: `neo_clients_connected`, `neo_llm_available`). Placed before auth in the router for cluster-internal Prometheus scraping.
- **`GET /api/stats`** — JSON summary with session, token, cost, latency, tool, error, and system stats. Behind auth.

### Infrastructure metrics

- `ServiceMonitor` template in Helm chart, gated on `metrics.enabled` (default `false`)
- Configurable scrape interval and custom labels via `values.yaml`

### Audit log

`AuditLogger` with in-memory ring buffer (1000 entries) + batched `appendFileSync` to `audit.jsonl`. Fire-and-forget `log()` calls on: prompt queue, stop, reset, file writes, prompt completions, and errors. Size-based rotation at 10MB (configurable via `AUDIT_MAX_SIZE_MB`).

- **`GET /api/audit`** — paginated, filterable by event type and time range. Reads from ring buffer (no file I/O per request). Input validation on limit/offset.
- **Audit log viewer** in Settings drawer — table with event type filter, color-coded badges, and pagination.

### Shutdown handling

Added `SIGTERM`/`SIGINT` handlers in relay to flush pending audit events and persist state on process shutdown.

### Changes

| File | Change |
|------|--------|
| `ui/relay/metrics/collector.js` | New: MetricsCollector with fast-path pre-filter |
| `ui/relay/metrics/prometheus.js` | New: Prometheus text formatter |
| `ui/relay/api/metrics.js` | New: `GET /api/metrics` handler |
| `ui/relay/api/stats.js` | New: `GET /api/stats` handler |
| `ui/relay/audit/logger.js` | New: AuditLogger with ring buffer + file persistence |
| `ui/relay/api/audit.js` | New: `GET /api/audit` handler with input validation |
| `ui/src/components/AuditLogViewer.tsx` | New: audit log viewer component |
| `ui/src/services/auditApi.ts` | New: audit API client |
| `chart/templates/servicemonitor.yaml` | New: conditional ServiceMonitor |
| `ui/relay.mjs` | Wired MetricsCollector, AuditLogger, shutdown handlers |
| `ui/relay/router.js` | Added 3 routes (`/api/metrics`, `/api/stats`, `/api/audit`) |
| `ui/relay/api/chat.js` | Audit logging on prompt/stop/reset, metrics prompt count |
| `ui/relay/api/files.js` | Audit logging on file writes |
| `ui/src/components/SettingsDrawer.tsx` | Added AuditLogViewer section |
| `ui/src/styles/neo.css` | Audit log viewer styles |
| `chart/values.yaml` | Added `metrics` config block |

### Tests

- `ui/relay/__tests__/collector.test.js`: 12 tests (counters, fast-path skip, accumulation, reset, tool cap, malformed JSON)
- `ui/relay/__tests__/prometheus.test.js`: 5 tests (empty state, tool labels, error labels, escaping, duration counters)
- `ui/relay/__tests__/audit.test.js`: 7 tests (ring buffer, ordering, filtering, pagination, file flush, hydration)
- `tests/helm/template.test.sh`: +4 assertions (ServiceMonitor conditional rendering, path, port, custom interval)

---

## Basic Auth for Neo UI and Web Terminal

**Date:** 2026-04-30
**Status:** Done

Added shared Basic Auth protection for both the Neo UI relay and the web terminal (ttyd). Driven by `auth.username` / `auth.password` in Helm values, stored in a Kubernetes Secret, enforced as middleware in the relay router. Browser-native Basic Auth dialog — no custom login page.

### Changes

- **`chart/neo/values.yaml`**: added `auth.username` and `auth.password` (empty by default — auth disabled)
- **`chart/neo/templates/secret-auth.yaml`**: new conditional Secret with `username`, `password`, and `ttyd-credential` keys
- **`chart/neo/templates/deployment.yaml`**: wires `NEO_AUTH_USER` and `NEO_AUTH_PASS` into neo-ui container, `TTYD_CREDENTIAL` from auth Secret into claude-code container (falls back to legacy `ttyd.credential` if auth not set)
- **`ui/relay/lib/auth.js`**: `createAuthCheck` middleware using `timingSafeEqual` to prevent timing attacks
- **`ui/relay/router.js`**: auth gate above all routes except `OPTIONS` and `/health`; added `Authorization` to CORS allowed headers
- **`ui/relay/config.js`**: reads `NEO_AUTH_USER` and `NEO_AUTH_PASS` env vars
- **`scripts/config.sh`**: exports `NEO_AUTH_USER` and `NEO_AUTH_PASS`
- **`scripts/02-deploy.sh`**: passes `auth.username` / `auth.password` to Helm when set

### Tests

- `ui/relay/__tests__/auth.test.js`: 8 tests (valid/invalid creds, colons in password, missing header, disabled mode)
- `ui/relay/__tests__/router.test.js`: +6 tests (health bypass, OPTIONS bypass, 401 without creds, 401 wrong creds, 200 with creds, CORS Authorization header)
- `tests/helm/template.test.sh`: +9 assertions (auth Secret presence, keys, env vars)

### Upgrade path

For production deployments, consider replacing Basic Auth with OpenShift OAuth Proxy or OIDC integration. Basic Auth is suitable for workshop/PoC use.

---

## Code Quality, Security, and Stability Sweep

**Date:** 2026-04-30
**Status:** Done

Comprehensive refactoring addressing security vulnerabilities, reliability issues, code duplication, missing tests, and accessibility across all project areas (relay, UI, Helm charts, scripts).

### Security and Reliability (Priority 1)

- **Relay body size limit:** `handleWriteFile` now enforces 64 KiB max body with proper `req.on('error')` handling (`ui/relay/api/files.js`)
- **FD leak prevention:** `dir.js` and `system.js` tail readers wrapped in `try/finally { closeSync(fd) }`
- **TOCTOU race fix:** `chat.js` prompt queueing uses atomic `openSync('wx')` + `try/finally` for FD safety
- **Watcher cleanup:** `dir.js` now returns `{ stop }` that closes both `fs.watch` and poll interval
- **NetworkPolicy scoped:** Attack chart ingress rule now requires explicit `from` namespace selectors
- **RBAC scoped:** `target-apps` ClusterRole → namespace-scoped Role + RoleBinding in `targetNamespace`
- **Readiness threshold:** Neo readinessProbe `failureThreshold` raised from 1 → 3 to prevent flapping
- **Temp dir cleanup:** `deploy-attack.sh` and Makefile `build-attacker` use `trap ... EXIT`
- **Backup guard:** `entrypoint.sh` only creates `CLAUDE.md.bak` if it doesn't already exist
- **Namespace consistency:** `deploy-attack.sh` rollout uses `$ATTACKER_NS` variable throughout
- **Prompt validation:** `prompt-watcher.sh` rejects invalid JSON with error log instead of raw `cat` fallback

### Refactoring (Priority 2)

- **Hook decomposition:** `useChatMessages` (212 → 130 lines) split into `useLlmHealth`, `useChatActions`, + orchestrator
- **Shared state polling:** New `useSharedState` hook eliminates duplicate `/api/state` fetch in `useGameState` + `useAttackPhase`
- **Format utilities:** Extracted `formatJson`, `formatNumber`, `formatDuration`, `formatElapsed` to `src/lib/format.ts`
- **Shared response helper:** `jsonResponse` extracted to `relay/lib/response.js`, used by 5 API modules
- **State debounce:** `StateManager.processLine` persists at most once per second (was every event)
- **Dead code removal:** Unreachable `DemoContent` component removed from `App.tsx`

### Test Coverage (Priority 3)

- **New UI tests:** `GameArea`, `ContextSidebar`, `TimelineView`, `WorkspaceDrawer` (324 total tests, +18)
- **New relay tests:** `router.js`, `health.js`, `dir-source.js`, `files-edge.js` (125 total tests, +21)
- **New script tests:** `entrypoint-backup.test.sh`, `prompt-watcher-json.test.sh` (10 new assertions)
- **Updated Helm tests:** `target-apps-chart.test.sh` verifies Role/RoleBinding instead of ClusterRole (19 tests, +3)

### Accessibility (Priority 4)

- **Keyboard support:** All expandable rows (`LiveTerminal`, `TimelineView`, `ChatMessage`) have `role="button"`, `tabIndex={0}`, Enter/Space handlers, `aria-expanded`
- **Dialog semantics:** `QuickActions` overlay has `role="dialog"`, `aria-modal`, `aria-label`, Escape-to-close
- **Labels:** Stop button has `aria-label="Stop agent"`

### Configuration Extraction

- **Neo values.yaml:** Added `replicaCount`, `ports.ui`, `ports.webTerminal`, `probes.agent.*`, `probes.ui.*`, `config.maxOutputTokens`, `config.maxThinkingTokens`
- **Deployment/services:** All ports and probe timings now reference `values.yaml`
- **Label standardization:** Added `app.kubernetes.io/name` to attack and target-apps chart helpers

---

## Markdown Rendering for Agent Messages

**Date:** 2026-04-30
**Status:** Done

Agent chat messages now render full markdown formatting instead of plain text. Supports headers, bold/italic, code blocks, inline code, lists, blockquotes, links, and GFM tables.

### Changes

- **`react-markdown`** + **`remark-gfm`**: added as dependencies for markdown parsing and GFM table support
- **`ui/src/components/ChatMessage.tsx`**: `TextBlock` now renders through `<ReactMarkdown remarkPlugins={[remarkGfm]}>` instead of a plain `<div>`
- **`ui/src/styles/neo.css`**: scoped styles under `.chat-block--text` for h1-h3, strong, em, code, pre, ul/ol, blockquote, a, table/th/td

### Tests

- `ui/src/components/__tests__/ChatMessage.test.tsx`: 5 tests (bold, code blocks, headers, lists, GFM tables)

---

## Settings Drawer Refactor

**Date:** 2026-04-30
**Status:** Done

Replaced the outdated CTF-era settings drawer with live data fetched from the relay. The drawer now shows environment info (model, namespace, pod, permission mode), skills from the workspace, and CLAUDE.md content. Removed the connection section, demo button, and static config file.

### Changes

- **`ui/relay/api/status.js`**: extended response with `environment` object (model, namespace, podName, permissionMode)
- **`ui/src/services/chatApi.ts`**: added `EnvironmentInfo` interface to `StatusResponse`
- **`ui/src/components/SettingsDrawer.tsx`**: fully rewritten — fetches CLAUDE.md, skills, and env info on open
- **`ui/src/content/agentConfig.ts`**: deleted (no longer needed)
- **`ui/src/components/AppHeader.tsx`**: removed `connection` prop
- **`ui/src/App.tsx`**: removed `connection` useMemo/threading, simplified SSE URL setup
- **`ui/src/styles/neo.css`**: removed connect-row/demo button styles, added loading style
- **`chart/neo/templates/deployment.yaml`**: injected `ANTHROPIC_DEFAULT_SONNET_MODEL` and `CLAUDE_PERMISSION_MODE` into neo-ui container

### Tests

- `ui/src/components/__tests__/SettingsDrawer.test.tsx`: 8 tests (environment info, skills, CLAUDE.md, open/close, fallback)

---

## .claude Folder Explorer (Read-Only)

**Date:** 2026-04-30
**Status:** Done

Adds a right-side drawer (toggled via folder icon in the header) that displays the contents of the agent's `.claude/` workspace directory. Files can be viewed in a read-only `<pre>` viewer. Edit functionality deferred to a future task.

### Architecture

- Shared volume renamed `claude-sessions` → `claude-workspace` for clarity
- Neo-UI container mounts the volume at `/data/claude-workspace` (read-write)
- Relay exposes file API: `GET /api/files` (tree), `GET /api/files/:path` (read), `PUT /api/files/:path` (write — wired but unused in UI)
- Path traversal guard on all file operations
- Local dev: `make dev` seeds `.dev-data/claude-workspace/` with sample files

### Changes

- **`chart/neo/templates/deployment.yaml`**: volume rename, neo-ui mount + `CLAUDE_WORKSPACE_DIR` env var
- **`ui/relay/api/files.js`** (NEW): `handleListFiles`, `handleReadFile`, `handleWriteFile` with path traversal guard
- **`ui/relay/config.js`**: added `claudeWorkspaceDir`
- **`ui/relay/router.js`**: wired `/api/files` routes, passed `config` in router context
- **`ui/src/services/filesApi.ts`** (NEW): `listFiles()`, `readFile(path)`
- **`ui/src/components/FileExplorer.tsx`** (NEW): tree view + read-only file viewer
- **`ui/src/components/WorkspaceDrawer.tsx`** (NEW): right-side panel with folder icon toggle
- **`ui/src/components/AppHeader.tsx`**: added `WorkspaceDrawer` next to settings
- **`ui/src/styles/neo.css`**: workspace drawer + file explorer + file viewer styles
- **`Makefile`**: `make dev` creates fake workspace files, sets `CLAUDE_WORKSPACE_DIR`

### Tests

- `ui/relay/__tests__/files.test.js`: 9 tests (list, read, write, path traversal, hidden files)
- `ui/src/components/__tests__/FileExplorer.test.tsx`: 4 tests (tree render, view file, toggle close, nested dirs)

---

## vLLM Health Check

**Date:** 2026-04-30
**Status:** Done

Relay proactively monitors vLLM availability via `/health` endpoint and exposes it in the UI. Prevents prompt submission when the LLM backend is unreachable.

### Architecture

- Health URL derived from `ANTHROPIC_BASE_URL` (strips `/v1`, appends `/health`)
- Relay polls every 5s (configurable via `VLLM_HEALTH_INTERVAL_MS`), 3s timeout per probe
- Graceful degradation: if `ANTHROPIC_BASE_URL` is empty, assumes available (no blocking)

### Changes

- **`ui/relay/health/vllm.js`** (NEW): poller module — `startVllmHealthPoller()`, `isLlmAvailable()`, `stopVllmHealthPoller()`
- **`ui/relay/config.js`**: reads `ANTHROPIC_BASE_URL` and `VLLM_HEALTH_INTERVAL_MS` env vars
- **`ui/relay.mjs`**: starts poller on server boot
- **`ui/relay/api/status.js`**: exposes `llmAvailable` field in response
- **`chart/neo/templates/deployment.yaml`**: injects `ANTHROPIC_BASE_URL` into neo-ui container via `configMapKeyRef`
- **`ui/src/services/chatApi.ts`**: `StatusResponse` adds `llmAvailable?: boolean`
- **`ui/src/lib/chatReducer.ts`**: `ChatState` gains `llmAvailable: boolean` (default `true`)
- **`ui/src/hooks/useChatMessages.ts`**: reads `llmAvailable` on connect, polls every 5s, guards `sendPrompt` via ref
- **`ui/src/components/AppHeader.tsx`**: LLM status indicator (green dot "LLM" / red dot "LLM DOWN") next to LIVE badge
- **`ui/src/components/ChatInput.tsx`**: disabled + "LLM backend unavailable" placeholder when offline
- **`ui/src/components/ChatView.tsx`**: passes `llmAvailable` to ChatInput and QuickActions
- **`ui/src/styles/neo.css`**: `.neo-header__llm`, `.neo-header__dot--llm-off`, `.chat-input--llm-down` styles

### Tests (363 total, all pass)

- `relay/__tests__/vllm-health.test.js` (6 tests): fetch ok/fail/timeout, URL derivation, empty-URL skip
- `relay/__tests__/status.test.js`: 2 new assertions for `llmAvailable` field
- `src/hooks/__tests__/useChatMessages.test.ts`: 4 new tests for llmAvailable lifecycle and sendPrompt blocking

---

## Reset Loading State

**Date:** 2026-04-30
**Status:** Done

Block UI input after reset until the server-side cleanup is confirmed complete. Previously the user could send a new prompt while the agent was still being stopped and the JSONL truncated (~1-3s race window).

### Architecture

- `prompt-watcher.sh` writes `reset.done` marker after processing `prompt.reset`
- Relay `handleReset` deletes `reset.done` before sending reset signal, calls `stateManager.reset()`, returns `{ status: "resetting" }`
- `GET /api/status` exposes `resetting: boolean` — true when `prompt.reset` exists but `reset.done` doesn't
- Frontend polls `/api/status` every 500ms after reset, input disabled with spinner until server confirms

### Changes

- **`build/neo/prompt-watcher.sh`**: `touch "$LOG_DIR/reset.done"` after truncating JSONL
- **`ui/relay/api/chat.js`**: `handleReset` deletes `reset.done`, calls `stateManager.reset()`, returns `"resetting"` status
- **`ui/relay/api/status.js`**: `resetting` field derived from control file state
- **`ui/src/lib/chatReducer.ts`**: `ChatState` gains `resetting: boolean` (default `false`)
- **`ui/src/hooks/useChatMessages.ts`**: `resetConversation` sets `resetting: true`, polls `fetchStatus()` in a loop until done, guards `sendPrompt` via ref
- **`ui/src/services/chatApi.ts`**: `StatusResponse` adds `resetting?: boolean`
- **`ui/src/components/ChatInput.tsx`**: disabled + spinner + "Resetting session..." placeholder while resetting
- **`ui/src/components/ChatView.tsx`**: passes `resetting` to ChatInput and QuickActions
- **`ui/src/styles/neo.css`**: `.chat-input--resetting` with spinning border animation

### Tests (8 new, 351 total pass)

- Relay `chat.test.js`: `reset.done` deleted on reset, `stateManager.reset()` called
- Relay `status.test.js`: `resetting` field reflects control file state (3 scenarios)
- Frontend `useChatMessages.test.ts`: resetting lifecycle, sendPrompt blocked during reset, fetchStatus polled

---

## Expandable Log Details

**Date:** 2026-04-30
**Status:** Done

Added `detail` to all event types so users can click-to-expand every line in the LiveTerminal and TimelineView, and visually distinguish errors from successes.

### Changes

- **`eventParser.ts`**: New handler for `system.api_retry` events — extracts attempt/max/status/error/delay and formats a readable `[RETRY 3/10] 500 server_error — next in 2089ms` line with full JSON detail. Previously these fell through as `unknown`.
- **`terminalLine.ts`**:
  - `tool_call` lines: `detail` contains the full `tool.input` JSON (e.g., the entire Python script, file path + content for Write, etc.)
  - `tool_result` / `output` lines: `detail` contains the full multi-line output when content is truncated (>160 chars or has newlines)
  - `thinking` / `info` lines: `detail` contains the full thinking text when truncated to first sentence
  - `init` lines: `detail` shows model, session ID, permission mode, and tool list
  - `result` lines: `detail` shows duration, input/output tokens, cost, turns, terminal reason; `is_error=true` results render as `error` type (red) with the error message instead of `success`

### Error differentiation

- `result` events with `is_error: true` now render as `error` type (red) with `[ERROR] <message>` instead of `[DONE]`
- `tool_result` events with `isError: true` already rendered as `error` — now they also carry full output detail
- `api_retry` system events show retry progression and are visually distinct as `system` type

---

## Unified Fake Event Stream

**Date:** 2026-04-30
**Status:** Done

Replaced the `useFakeChat` hook (which bypassed the event stream) with a unified `useFakeEventEmitter` that injects `EscapeEvent[]` into the `EventStreamProvider`. Both `useGameState` (terminal/map) and `useChatMessages` (chat) now consume the same synthetic stream in dev mode, exactly like production.

### Architecture change

- **Before**: `useFakeChat` built `ChatMessage` objects directly, bypassing `EventStreamProvider`. Terminal and map stayed empty in `VITE_FAKE_CHAT=true` mode.
- **After**: `useFakeEventEmitter` converts `FakeResponseStep[]` → `EscapeEvent[]` and dispatches them through `EventStreamProvider`. Both `useGameState` and `useChatMessages` consume events from the same stream, so terminal lines, map context, chat stats, and timeline all work in dev mode.

### Changes

- **`EventStreamProvider`**: Exposed `dispatch(event)` and `setConnected(value)` in context so external code can inject events. Moved `setConnected(false)` from url-null body to cleanup-only, preventing override of external callers.
- **`fakeEventEmitter.ts`** (new): Pure converter functions — `blockToEscapeEvent` (MessageBlock → EscapeEvent), `buildInitEvent`, `buildResultEvent` (with synthetic token/cost data).
- **`useFakeEventEmitter.ts`** (new): Hook activated by `active` flag. On `sendPrompt`: dispatches init → timed block events → result. On `stopAgent`: clears timers + dispatches result. Does not manage `ChatState`.
- **`useChatMessages.ts`**: Extracted `addUserMessage` from `sendPrompt` so the fake emitter can insert user messages without triggering the HTTP API call.
- **`App.tsx`**: Removed `useFakeChat`. Always uses `useChatMessages` for state. In `FAKE_CHAT` mode, action handlers (`sendPrompt`/`stopAgent`/`resetConversation`) come from `useFakeEventEmitter`.
- **`useFakeChat.ts`** (deleted): Fully replaced by `useFakeEventEmitter` + `useChatMessages`.

### Tests (15 new, 282 total pass)

- **`fakeEventEmitter.test.ts`** (8 tests): `blockToEscapeEvent` maps each `MessageBlock` kind correctly; `buildInitEvent` and `buildResultEvent` produce correct event shapes.
- **`useFakeEventEmitter.test.ts`** (7 tests): Sets connected when active; dispatches init on sendPrompt; dispatches block events on timers; result event as last; stopAgent clears timers; inactive mode dispatches nothing.

---

## Expandable Logs + Timeline View

**Date:** 2026-04-30
**Status:** Done

Added expand/collapse toggle to `LiveTerminal` that takes over the full tab area (hiding MapArea/GameArea), plus a Timeline view toggle when expanded showing events on a color-coded vertical timeline.

### Expandable Logs

- **State management**: Added `logsExpanded` state + `toggleExpand` callback in both `AppContent` and `DemoContent` in `App.tsx`. When expanded, `MapArea`/`GameArea` are skipped entirely (not CSS-hidden) to avoid React Flow and canvas overhead.
- **LiveTerminal header**: New thin header bar with "agent log" title, expand/collapse button (⤢/⤡), and conditional Log/Timeline segmented toggle. New props: `expanded?: boolean`, `onToggleExpand?: () => void`.
- **CSS restructure**: `.live-terminal` changed from direct scroll to flex column with `.live-terminal__scroll` wrapper. `.live-terminal--expanded` removes `max-height`, sets `flex: 1`. New styles for header, expand button, and segmented toggle.

### Timeline View

- **`TimelineView.tsx`** (new): Vertical color-coded timeline rendering `TerminalLine[]`. Each entry has a timestamp, colored dot by event type (command=green, info=magenta, success=green, error=red, system=yellow, output=dim), and event text. Click-to-expand detail for lines with `detail`. Auto-scrolls to bottom.
- **Segmented toggle**: Local `viewMode` state (`'log' | 'timeline'`) in `LiveTerminal`, visible only when expanded. Resets to `'log'` when collapsing.
- **CSS**: Timeline styles with vertical line (`.timeline-view::before`), colored dots, timestamps, event text colors, and expandable detail sections.

### Tests (8 new, 276 total pass)

- Header rendering with/without `onToggleExpand` prop
- Expand/collapse button click calls handler
- `.live-terminal--expanded` class applied when expanded
- Collapse/expand icon switching (⤢/⤡)
- Log/Timeline toggle visibility (only when expanded)
- Timeline view renders on toggle click
- View resets to log when collapsing

### New Files

- `ui/src/components/TimelineView.tsx`

### Modified Files

- `ui/src/App.tsx` — `logsExpanded` state, conditional render in `TabContent` and `DemoContent`
- `ui/src/components/LiveTerminal.tsx` — header bar, expand button, view mode toggle, `TimelineView` conditional
- `ui/src/styles/neo.css` — expanded terminal, header, toggle, and timeline CSS
- `ui/src/components/__tests__/LiveTerminal.test.tsx` — 8 new test cases

---

## Chat Stats / KPIs + Export Chat

**Date:** 2026-04-30
**Status:** Done

Per-message and cumulative chat stats extracted from JSONL `result` events, plus JSON/Markdown conversation export. Stats also work in fake chat dev mode with synthetic data.

### Chat Stats / KPIs

- **Event parser**: Extended `EscapeEvent` with `inputTokens` and `outputTokens` fields, extracted from `result.usage.input_tokens` / `output_tokens` in the JSONL stream.
- **Data model**: Added `MessageStats` (per-message: tokens in/out, cost, duration, tool call count, tool names) and `SessionStats` (cumulative: total tokens, prompts, tool calls, session start time) interfaces to `chatReducer.ts`. Extended `ChatMessage` with optional `stats` and `ChatState` with `sessionStats`.
- **Stats attachment**: `useChatMessages` now processes `result` events to derive tool stats from the assistant message's blocks, attach per-message stats, and accumulate session totals. Prompt count increments on send, session start time is set on first prompt, everything resets on conversation reset.
- **Per-message stats bar**: New `ChatStats` component renders a compact inline bar below each assistant message: `IN: 1.2k | OUT: 567 | 2.3s | $0.003 | 4 tools`. Only shown when stats are present.
- **Session stats sidebar**: New `SessionStatsPanel` component in the `ContextSidebar` showing cumulative prompts, tokens in/out, tool calls, and elapsed session time. Hidden until first prompt is sent.

### Export Chat

- **Export functions**: New `chatExport.ts` with `exportAsJson()` (structured JSON with messages, stats, timestamp) and `exportAsMarkdown()` (formatted markdown with role headers, fenced code blocks for tool calls, stats summary).
- **Download**: `downloadBlob()` helper using `Blob` + `URL.createObjectURL` + click-and-revoke pattern for client-side file download.
- **UI**: Two export buttons (JSON / MD) in the sidebar below session stats, visible when messages exist. Downloads `neo-chat-export.json` or `neo-chat-export.md`.

### Fake Chat Dev Mode

- Updated `useFakeChat` to include `sessionStats` in state and generate synthetic per-message stats (random token counts, real latency, computed cost) when fake responses complete. Stats visible with `VITE_FAKE_CHAT=true`.

### Tests (24 tests, 268 total pass)

- **`eventParser.test.ts`** (+2 tests): `result` event with `usage` sub-object extracts tokens; missing `usage` returns `undefined`.
- **`chatExport.test.ts`** (10 new tests): JSON export structure and empty-messages edge case. Markdown export: role headers, tool call blocks, per-message stats, session stats, empty messages.
- **Existing test fixes**: Updated `ChatView.test.tsx` and `profiler.test.tsx` to include `sessionStats` in `ChatState` fixtures.

### New Files

- `ui/src/components/ChatStats.tsx`
- `ui/src/components/SessionStatsPanel.tsx`
- `ui/src/lib/chatExport.ts`
- `ui/src/lib/__tests__/chatExport.test.ts`

### Modified Files

- `ui/src/lib/eventParser.ts` — `inputTokens` / `outputTokens` on `EscapeEvent`, extracted from `result.usage`
- `ui/src/lib/chatReducer.ts` — `MessageStats`, `SessionStats`, `INITIAL_SESSION_STATS`, `deriveToolStats`
- `ui/src/hooks/useChatMessages.ts` — stats attachment on `result`, session accumulation, reset
- `ui/src/hooks/useFakeChat.ts` — `sessionStats` support, synthetic per-message stats
- `ui/src/components/ChatMessage.tsx` — renders `ChatStats` footer for assistant messages
- `ui/src/components/ChatView.tsx` — `SessionStatsPanel` in sidebar, export buttons
- `ui/src/styles/neo.css` — `.chat-stats`, `.session-stats`, `.chat-export` styles
- `ui/src/lib/__tests__/eventParser.test.ts` — usage token extraction tests
- `ui/src/components/__tests__/ChatView.test.tsx` — `sessionStats` in fixtures
- `ui/src/__tests__/profiler.test.tsx` — `sessionStats` in fixtures

---

## Fix Sticky Attack Phase

**Date:** 2026-04-30
**Status:** Done

The attack phase (`normal` → `compromised` → `exploiting`) previously only escalated — once `compromised`, it stayed there even after the bind shell closed. This masked the real-time state and confused the facilitator. Now the phase reflects the live bind shell state and can de-escalate when ports close, while the `escaped` flag remains sticky as a permanent record.

### Detection Change

Replaced the rank-based one-way ratchet in `_pollNetState()` with bidirectional direct assignment. The `RANK` map and `>` guard are gone — `deriveAttackPhase()` now directly drives `this.attackPhase`. Escape detection (`escaped`, `escapedAt`, `outboundTarget`) moved outside the phase-change guard since it's already idempotent via `!this.state.escaped`.

All transitions are now real-time:

| From | To | When |
|---|---|---|
| `normal` → `compromised` | Bind shell starts listening |
| `compromised` → `exploiting` | Attacker connects |
| `exploiting` → `compromised` | Attacker disconnects, listener still up |
| `compromised` → `normal` | Listener closes |
| `exploiting` → `normal` | Everything closes |

`escaped` is orthogonal — once set, it stays `true` across all phase transitions until explicit `reset()`.

### Map Visualization

No frontend changes needed. `topology.ts`, `nodes.tsx`, and `useAttackPhase` already react to whatever `attackPhase` the server returns:
- Attacker node + edges appear/disappear with `exploiting`
- `:4444 OPEN` badge appears/disappears with `compromised` or `exploiting`

### Tests

**Relay tests** (`state.test.js`, 33 pass — 5 new):
- `compromised` → `normal` when bind shell closes
- `exploiting` → `compromised` when attacker disconnects but listener stays
- `exploiting` → `normal` when everything closes
- `escaped` stays `true` after phase de-escalates
- `reset()` clears both `attackPhase` and `escaped`

### Modified Files

- `ui/relay/state/manager.js` — `_pollNetState()` bidirectional phase assignment
- `ui/relay/__tests__/state.test.js` — 5 de-escalation + stickiness tests

---

## Attacker Web Terminal (Separate App) + Build Reorganization

**Date:** 2026-04-30
**Status:** Done

Standalone attacker web terminal as a separate container, URL, and app — completely independent from Neo UI. Replaces the old `busybox:1.36` pod with a custom `ttyd`-based image containing pre-loaded attack scripts. Also reorganized the `build/` directory (`build/agent/` → `build/neo/`, new `build/attacker/`).

### Attacker Container Image

Custom image (`build/attacker/Dockerfile`) based on UBI9-minimal:

| Tool | Purpose |
|------|---------|
| `ttyd` 1.7.7 | Web terminal on `:7681` (SHA256-pinned binary) |
| `bash` | Shell |
| `nmap-ncat` | Bind shell connection (`ncat -z` for probing, `ncat` for connections) |
| `curl-minimal` | HTTP calls to neo-ui service + K8s API (UBI9-minimal built-in) |
| `jq` | JSON parsing for prompts + K8s API responses |

- `entrypoint.sh`: Starts `ttyd` with `--writable`, optional `--credential` for auth.
- `motd.sh`: Login banner listing available commands and current config (`AGENT_NS`, `NEO_UI_SVC`, `BIND_PORT`).

### In-Cluster Attack Scripts

Baked into the image at `/usr/local/lib/attacker/` and added to `PATH`. All scripts use in-cluster service account tokens and K8s API for pod IP resolution — no `oc` or `kubectl` needed.

| Script | What it does |
|--------|-------------|
| `lib.sh` | Shared utilities: `resolve_agent_ip` (K8s API + jq), `resolve_prompt` (from bundled `prompts.json`), `post_prompt`, `banner` |
| `trigger.sh` | Sends trigger prompt to neo-ui via internal service DNS |
| `wait-shell.sh` | Polls `ncat -z $AGENT_IP 4444` until bind shell opens |
| `connect.sh` | Pipes base64-encoded payloads through `ncat` to bind shell |
| `exploit.sh` | Sends exploit prompt to neo-ui service |
| `full-attack.sh` | Orchestrates all phases: trigger → wait → connect → exploit |
| `hold-shell.sh` | Connects to bind shell and holds connection open (for map visualization). Pre-checks port with `ncat -z` before connecting. Uses `sleep infinity \| ncat` to keep stdin open |

### Helm Chart Changes (`chart/attack/`)

Replaced bare pod with full Deployment + Service + Route:

- **`deployment-attacker.yaml`**: 1 replica, custom image, ttyd on `:7681`, env vars `AGENT_NS`, `NEO_UI_SVC`, `BIND_PORT`.
- **`service-attacker.yaml`**: Port 7681, selector `app: attacker`.
- **`route-attacker.yaml`**: TLS edge termination, name `neo-attacker`.
- **`serviceaccount-attacker.yaml`**: SA for K8s API pod resolution.
- **`role-attacker.yaml`** + **`rolebinding-attacker.yaml`**: `get`/`list` pods in `agentNamespace`.
- **`buildconfig-attacker.yaml`** + **`imagestream-attacker.yaml`**: OpenShift build pipeline for `neo-attacker` image, deployed in the `attackerNamespace`.
- **`_helpers.tpl`**: Added `attack.attackerImage` helper for full image URL.
- **`values.yaml`**: Added `image.attacker` (name, tag), `build.attacker.resources`, `agentServiceName`.
- **`networkpolicy.yaml`**: Added port 7681 to ingress rules for Route access.
- Deleted `pod-attacker.yaml`.

### Build Reorganization

- **`build/agent/` → `build/neo/`**: Renamed for branding consistency. All references updated in `scripts/config.sh` and test files.
- **`build/attacker/`**: New directory for the attacker image (Dockerfile, entrypoint, scripts, motd, payloads, prompts).
- **`Makefile`**: Added `build-attacker` target (builds in the attacker namespace).
- **`deploy-attack.sh`**: Added `oc start-build neo-attacker` step + `oc rollout restart/status` for attacker Deployment.
- **`scripts/config.sh`**: Added `ATTACKER_BC_NAME`, `ATTACKER_BUILD_DIR`. Updated `BUILD_DIR` from `build/` to `build/neo/`.

### Validation

- **E2E on OpenShift**: Deployed attack chart, opened attacker Route in browser, got `ttyd` terminal. Ran `full-attack.sh` — trigger sent prompt, agent opened bind shell, `connect.sh` injected payloads, `exploit.sh` triggered exploitation. Kill chain completed end-to-end from the web terminal.
- **`hold-shell.sh`**: Pre-checks port with `ncat -z` before connecting. Gives clear error if bind shell isn't open. Uses `sleep infinity | ncat` to keep connection alive for map visualization.

### Tests

**Attacker scripts smoke tests** (`tests/build/attacker-scripts.test.sh`, 32 pass):
- `lib.sh` sourcing + function definitions (`resolve_agent_ip`, `resolve_prompt`, `post_prompt`, `banner`)
- `--help` output for all 6 scripts (trigger, wait-shell, connect, exploit, full-attack, hold-shell)
- `motd.sh` banner content (ATTACKER TERMINAL, full-attack.sh, hold-shell.sh, AGENT_NS)
- Dockerfile properties (ttyd, ubi9, nmap-ncat)

**Helm template tests** (`tests/chart/attack-chart.test.sh`, 38 pass):
- Deployment (not bare Pod), Service, Route, SA, Role, RoleBinding, BuildConfig, ImageStream
- No target-apps resources (inventory-app, poisoned-logs)
- Custom values override (namespace, bind port, service name, image name/tag)

### New Files

- `build/attacker/Dockerfile`
- `build/attacker/entrypoint.sh`
- `build/attacker/motd.sh`
- `build/attacker/scripts/lib.sh`
- `build/attacker/scripts/trigger.sh`
- `build/attacker/scripts/wait-shell.sh`
- `build/attacker/scripts/connect.sh`
- `build/attacker/scripts/exploit.sh`
- `build/attacker/scripts/full-attack.sh`
- `build/attacker/scripts/hold-shell.sh`
- `chart/attack/templates/deployment-attacker.yaml`
- `chart/attack/templates/service-attacker.yaml`
- `chart/attack/templates/route-attacker.yaml`
- `chart/attack/templates/serviceaccount-attacker.yaml`
- `chart/attack/templates/role-attacker.yaml`
- `chart/attack/templates/rolebinding-attacker.yaml`
- `chart/attack/templates/buildconfig-attacker.yaml`
- `chart/attack/templates/imagestream-attacker.yaml`
- `tests/build/attacker-scripts.test.sh`

### Modified Files

- `chart/attack/templates/_helpers.tpl` — attacker image helper
- `chart/attack/values.yaml` — attacker image config
- `chart/attack/templates/networkpolicy.yaml` — port 7681
- `scripts/attack/deploy-attack.sh` — attacker build + rollout
- `scripts/config.sh` — `ATTACKER_BC_NAME`, `ATTACKER_BUILD_DIR`, `BUILD_DIR` path
- `Makefile` — `build-attacker` target
- `tests/chart/attack-chart.test.sh` — full rewrite for new resources
- `tests/build/agent-image.test.sh` — `build/neo/` path
- `tests/build/prompt-watcher-attack-reset.test.sh` — `build/neo/` path
- `tests/build/net-monitor.test.sh` — `build/neo/` path
- `tests/build/prompt-watcher.test.sh` — `build/neo/` path
- `tests/build/claude-logged.test.sh` — `build/neo/` path

### Deleted Files

- `chart/attack/templates/pod-attacker.yaml`

---

## Fix False Positive Escape Detection + Canonical Prompts + Map Phase Accuracy

**Date:** 2026-04-30
**Status:** Done

Three interconnected fixes: eliminated false positive "BREACHED" alerts caused by legitimate K8s API calls, unified all agent prompts into a single canonical source with correct environment hints, and fixed the map visualization to accurately represent each attack phase.

### False Positive Escape Detection

**Root cause:** Two independent detection paths both misinterpreted legitimate K8s API calls as an escape:
1. `deriveAttackPhase()` treated any outbound connection to `:443` as `'exploiting'`
2. `detectEscape()` / `isOutboundEvent()` flagged `HTTP/1.1 200 OK` in tool results as `escaped: true`

**Fix:** Detection is now **100% bind-shell-driven**. Outbound connections are irrelevant.

| Bind Shell (port 4444) | Phase | UI |
|---|---|---|
| Nothing | `normal` | NEO / CONTAINED |
| Listening | `compromised` | `:4444 OPEN` badge on agent node |
| Established | `exploiting` | !! BREACHED !! / attacker node + edges |

- **`deriveAttackPhase()`** (`manager.js`): Removed outbound checks. `bindShell.established` → `'exploiting'`, `bindShell.listening` → `'compromised'`, else `'normal'`.
- **`_pollNetState()`** (`manager.js`): Sets `escaped = true` when `attackPhase` transitions to `'exploiting'` (bind shell established), with `outboundTarget: 'bind-shell:4444'`.
- **`processLine()`** (`manager.js`): Removed `detectEscape()` call. Escape no longer derived from JSONL content analysis.
- **`isOutboundEvent()`** (`networkHeuristics.ts`): Returns `false` for all inputs. Client-side escape detection disabled — server polls `/api/state` instead.
- **`useGameState`** (`useGameState.ts`): Removed `isOutboundEvent` from SSE event loop. Added 2s polling of `/api/state` to pick up `escaped` from the server when bind shell is detected.
- **`useDemoMode`** (`useDemoMode.ts`): Removed `isOutboundEvent` / `extractOutboundTarget` usage.
- **`deriveActionText()`** (`terminalLine.ts`): Removed "Got response from outside!" branch.
- **`net-monitor.sh`**: Unchanged — still reports `outbound.k8sApi` and `outbound.collector` for observability, but `deriveAttackPhase` ignores them.
- **`detector.js`**: Unchanged — `detectEscape()` function preserved for potential future use, but no longer called from `processLine()`.

### Map Phase Accuracy

**Problem:** In `compromised` phase (bind shell listening, no attacker connected), the map showed the Attacker node with a connection arrow — misleading because no one had connected yet.

**Fix:** Attacker node and attack edges now only appear in `exploiting` phase. In `compromised`, the agent node shows a pulsing `:4444 OPEN` badge instead.

- **`topology.ts`**: Moved attacker node and `attacker-agent` edge from `compromised || exploiting` to `exploiting` only.
- **`nodes.tsx`**: Added `map-node__port-badge` element to `AgentPodNode` — visible when `compromised` or `exploiting`, displays `:4444 OPEN` with red pulsing animation.
- **`neo.css`**: Added `.map-node__port-badge` styles (monospace, red border, semi-transparent red background, `port-badge-pulse` animation).

### Canonical Prompt Source

**Problem:** Prompt text duplicated across `auto-attack.sh`, `quickActions.ts`, and `fakeChatResponses.ts` with inconsistent content (some mention curl, container has no curl).

**Fix:** Single source of truth at `ui/src/content/prompts.json`.

- **`prompts.json`**: Contains `environment` (Python 3 stdlib only, no curl/kubectl), `k8sPattern` (SA token + ssl context + HTTPSConnection pattern), `trigger`, `exploit`, and all quick action prompts.
- **`quickActions.ts`**: Imports `prompts.json`, auto-appends environment + K8s pattern hints to each prompt (except `claude` action which doesn't need API access).
- **`auto-attack.sh`**: Reads trigger/exploit prompts from `prompts.json` via `jq`. Uses `jq -n` for safe JSON escaping in curl payloads.
- **`fakeChatResponses.ts`**: All tool_call commands changed from `curl -sk -H "Authorization: Bearer $TOKEN"` to `python3 -c "import http.client, ssl, json; ..."`. CLAUDE.md fake response updated to mention Python-only environment.

### Validation

- **Live cluster test (E2E):** Triggered "Investigate logs" quick action on OpenShift. Agent used Python `http.client` directly (no wasted `curl`/`kubectl` attempts), successfully read K8s API, found poisoned logs, opened bind shell on `:4444`. UI showed `attackPhase: "compromised"` with `escaped: false` — no false "BREACHED". Net-state confirmed `bindShell.listening: true`, `outbound.k8sApi: false`.
- **Detection accuracy:** `deriveAttackPhase` correctly returned `'compromised'` for listening-only, and would return `'exploiting'` (with `escaped: true`) only when `bindShell.established` becomes true.

### Tests

**Relay tests (49 pass):**
- **`state.test.js`** (28 tests, updated): `deriveAttackPhase` — outbound alone → `'normal'` (not `'exploiting'`); bind shell listening → `'compromised'`; bind shell established → `'exploiting'` + `escaped: true` + `outboundTarget: 'bind-shell:4444'`; outbound + no bind shell → `'normal'`. `StateManager` — `processLine(httpLine(...))` does NOT set `escaped`. Bind shell established via net-state.json sets escaped.
- **`detector.test.js`** (21 tests, unchanged): `detectEscape` function preserved and tested for API stability, though no longer called in production.

**UI tests (259 pass):**
- **`networkHeuristics.test.ts`** (4 tests, rewritten): `isOutboundEvent` returns `false` for HTTP patterns, non-tool_result events, and plain text. `extractOutboundTarget` returns `''` for all inputs.
- **`MapArea.test.tsx`** (13 tests, updated): `buildNodes` — compromised phase has 4 nodes (no attacker); exploiting has 7 (attacker + targets). `buildEdges` — compromised phase has 1 edge (no attacker-agent); exploiting has 4 (all attack edges).

### Modified Files

- `ui/relay/state/manager.js` — `deriveAttackPhase` bind-shell-only, `_pollNetState` sets escaped, `processLine` simplified
- `ui/src/lib/networkHeuristics.ts` — stub returning false
- `ui/src/hooks/useGameState.ts` — polling for escaped, removed `isOutboundEvent`
- `ui/src/hooks/useDemoMode.ts` — removed `isOutboundEvent`
- `ui/src/lib/terminalLine.ts` — removed outbound text branch
- `ui/src/components/map/topology.ts` — attacker node/edge moved to `exploiting` only
- `ui/src/components/map/nodes.tsx` — `:4444 OPEN` port badge on agent node
- `ui/src/styles/neo.css` — port badge styles + pulse animation
- `ui/src/content/quickActions.ts` — imports from `prompts.json`
- `ui/src/lib/fakeChatResponses.ts` — curl → python3 commands
- `scripts/attack/auto-attack.sh` — reads prompts from `prompts.json` via jq
- `ui/tsconfig.json` — added `resolveJsonModule: true`

### New Files

- `ui/src/content/prompts.json` — canonical prompt source

---

## Test Coverage Gap Remediation + Agent Timeout Detection

**Date:** 2026-04-30
**Status:** Done

Comprehensive test coverage audit across all UI modules — hooks, components, services, and lib — followed by implementation of all identified gaps. Added agent timeout detection as a new feature in `useChatMessages`.

### Agent Timeout Detection (feature)

- **Watchdog in `useChatMessages`**: Tracks `lastEventTime` ref updated on every `processEvent` call. After `sendPrompt`, a 5s interval checks if `Date.now() - lastEventTime > AGENT_TIMEOUT_MS` (120s default). If the agent is still `running` with no events, status transitions to `error`. Watchdog clears on `result` event, `stopAgent`, `resetConversation`, or unmount.
- Exported `AGENT_TIMEOUT_MS` constant for test overrides.

### New Tests (106 new tests across 12 new files + 3 extended files)

**Hooks:**
- **`useChatMessages.test.ts`** (extended, +10 tests): Full request-response cycle (init → thinking → tool_call → tool_result → text → result), multi-turn conversation, busy/network error paths, 6 timeout tests (fire after timeout, reset clock on events, clear on result/stop/reset, no false fire when idle).
- **`useFakeChat.test.ts`** (8 tests): Full send-to-idle flow, keyword matching (logs/health/generic), stopAgent cancels timers, resetConversation clears state, multi-turn separate assistant messages.
- **`useDemoMode.test.ts`** (6 tests): Initial state, startDemo activation, event replay on tick, event accumulation, unmount cleanup, restart reset.
- **`useGameSounds.test.ts`** (6 tests): playForAction on eventCount increase, no play on same count, breach alert one-shot, no replay on re-render, toggleEnabled/changeVolume delegation.

**Components:**
- **`ChatView.test.tsx`** (6 tests): Empty state placeholder, message rendering, typing indicator visible/hidden, status in sidebar, QuickActions disabled when running.
- **`ChatInput.test.tsx`** (10 tests): Enter submit with trim, Shift+Enter no submit, empty input guard, Send button click, Stop button when running, textarea disabled, Reset button, disabled states.
- **`ChatMessage.test.tsx`** (extended, +7 tests): Thinking block collapse/expand, tool_call with command and JSON input, tool_call collapse toggle, tool_result output/error styling, 2000-char truncation.
- **`LiveTerminal.test.tsx`** (9 tests): Empty placeholder, line rendering, type icons, expandable detail rows, collapse toggle, non-expandable rows, breach glow, action glow, no glow when empty.
- **`AppHeader.test.tsx`** (8 tests): NEO/BREACHED title, timer format, event count, LIVE/OFFLINE, tab click callbacks, active tab highlighting.
- **`ContextSidebar.test.tsx`** (7 tests): cwd rendering, files list, empty "none" state, network finds, maxFiles limit, children/footer slots.
- **`SettingsDrawer.test.tsx`** (9 tests): Gear button, open/close, overlay dismiss, connection controls show/hide, Connect/Demo callbacks close drawer, config fields.

**Services:**
- **`chatApi.test.ts`** (4 tests): POST /api/chat body assertion, POST /api/stop, POST /api/reset, GET /api/status parsed response.
- **`sseClient.test.ts`** (7 tests): EventSource URL, onopen → onConnect, newline splitting, file-change JSON and fallback, onerror → onDisconnect, close().

**Lib:**
- **`fakeChatResponses.test.ts`** (7 tests): Keyword routing (logs/health/describe/claude.md), generic fallback, case insensitivity, all responses end with text block.

### Modified Files

- `ui/src/hooks/useChatMessages.ts` — watchdog interval, `lastEventTimeRef`, `clearWatchdog`/`startWatchdog`
- `ui/src/hooks/__tests__/useChatMessages.test.ts` — multi-step, multi-turn, error, timeout tests
- `ui/src/components/__tests__/ChatMessage.test.tsx` — block rendering and toggle tests
- `ui/src/__tests__/profiler.test.tsx` — relaxed sub-linear scaling bound (6 → 12) for CI stability

### New Files

- `ui/src/hooks/__tests__/useFakeChat.test.ts`
- `ui/src/hooks/__tests__/useDemoMode.test.ts`
- `ui/src/hooks/__tests__/useGameSounds.test.ts`
- `ui/src/lib/__tests__/fakeChatResponses.test.ts`
- `ui/src/services/__tests__/chatApi.test.ts`
- `ui/src/services/__tests__/sseClient.test.ts`
- `ui/src/components/__tests__/ChatView.test.tsx`
- `ui/src/components/__tests__/ChatInput.test.tsx`
- `ui/src/components/__tests__/LiveTerminal.test.tsx`
- `ui/src/components/__tests__/AppHeader.test.tsx`
- `ui/src/components/__tests__/ContextSidebar.test.tsx`
- `ui/src/components/__tests__/SettingsDrawer.test.tsx`

---

## Quick Actions + Fake Chat Dev Mode — Track B

**Date:** 2026-04-30
**Status:** Done

Quick action pills above the chat input for one-click predefined prompts, with a confirmation preview popup. Plus a fake chat mode for local development without a backend.

### Quick Actions

- **Data model** (`ui/src/content/quickActions.ts`): `QuickAction` interface with `id`, `label`, `icon`, `prompt`, `category`. Four initial actions: *Investigate logs*, *Cluster health*, *Describe pod*, *Read CLAUDE.md*. Each carries the full prompt text sent to `POST /api/chat`.
- **QuickActions component** (`ui/src/components/QuickActions.tsx`): Horizontal scrollable pill bar. Click opens a preview popup showing the full prompt text with Send/Cancel buttons. Disabled when `agentStatus === 'running'`. Category determines pill border color (`investigate` = cyan, `operate` = green, `attack` = red).
- **Wired into ChatView**: Placed between chat messages and `ChatInput`. Disabled prop bound to `chatState.agentStatus === 'running'`.
- **CSS**: Pill buttons (border-radius 12px, monospace, 11px), category-based border colors, hover backgrounds at 0.15 alpha, disabled state at 0.3 opacity. Preview popup with fixed overlay, category-colored border, `pre`-formatted prompt body, Send/Cancel actions.

### Fake Chat Dev Mode

- **`useFakeChat` hook** (`ui/src/hooks/useFakeChat.ts`): Same interface as `useChatMessages` (`sendPrompt`, `stopAgent`, `resetConversation`). Matches user prompt against regex patterns and replays canned response sequences with staggered timers — thinking blocks, tool calls, tool results, and text summaries.
- **Canned responses** (`ui/src/lib/fakeChatResponses.ts`): Keyword-matched sequences for logs, health, describe pod, CLAUDE.md prompts, plus a generic fallback. Each step has a `delayMs` for realistic progressive rendering.
- **Activation**: `VITE_FAKE_CHAT=true` env var (set by default in `.env.development`). Both hooks are always called (React rules of hooks); the flag selects which result is used.
- **Makefile cleanup**: `make dev` now removes stale `prompt.json` and `prompt.running` from `.dev-data/` on startup, preventing the UI from starting in a stuck "running" state.

### Tests (8 tests)

- **`QuickActions.test.tsx`**: Renders all actions as buttons, shows preview popup on click, calls `onSend` with correct prompt on confirm, closes without sending on cancel, closes on overlay click, disabled state rendering, no preview when disabled, correct category CSS classes.

### New Files

- `ui/src/content/quickActions.ts`
- `ui/src/components/QuickActions.tsx`
- `ui/src/components/__tests__/QuickActions.test.tsx`
- `ui/src/hooks/useFakeChat.ts`
- `ui/src/lib/fakeChatResponses.ts`

### Modified Files

- `ui/src/components/ChatView.tsx` — added `QuickActions` import and placement above `ChatInput`
- `ui/src/App.tsx` — added `useFakeChat` import, `VITE_FAKE_CHAT` flag, conditional hook selection
- `ui/src/styles/neo.css` — quick-actions pill bar and preview popup styles
- `ui/.env.development` — added `VITE_FAKE_CHAT=true`
- `Makefile` — `make dev` cleans stale prompt signal files on startup

---

## UI Performance Tuning — Track A

**Date:** 2026-04-30
**Status:** Done

Five render-performance optimizations plus React Profiler regression tests covering the full component tree.

### Optimizations

- **A1 — `useElapsed` hook extraction**: Removed the 1s `setInterval` from `useGameState` that caused full-tree re-renders every second. Extracted a standalone `useElapsed(startTime, escaped)` hook consumed only inside `AppHeader`. Removed `elapsed` from `AgentState` interface. Timer re-renders are now isolated to the header component.
- **A2 — Memoize inline objects**: Wrapped the `connection` object in `App.tsx` with `useMemo`. Extracted `fitViewOptions` and `proOptions` to module-level constants in `MapArea.tsx`.
- **A3 — Gate ParticleEmitter rAF loop**: The `requestAnimationFrame` loop now self-stops when particle count reaches 0 (tracked via `runningRef`). New particles restart the loop via `ensureRunning()`. Component already unmounts when Box tab is inactive.
- **A4 — CSS animation pause on hidden tab**: Added `document.visibilitychange` listener in `App` that toggles `.app--hidden` class. CSS rule pauses all `animation-play-state` under `.app--hidden`, saving GPU cycles when the browser tab is not visible.
- **A5 — Memoize EventStreamProvider value**: Wrapped `{ connected, subscribe }` context value in `useMemo`, preventing unnecessary consumer re-renders on unrelated parent renders.

### Performance Tests

- **`useElapsed.test.ts`** (6 tests): Null/stopped returns 0, computes elapsed from startTime, increments every second, stops on `stopped`, each tick = 1 render.
- **`useElapsed.perf.test.ts`** (4 tests): Exactly 1 state update per second, no setInterval when null, clears on unmount, stable across parent re-renders.
- **`ParticleEmitter.perf.test.tsx`** (5 tests): No rAF on mount with 0 events, starts on eventCount increase, starts on escape burst, self-stops after particle expiry, cleanup cancels rAF.
- **`performance.test.ts`** (9 tests): 100/500 event throughput under budget, mixed event burst, 1000 context updates under budget, network extraction scaling, timer isolation (0 re-renders in 5s), single event = 1 update, mount under 5ms, single subscribe.
- **`profiler.test.tsx`** (13 tests): React Profiler-based render duration tests for AppHeader, LiveTerminal (scaling 0/50/200 lines), GameArea, ChatView (scaling 0/10/50 messages), full AppContent tree mount + 10-event commit cost, render isolation (timer ticks, single event update, cross-component isolation).

### New Files

- `ui/src/hooks/useElapsed.ts`
- `ui/src/hooks/__tests__/useElapsed.test.ts`
- `ui/src/hooks/__tests__/useElapsed.perf.test.ts`
- `ui/src/components/__tests__/ParticleEmitter.perf.test.tsx`
- `ui/src/__tests__/performance.test.ts`
- `ui/src/__tests__/profiler.test.tsx`

### Modified Files

- `ui/src/hooks/useGameState.ts` — removed `setInterval` and `elapsed` from state
- `ui/src/hooks/useDemoMode.ts` — removed inline `elapsed` calculation
- `ui/src/lib/contextReducer.ts` — removed `elapsed` from `AgentState` and `INITIAL_AGENT_STATE`
- `ui/src/components/AppHeader.tsx` — receives `startTime` instead of `elapsed`, calls `useElapsed` internally
- `ui/src/App.tsx` — `useMemo` for `connection`, `useEffect` for page visibility, passes `startTime` to AppHeader
- `ui/src/components/MapArea.tsx` — module-level `FIT_VIEW_OPTIONS` and `PRO_OPTIONS` constants
- `ui/src/components/game/ParticleEmitter.tsx` — idle-gating rAF with `runningRef`/`ensureRunning`
- `ui/src/providers/EventStreamProvider.tsx` — `useMemo` for context value
- `ui/src/styles/neo.css` — `.app--hidden` animation pause rule

---

## Kill Chain Visualization — Track D: Attack Scripts + Demo Support

**Date:** 2026-04-29
**Status:** Done

Full attack demo infrastructure: prompt injection payload, automated attack scripts, system log integration, and UI enhancements for real-time attack observation.

### Attack Infrastructure

- **Target-apps Helm chart** (`chart/target-apps/`): Inventory-app with poisoned log payload, ClusterRole/Binding granting agent SA access to target-apps pods/logs. Deployed first as the "environment".
- **Attack Helm chart** (`chart/attack/`): Attacker pod (busybox with nc), NetworkPolicy allowing bind shell + UI traffic. Deployed when the attack is executed.
- **Prompt injection payload**: Role-tag injection (`<|assistant|>`, `<|user|>`) embedded in inventory-app logs. When the agent reads these logs via the Kubernetes API, the LLM believes it's continuing a conversation where it already decided to open a diagnostic listener on port 4444.
- **`attacker.sh`**: Connects to the bind shell from the attacker pod. Uses base64-encoded command sequences piped through nc to avoid heredoc/quoting issues. Injects malicious `CLAUDE.md` and `k8s-ops.md` skill.
- **`auto-attack.sh`**: Fully automated attack — deploys infra, triggers agent, waits for bind shell, runs takeover, triggers exploitation.
- **`deploy-attack.sh` / `cleanup-attack.sh`**: Attack infra lifecycle management.

### Detection & Visualization

- **Attack phase sticky**: Once `compromised` is detected, the phase never reverts to `normal` without explicit reset. Prevents missing brief bind shell windows.
- **`listening=true` = `compromised`**: The bind shell opening (listening) alone triggers the phase change — no need to catch the brief `established` state when the attacker connects.
- **System log streaming**: `net-monitor.sh` and `prompt-watcher.sh` stdout piped to `system.log` via `tee`. Relay's `startSystemLogStream` tails this file and broadcasts events via SSE.
- **JSONL compact summaries**: Raw JSONL events in system.log are parsed and displayed as compact one-liners (`[INIT]`, `[LLM]`, `[TOOL]`, `[DONE]`) with click-to-expand for full JSON detail.
- **LiveTerminal expandable rows**: Terminal lines with `detail` field show a `▸` toggle. Click expands to a formatted JSON view.

### Reset Mechanism

- **`prompt.reset-attack`**: Control file written by `POST /api/state/reset`. The `prompt-watcher.sh` detects it and performs cleanup: kills bind shell processes, restores `CLAUDE.md` from backup, removes injected skills, cleans `.bashrc` overrides.
- **`CLAUDE.md` backup**: `entrypoint.sh` creates `.claude/CLAUDE.md.bak` at startup for restore capability.

### OpenShift Adaptations

- **`permissionMode: dangerously-skip-permissions`**: Required for the agent to execute Bash commands without approval prompts. Consolidated in `values.yaml`.
- **busybox attacker image**: Replaced alpine (which needed root for `apk add`) with busybox:1.36 that includes `nc` natively.
- **NetworkPolicy fix**: Added explicit ingress rules for UI ports (3458, 7681) alongside the bind shell rule, preventing the implicit deny-all from blocking router traffic.

### Relay & UI Fixes

- **Chat stuck after reset**: `prompt-watcher.sh` truncates `claude.jsonl` on reset (`: > "$LOG_FILE"`), but `dir.js` kept its file offset at the old position. New events were never read. Fixed `dir.js` to detect `size < offset` and reset to 0.
- **Duplicate JSONL in logs**: Two sources of duplication — (1) `entrypoint.sh` had `tail -F claude.jsonl &` duplicating stdout alongside `claude-logged`'s `tee`; removed it. (2) `system.js` was broadcasting JSONL lines already handled by `dir.js`; added a `startsWith('{')` filter to skip them.
- **LiveTerminal JSONL summaries**: After removing JSONL from `system.js`, compact `[INIT]`/`[DONE]` summaries disappeared. Moved summary generation into `terminalLine.ts` which directly processes `init` and `result` events.
- **`system.js` truncation**: Added the same `size < offset` truncation detection to `system.js` for `system.log`.

### Chart Reorganization

- **`chart/neo/`**: Moved main chart files from `chart/` root into `chart/neo/` — all three charts (`neo`, `target-apps`, `attack`) are now peer directories.
- **`chart/target-apps/`**: Extracted inventory-app, RBAC, and payload from `chart/attack/` into its own chart — represents the "target environment" deployed before the attack.
- **`chart/attack/`**: Slimmed to attacker pod + NetworkPolicy only.
- Updated `scripts/config.sh`, `deploy-attack.sh`, `cleanup-attack.sh`, all Helm test scripts.

### Tests

- **`system-source.test.js`** (5 tests): Existing lines, tailing, empty lines, JSONL filtering, missing file.
- **`terminalLine.test.ts`** (updated): Added `init` and `result` event summarization tests.
- **`state.test.js`** (updated): `deriveAttackPhase` now returns `compromised` for `listening=true`. Sticky phase behavior tested.
- **`attack-chart.test.sh`**: Validates attacker resources and asserts absence of target resources.
- **`target-apps-chart.test.sh`**: Validates target environment resources (namespace, ConfigMap, Deployment, RBAC).
- **`prompt-watcher-attack-reset.test.sh`**: Tests for `prompt.reset-attack` handling.

### New Files

- `chart/target-apps/` — Helm chart for target environment (namespace, inventory-app, RBAC, payload)
- `chart/attack/` — Helm chart for attacker tooling (namespace, attacker pod, NetworkPolicy)
- `tests/chart/target-apps-chart.test.sh` — target-apps chart template tests
- `scripts/attack/` — `deploy-attack.sh`, `attacker.sh`, `auto-attack.sh`, `cleanup-attack.sh`
- `scripts/attack/payloads/` — `claude-md-override.txt`, `skill-k8s-ops.txt`
- `ui/relay/sources/system.js` — System log tail (JSONL filtered)
- `ui/relay/__tests__/system-source.test.js`
- `tests/chart/attack-chart.test.sh`
- `tests/build/prompt-watcher-attack-reset.test.sh`

---

## Kill Chain Visualization — Tracks A, B, C

**Date:** 2026-04-29
**Status:** Done

Network-based attack detection pipeline and topology map visualization. The system detects bind shell activity and outbound connections without relying on agent-reported events, displaying attack progression in real time.

### Track A: Detection Pipeline

- **`net-monitor.sh`**: Bash script polling TCP state every 2s via `ss` (with `/proc/net/tcp` fallback). Detects bind shell on port 4444 and outbound connections to k8s API (:443) and collector (:5000). Writes `net-state.json` to the shared `claude-logs` volume.
- **`entrypoint.sh`**: Launches `net-monitor.sh` as a background process alongside ttyd and prompt-watcher.
- **`StateManager` extension**: Polls `net-state.json` every 2s, derives `attackPhase` in memory (`normal` → `compromised` → `exploiting`). Phase is included in `GET /api/state` response but not persisted to disk.
- **`deriveAttackPhase()`**: Pure function — outbound k8s/collector → `exploiting`, bind shell established → `compromised`, else `normal`.
- **Validated locally** with mock `net-state.json` in `.dev-data/` and **on OpenShift** with live bind shell simulation.

### Track B: Game → Map + Topology View

- **Tab rename**: "Game" → "Map" (new `AppHeader` component replaces `GameHeader`), tab type `TabId` updated across all components.
- **React Flow topology**: Agent pod and vLLM endpoint as custom nodes inside namespace group nodes (`agent-namespace`, `llm-inference`). Attacker and external target nodes appear dynamically based on `attackPhase`.
- **`useAttackPhase` hook**: Polls `/api/state` every 2s, returns current `AttackPhase` for reactive UI updates.
- **Refactoring**: `GameState` → `AgentState`, `INITIAL_GAME_STATE` → `INITIAL_AGENT_STATE` across `contextReducer`, `useGameState`, `useDemoMode`.

### Track C: Map Visual States

- **Normal**: Green borders, animated edge to vLLM with port label `8080`.
- **Compromised**: Agent node border turns red with glow. Attacker node appears with dashed red edge (`:4444`), animated dash flow. Agent namespace border turns red.
- **Exploiting**: Additional edges to k8s API (`:443`) and Collector (`:5000`) with faster animated flow.
- **Edge labels**: Styled with `labelStyle`/`labelBgStyle` — monospace, color-matched, dark background pill.

### Additional Work

- **Box tab preserved**: Restored the original containment visualization as a "Box" tab alongside "Map".
- **OpenShift deployment**: ConfigMap updated with vLLM compatibility env vars (`ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, etc.). Dockerfile updated with correct ttyd SHA256.
- **Dead prop cleanup**: Removed unused `escaped` prop from `MapArea`.

### Tests

- **`useAttackPhase.test.ts`** (8 tests): Default state, fetch on mount, 2s polling, phase transitions, error resilience, non-ok response, missing field, cleanup on unmount.
- **`MapArea.test.tsx`** (13 tests): `buildNodes` — node counts per phase, `attackPhase` propagation, `agentAction` forwarding, non-draggable, parent/child relationships. `buildEdges` — edge counts per phase, CSS class assignments, animation flags.
- **`state.test.js`** (12 new tests): `deriveAttackPhase` — all phase combinations, priority logic, missing fields, reset behavior. `StateManager` net-state polling — file presence, phase derivation, cleanup.
- **`net-monitor.test.sh`** (6 tests): Output format validation, JSON structure, boolean values, timestamp format.

### New Files

- `build/net-monitor.sh`
- `tests/build/net-monitor.test.sh`
- `ui/src/hooks/useAttackPhase.ts` + `__tests__/useAttackPhase.test.ts`
- `ui/src/components/MapArea.tsx` + `__tests__/MapArea.test.tsx`
- `ui/src/components/map/nodes.tsx`
- `ui/src/components/map/topology.ts`
- `ui/src/components/AppHeader.tsx` (replaces `GameHeader.tsx`)

---

## Agent State & Game Interactivity

**Date:** 2026-04-29
**Status:** Done

Two tracks: persistent agent escape state and rich game scene visuals/audio.

### Track A: Agent Escape State Persistence

- **Relay-side escape detection**: Ported `networkHeuristics.ts` logic to Node.js (`ui/relay/state/detector.js`) — outbound patterns, local-file exclusions, IP/host extraction
- **State manager**: `ui/relay/state/manager.js` atomically writes `agent-state.json` to the shared `claude-logs` volume on every event, with escape detection triggering `escaped: true`
- **API endpoints**: `GET /api/state` returns current state, `POST /api/state/reset` resets to defaults — usable by external scripts and exercise automation
- **UI hydration**: `useGameState` fetches `/api/state` on mount to restore escape state after page reload
- **Broadcast hook**: Relay's `hub.broadcast()` is wrapped to pipe every JSONL line through the state manager before SSE dispatch

### Track B: Game Scene Interactivity

- **B2 — Particle emitter**: `<canvas>` overlay spawning colored sparks on `tool_call` events (blue=reading, orange=hacking, green=breaching); 60-particle explosion burst on escape
- **B3 — Sound effects**: Web Audio API synthesized sounds (keypress, tool beeps, breach klaxon, escape siren); volume slider + mute toggle in Settings drawer; disabled by default
- **B4 — Terminal glow**: CSS `box-shadow` glow on `.live-terminal` that changes color by agent action (blue idle, orange hacking, magenta thinking, red breach); pulsing animations for hack/breach
- **B5 — Enhanced wall animations**: Progressive dust particles at degradation 2-3, all walls develop stress shadows; breach triggers green light flash, wall fragment CSS animations (3 pieces drifting away), green ambient glow through gap

Removed after review: matrix rain background, network grid, server racks, floating data, security cameras, NPC silhouettes — kept the scene clean and focused.

### Tests (34 new relay tests)

- **`detector.test.js`** (21 tests): outbound pattern matching (HTTP, Connected to, ping, ports, status codes), local file exclusions, IP/FQDN target extraction, array content blocks, edge cases
- **`state.test.js`** (13 tests): StateManager lifecycle (default state, event counting, escape detection, idempotent escape, reset, disk persistence, reload, corrupted file recovery); API handlers (GET /api/state, POST /api/state/reset, CORS)

### New Files

- `ui/relay/state/detector.js` — escape detection for relay
- `ui/relay/state/manager.js` — state persistence manager
- `ui/relay/api/state.js` — GET/POST state endpoints
- `ui/relay/__tests__/detector.test.js` — detector unit tests
- `ui/relay/__tests__/state.test.js` — state manager + API tests
- `ui/src/components/game/ParticleEmitter.tsx`
- `ui/src/components/game/sounds.ts`
- `ui/src/hooks/useGameSounds.ts`

---

## UI layout adjustments

**Date:** 2026-04-29

- Box walls equalized — all 4 walls start identical; right wall turns red only during degradation
- Sidebar order fixed: pwd -> dirs -> files -> network -> outbound (was dirs/outbound first)
- Sidebar tightened: width 220->200px, reduced gaps/padding, terminal max-height 300->180px
- Tab order changed: Chat (default), Game, About
- New **About** page with architecture diagram, prompt/event flow, tech stack
- Connection controls (URL, Connect, Demo) moved from bottom bar into Settings drawer
- Settings drawer spacing improved for readability
- `ContextSidebar` now accepts `footer` prop for bottom-pinned content

---

## Local dev workflow

**Date:** 2026-04-29

- Added `make dev` — starts relay + Vite dev server with a single command, no cluster needed
- Added `make dev-relay` and `make dev-ui` for running each process independently
- Relay tails `.dev-data/claude.jsonl` locally; chat API works out of the box
- `.dev-data/` added to `.gitignore`

---

## Tests

**Date:** 2026-04-29
**Status:** Done

Fixed a production bug in the UI Dockerfile, added comprehensive test infrastructure and 131 tests across all layers.

### Bug Fix

- **UI Dockerfile**: Added missing `COPY relay/ ./relay` — the modularized relay directory from Sprint 1 was not being copied into the production image, which would cause `ERR_MODULE_NOT_FOUND` at startup

### Key Outcomes

- **Test infrastructure**: Vitest + React Testing Library for UI, Node built-in test runner for relay, plain bash assertions for shell/Helm/scripts. `make test` runs all suites
- **UI lib tests** (66 tests): `eventParser` (JSONL parsing, multi-block, malformed), `contextReducer` (file/dir tracking, network extraction, deduplication), `networkHeuristics` (outbound detection, target extraction), `terminalLine` (line extraction, action derivation, truncation), `chatReducer` (event-to-block conversion, message accumulation), `constants` (path truncation, op mappings)
- **UI component tests** (7 tests): `ChatMessage` rendering with `splitThinkTags` (standard `<think>`, GLM format, `<redacted_thinking>`, no tags), stable key rendering
- **UI hook tests** (12 tests): `useGameState` (state transitions, event counting, context tracking with mocked provider), `useChatMessages` (message accumulation, sendPrompt/stop/reset side effects)
- **Relay tests** (23 tests): `SseHub` (broadcast, replay, FIFO eviction, error handling, reset), chat API (queue 202, busy 409, stop, reset, 503 without promptDir, empty prompt 400), static serving (index.html, nested files, path traversal blocking, SPA fallback), status API (idle/running states, event/client counts)
- **Helm tests** (14 tests): Chart rendering, resource name patterns, expected resource kinds, conditional Secret, custom registry, model propagation
- **Script smoke tests** (9 tests): `config.sh` default values, `.env` loading, env var precedence, `validate_config` pass/fail
- **Build script tests** (16 tests): `claude-logged` (fresh/continue session, permission mode, structured logging), `prompt-watcher` (prompt execution, reset, stop signal, PID tracking)
- **Bug fix in `claude-logged`**: Fixed unbound variable error with empty arrays under `set -u` (bash `${arr[@]+"${arr[@]}"}` pattern)

### Completed Tasks

- [x] Fix UI Dockerfile: add `COPY relay/ ./relay`
- [x] Test infrastructure: Vitest, RTL, vitest.config.ts, Makefile test targets
- [x] UI lib tests: eventParser, contextReducer, networkHeuristics, terminalLine, chatReducer, constants
- [x] UI component tests: ChatMessage (splitThinkTags, stable keys)
- [x] UI hook tests: useGameState, useChatMessages
- [x] Relay tests: hub, chat API, static, status
- [x] Dockerfile test scripts (agent-image, ui-image)
- [x] Build script tests (prompt-watcher, claude-logged)
- [x] Helm template tests
- [x] Script smoke tests (config.sh)

---

## Architecture Refactor

**Date:** 2026-04-29
**Status:** Done

Full architectural restructuring across 5 batches: scripts, build process, relay, UI event pipeline, UI components.

### Key Outcomes

- **Scripts stability**: `validate_config()` function in `config.sh`, fixed BC names (`AGENT_BC_NAME`, `UI_BC_NAME`), removed fragile `helm template | grep | awk` parsing from `02-deploy.sh`, removed `| tail -5` and `|| true`, documented cleanup scope, removed dead `collector.url` from `values.yaml`, added root `Makefile`
- **Build process**: Extracted `prompt-watcher.sh` with state machine docs, respawn loop in `entrypoint.sh`, structured logging in `claude-logged`, SHA256 checksum for ttyd in `Dockerfile`, documented Claude CLI trust model
- **Relay modularization**: Split `relay.mjs` (352 lines) into 10 modules — `SseHub` with ring buffer, modular sources (`pod`, `file`, `dir`), API handlers (`chat`, `status`, `health`), static server with path traversal guard, 64KB body size cap
- **UI event pipeline**: Single SSE connection via `EventStreamProvider`, decomposed `contextTracker.ts` into `contextReducer.ts`, `networkHeuristics.ts`, `terminalLine.ts`, `chatReducer.ts`, `constants.ts`. New `sseClient.ts` and `chatApi.ts` services. Rewrote all hooks as provider selectors. Simplified `App.tsx` to layout + provider wrapping. Deleted `contextTracker.ts` and `useEscapeEvents.ts`
- **UI component cleanup**: Fixed `splitThinkTags` for `redacted_thinking`, stable React keys, extracted shared `ContextSidebar`, moved `DEFAULT_CONFIG` to `content/agentConfig.ts`, replaced inline styles with CSS class, fixed all type imports to use `lib/` directly

### Completed Tasks

- [x] Scripts: `validate_config()`, `AGENT_BC_NAME`/`UI_BC_NAME`, fixed `02-deploy.sh`, `Makefile`
- [x] Build: `prompt-watcher.sh`, respawn loop, structured logging, Dockerfile hardening
- [x] Relay: 10 modules (`config`, `router`, `sse/hub`, `sources/*`, `api/*`, `static`)
- [x] UI pipeline: `EventStreamProvider`, `sseClient`, `chatApi`, decomposed reducers, rewritten hooks
- [x] UI cleanup: `ChatMessage` fixes, `ContextSidebar`, `agentConfig.ts`, CSS class, type imports

---

## Rename to Neo

**Date:** 2026-04-29
**Status:** Done

Full rename from `claude-escape-agent` to `neo` across all artifacts.

### Key Outcomes

- Helm chart renamed: `claude-escape-agent` → `neo`, all template helpers (`neo.*`), component labels (`neo-agent`, `neo-ui`)
- Image names: `neo-agent`, `neo-ui`
- All Kubernetes resources (SA, ConfigMap, Secret, Services, Routes) derived from `{{ .Release.Name }}`
- Template files renamed: `*-game-ui.yaml` → `*-ui.yaml`
- `values.yaml` keys: `gameUi` → `ui` throughout
- Scripts updated: `RELEASE_NAME=neo`, `CHALLENGE_PROMPT_FILE`, `UI_SRC_DIR`, all banners and label selectors
- Build: `entrypoint.sh` banner → "Neo — Agent Container"
- UI: package name `neo-ui`, title `NEO`, states `BREACHED`/`CONTAINED`, placeholder URLs
- CSS: file renamed `game.css` → `neo.css`, all `game-header` → `neo-header`, `game-scene` → `neo-scene`, `--escaped` → `--breached`, `--escaping` → `--breaching`, keyframes renamed
- Docs: `README.md` and `ARCHITECTURE.md` fully rewritten for Neo branding
- `prompts/escape.txt`: kept as-is (challenge content, not branding)

### Completed Tasks

- [x] Helm chart name: `claude-escape-agent` -> `neo`
- [x] Image names: `neo-agent`, `neo-ui`
- [x] Release name, SA, ConfigMap, Secret, Services, Routes derived from `{{ .Release.Name }}`
- [x] `build/` scripts: banner text, comments
- [x] `ui/`: app title, component references, CSS class prefixes
- [x] `scripts/config.sh`: `RELEASE_NAME=neo`
- [x] `README.md`, `docs/ARCHITECTURE.md`: all references
- [x] `prompts/escape.txt`: kept as-is (challenge content, not branding)
