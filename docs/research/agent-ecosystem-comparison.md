# Agent Ecosystem Comparison — Execution, Tasks, Memory, Skills, Tools, Plans

**Date:** 2026-05-02
**Agents evaluated:** OpenClaw, NemoClaw (NVIDIA), Hermes Agent (Nous Research), DeepAgents (LangChain), Claude Code (Anthropic), OpenCode (Anomaly)

---

## 1. OpenClaw

**Repository:** https://github.com/openclaw/openclaw (367K stars)
**Tagline:** "Your own personal AI assistant. Any OS. Any Platform."

### Execution Model

Dual-loop architecture with a hub-and-spoke topology:

- **Outer loop** selects the next task
- **Inner loop** executes individual tasks (prevents execution details from contaminating planning)
- **Gateway process** acts as central air traffic control — routing, session handling, access control, WebSocket communication
- **Heartbeat system** (default 30 min): agents read a `HEARTBEAT.md` checklist and decide whether to act. Context-sensitive batched awareness (inbox, calendar, background tasks).
- **Cron system**: precise timing, one-shot reminders, isolated background work

### Task Management

No built-in task state machine. Tasks are fire-and-forget via sub-agents. Active community request for step status tracking, progress streaming, deviation detection, and self-correction. Known issue: heartbeat interrupts long-running tasks mid-execution.

### Memory

Four-layer stack (all markdown — transparent, no proprietary DB):

| Layer | Storage | Purpose |
|---|---|---|
| Session Context | In-memory | Current conversation (model context window) |
| Daily Notes | `memory/YYYY-MM-DD.md` | Raw logs of decisions and tasks |
| Long-term Memory | `MEMORY.md` | Curated insights, preferences, lessons |
| Semantic Search | SQLite | Hybrid retrieval: BM25 (30%) + vector embeddings (70%) |

Limitations: no temporal awareness of outdated facts, no entity relationship graphs, compaction is lossy.

### Skills & Tools

Three capability layers:

1. **Tools** — built-in sandboxed functions (HTTP, file ops, code exec) with Docker isolation
2. **Plugins** — installable packages with manifest-first architecture, multi-stage load pipeline
3. **Skills** — markdown-based capability definitions for domain-specific workflows

Tool profiles (`minimal`, `coding`, `messaging`, `full`) narrowed with `tools.allow`/`tools.deny`. Plugin hooks (`before_tool_call`) enable rewriting parameters, blocking execution, or requiring approval.

### Plans

No dedicated planning tool. Relies on agent self-direction via HEARTBEAT.md and skill definitions.

---

## 2. NemoClaw (NVIDIA)

**Repository:** https://github.com/NVIDIA/NemoClaw (20K stars)
**Tagline:** "Run OpenClaw more securely inside NVIDIA OpenShell with managed inference"

### Architecture

Not a standalone agent — a security/infrastructure wrapper around OpenClaw:

1. **Agent Application Layer** — OpenClaw framework
2. **Privacy Router** — local vs. cloud model routing
3. **Nemotron Policy Engine** — 120B MoE intent classification
4. **OpenShell Runtime** — kernel-level sandbox

### Execution & Sandboxing

Every system call intercepted by eBPF layer, classified against policy, allowed/denied/escalated with < 50 microseconds latency per syscall. Combines:

- Linux kernel namespaces
- seccomp-BPF filters
- NVIDIA custom eBPF programs
- Landlock + network namespace isolation

Declarative security policies, credential management, credential stripping from subprocesses.

### Key Differentiator

Infrastructure for running OpenClaw securely with managed NVIDIA inference. Handles sandboxing, routing, and policy enforcement. Released March 2026 (alpha).

---

## 3. Hermes Agent (Nous Research)

**Repository:** https://github.com/nousresearch/hermes-agent (128K stars)
**Tagline:** "The agent that grows with you."

### Execution Model

Three entry points (CLI, Gateway API, Python Library) feeding into core AIAgent system with modular subsystems:

- **Prompt Builder** — assembly with compression and caching
- **Provider Resolution** — 3 API modes (chat completion, codex response, Anthropic)
- **Tool Dispatch** — 61 tools organized into 52 toolsets
- **Subagent delegation** for parallel workstreams
- **Cron scheduler** for natural-language scheduled automations

### Task Management

Task execution through subagent delegation. No persistent task state machine on disk — coordination is runtime-only.

### Memory

Three-layer architecture with security protections:

| Layer | Mechanism | Purpose |
|---|---|---|
| Agent-curated | Periodic nudges | Persist knowledge proactively |
| FTS5 cross-session recall | SQLite FTS5 + LLM summarization | Search past conversations |
| Honcho dialectic user modeling | Relationship dynamics | Deepen understanding of users |

Context fencing and streaming scrubbers prevent memory injection attacks.

### Skills (Key Differentiator)

**Self-improving skills via closed learning loop:**

1. Agent completes a complex task
2. Automatically distills a reusable Skill (markdown)
3. Stores for future use
4. Each subsequent application refines the skill
5. Result: continuously improving execution over time

This is the most innovative pattern in the ecosystem — skills emerge from experience rather than being pre-authored.

### Tools

68 built-in tools across backends: terminal, browser, web, MCP, file, vision. MCP integration for dynamic extension.

---

## 4. DeepAgents (LangChain)

**Repository:** https://github.com/langchain-ai/deepagents (22K stars)
**Tagline:** "Agent harness built with LangChain and LangGraph."

### Execution Model

Built on LangGraph runtime with durable execution:

- `create_deep_agent()` returns a `CompiledStateGraph`
- Supports streaming, LangGraph Studio, checkpointers, human-in-the-loop
- Standard LangGraph object — composable with the full ecosystem

### Task Management

**`write_todos` tool** — explicit task breakdown with progress tracking. Runtime-only (no file persistence). Simple and effective for tracking multi-step work.

### Memory & Context

Filesystem-based context management:

| Backend | Persistence | Use Case |
|---|---|---|
| `StateBackend` | Ephemeral (in-memory) | Short tasks |
| `FilesystemBackend` | Disk | Long tasks, artifacts |
| `LocalShellBackend` | Shell context | Command execution |
| `CompositeBackend` | Combined | Production use |

Auto-summarization for long conversations. Large outputs stored to files to avoid context overflow.

### Tools

- Filesystem: `read_file`, `write_file`, `edit_file`, `ls`, `glob`, `grep`
- Shell: `execute` (sandboxed)
- Subagents: `task` tool — isolated context windows for delegation
- No plugin marketplace — extensions via LangChain tool ecosystem

### Plans

`write_todos` IS the planning tool. No persistent plan files on disk.

---

## 5. Claude Code (Anthropic)

**Tagline:** Claude's native coding agent.

### Execution Model

Single-threaded agentic loop (deceptively simple):

1. Receive request
2. Build message history (system + user + tool results)
3. Call Claude API with available tools
4. If no tool calls → return response
5. If tool calls → execute each, append results to history
6. Loop back to step 3

Flat message history maximizes prompt caching (10% cost on subsequent cached calls).

Eight cooperating subsystems: Query Engine, Tools (40+), Task Framework, AppState, Bridge, Swarm/Teammates, Skills/Plugins, Ink UI.

### Task Management (Key Differentiator)

Full task state machine with file-system persistence:

```
~/.claude/tasks/<list-id>/
├── .lock
├── 1.json   { id, subject, description, activeForm, status, blocks, blockedBy }
├── 2.json
└── N.json
```

- Status flow: `pending` → `in_progress` → `completed`
- Cross-session sharing via `CLAUDE_CODE_TASK_LIST_ID`
- Dependency tracking (`blocks`/`blockedBy`)
- Tools: `TaskCreate`, `TaskUpdate`, `TaskList`, `TaskGet`, `TaskOutput`, `TaskStop`
- Requires `CLAUDE_CODE_ENABLE_TASKS=1` in `-p` (headless) mode

### Memory

Six-layer hierarchy (more specific takes precedence):

1. Managed policy — system-level, all users
2. User memory — `~/.claude/CLAUDE.md`
3. Project memory — `./CLAUDE.md` or `./.claude/CLAUDE.md`
4. Project rules — `./.claude/rules/*.md` (path-conditional)
5. Local memory — `./CLAUDE.local.md`
6. Auto memory — `~/.claude/projects/<path>/memory/`

Recommended CLAUDE.md: 150-500 lines. Hard-truncated beyond ~1000.

### Skills & Plugins

- **Skills**: Markdown files invoked via `/commands` or automatically. Run in current context or isolated subagent.
- **Plugins**: Bundle skills + hooks + subagents + MCP servers. Namespaced commands.
- **MCP**: External service/tool connections.
- **Hooks**: Lifecycle events (SessionStart, FileChanged, CwdChanged).
- **Agent teams**: Coordinate multiple independent sessions.

### Plans

Persistent markdown files in `~/.claude/plans/`:
- Auto-generated names: `<adjective>-<adjective>-<noun>.md`
- Full markdown with Context, Steps, Verification sections
- Created even in headless (`-p`) mode

---

## 6. OpenCode (Anomaly)

**Repository:** https://github.com/anomalyco/opencode (153K stars)
**Tagline:** "The open source coding agent."

### Execution Model

Major 2026 architecture overhaul introduced:

- **Parallel processing** — decoupled reasoning from execution for concurrent subtasks
- **Persistent context** — subagents retain state across invocations within session
- **Smart context** — priority-based sliding window preserving recent and high-value context
- **Self-healing** — auto-recovery from tool failures via supervisor feedback loop

### Task Management

`task` tool spawns subagents with isolated context windows. Configurable `subagent_tools` complement `primary_tools`. Subagent-to-subagent delegation with call limits. No persistent task state on disk — runtime constructs only.

### Memory & Context (Key Differentiator)

Graduated context usage signaling:

| Level | Threshold | Behavior |
|---|---|---|
| Normal | < 70% | Standard operation |
| Warning | >= 70% | Signal to user |
| Error | >= 85% | Urgent context pressure |
| Blocking | >= 95% | Must compact or summarize |

Memory CRUD API with user/project scoping. Database optimizations: incremental auto-vacuum, WAL checkpoints, tool output > 50KB spools to disk. Session retention: auto-delete after 90 days.

### Tools & Permissions

Granular permission system with actions (`allow`, `ask`, `deny`) and wildcard patterns:

- Permissions: `read`, `edit`, `glob`, `grep`, `list`, `bash`, `task`, `skill`, `lsp`, `webfetch`, `websearch`, `external_directory`
- **Budget configuration**: limit agent turns and USD spend per session
- Hooks for lifecycle events

### Plans

No dedicated planning file system. Planning happens within the execution loop.

---

## Comparative Matrix

| Dimension | OpenClaw | NemoClaw | Hermes | DeepAgents | Claude Code | OpenCode |
|---|---|---|---|---|---|---|
| **Execution** | Dual-loop + Gateway | Security wrapper | Modular (3 entries) | LangGraph runtime | Single-thread loop | Parallel + self-heal |
| **Task persistence** | None | Inherits OpenClaw | None | Runtime (`write_todos`) | File-based with deps | Runtime (subagent) |
| **Memory layers** | 4 | Inherits OpenClaw | 3 | Filesystem backends | 6 | CRUD API + levels |
| **Skills** | Markdown + Plugins | Inherits OpenClaw | Self-improving | LangChain ecosystem | Markdown + Plugins + MCP | Permission-gated |
| **Planning** | Heartbeat + manual | N/A | Emergent | `write_todos` | Persistent `.md` files | Within loop |
| **Sandboxing** | Docker + profiles | eBPF + namespaces | Isolated subagents | LangGraph isolation | Permissions + MCP | Permissions |
| **Scheduling** | Heartbeat + Cron | N/A | NL cron | Checkpointers | Background + cron | Hooks |
| **Multi-agent** | Sub-agents | N/A | Isolated delegates | `task` subagents | Swarm/Teams | Subagent chains |
| **Self-improvement** | No | No | Yes | No | No | No |
| **Budget control** | No | No | No | No | No | Yes (turns + USD) |

---

## Implications for Neo

### Patterns to adopt (priority order):

1. **Task persistence with deps** (Claude Code) — already integrating via `CLAUDE_CODE_ENABLE_TASKS=1` and file watcher on `/data/claude-workspace/tasks/`. See [claude-task-system.md](claude-task-system.md).

2. **Graduated context indicators** (OpenCode) — show context usage % in the UI (normal/warning/error). Could derive from token counts already tracked by MetricsCollector.

3. **Budget controls** (OpenCode) — add max-turns and max-cost limits in `values.yaml` for workshop cost management. Relay could track and enforce.

4. **Heartbeat-driven monitoring** (OpenClaw) — for the escape-the-box activity. A periodic check on attack state that triggers UI updates without constant polling.

5. **Self-improving skills** (Hermes) — future exploration. After the agent completes a workshop challenge, auto-generate a skill file capturing the approach. Requires significant design work.

6. **eBPF sandboxing model** (NemoClaw) — validates our approach. Our stripped-down container (no curl, wget, nc) is simpler but directionally correct for workshops. Full eBPF would be overkill.

### What we already have that others lack:

- **Real-time SSE streaming** of agent output to multiple UI clients
- **Shared-volume IPC** between agent and UI containers (file-based, no network)
- **Attack phase detection** and visualization (unique to workshop context)
- **Web terminal** alongside chat (direct container access for observability)

---

## Deep Dive: Agentic Loops

### Claude Code

Three-phase loop: **gather context** → **take action** → **verify results**. Phases blend together — Claude uses tools throughout.

```
User Prompt
    ↓
┌─────────────────────────────────────┐
│  1. Build message history            │
│     (system + user + tool results)   │
│  2. Call Claude API with tools       │
│  3. Parse response                   │
│     ├── Text only → return to user   │
│     └── Tool calls → execute them    │
│  4. Append tool results to history   │
│  5. Loop back to step 2              │
└─────────────────────────────────────┘
```

Key characteristics:
- Single-threaded — flat message history maximizes prompt caching (10% cost on cached calls)
- Tools are the agency mechanism — without tools, Claude can only respond with text
- User can interrupt at any point to steer
- Five tool categories: file ops, search, execution, web, code intelligence

### OpenClaw

Dual-loop with serialized runs per session:

```
User Input
    ↓
┌──────────────────────────────────────┐
│  OUTER LOOP (task selection)          │
│  1. Load: history, SOUL.md, system   │
│  ┌────────────────────────────────┐  │
│  │  INNER LOOP (task execution)   │  │
│  │  2. Call LLM with tools        │  │
│  │  3. Parse: text or tool calls  │  │
│  │  4. Execute tool if called     │  │
│  │  5. Append results to context  │  │
│  │  6. Loop until text response   │  │
│  └────────────────────────────────┘  │
│  7. Select next task or return       │
└──────────────────────────────────────┘
```

Key characteristics:
- Outer loop prevents execution details from contaminating planning logic
- Runs serialized per session (no race conditions)
- Gateway process acts as air traffic control for routing across channels
- Heartbeat (30 min) triggers periodic autonomous checks

### Hermes Agent

Turn-based lifecycle managed by `AIAgent` class:

```
User Message
    ↓
┌──────────────────────────────────────────────┐
│  1. Generate task_id                          │
│  2. Append user message to history            │
│  3. Build/reuse cached system prompt          │
│  4. Check preflight compression (>50% ctx)    │
│  5. Build API messages from history           │
│  6. Inject ephemeral layers                   │
│     (budget warnings, context pressure)       │
│  7. Apply prompt caching markers (Anthropic)  │
│  8. Make interruptible API call               │
│  9. Parse response                            │
│     ├── Tool calls → execute, loop to 5      │
│     └── Text → persist session, return        │
└──────────────────────────────────────────────┘
```

Key characteristics:
- Strict message role alternation enforced
- Preflight compression before every API call if context > 50%
- Ephemeral prompt injection (budget warnings, context pressure signals)
- Prompt caching markers for Anthropic provider

### DeepAgents (LangChain)

LangGraph `CompiledStateGraph` with durable checkpoints:

```
User Input
    ↓
┌──────────────────────────────────────────┐
│  LangGraph Runtime                        │
│  1. Load state from checkpointer          │
│  2. Assemble messages + tools             │
│  3. Call LLM                              │
│  4. Parse response                        │
│     ├── Tool call → execute               │
│     │   ├── write_todos (planning)        │
│     │   ├── task (spawn subagent)         │
│     │   ├── execute (shell)               │
│     │   └── file ops                      │
│     └── Text → checkpoint + return        │
│  5. Context check:                        │
│     ├── Tool output > 20K → offload       │
│     ├── Context > 85% → offload inputs    │
│     └── Still full → auto-summarize       │
│  6. Loop                                  │
└──────────────────────────────────────────┘
```

Key characteristics:
- Durable execution — survives process crashes via checkpointers
- Streaming + human-in-the-loop built into LangGraph
- Three-tier compression triggered at different thresholds
- Standard graph object — composable with full LangChain ecosystem

### OpenCode (Anomaly)

Parallel execution with supervisor feedback:

```
User Input
    ↓
┌──────────────────────────────────────────────┐
│  1. Reasoning phase (decoupled from exec)     │
│  2. Plan subtasks                             │
│  3. Execute in parallel:                      │
│     ├── Subagent A (persistent context)       │
│     ├── Subagent B (persistent context)       │
│     └── Subagent C (persistent context)       │
│  4. Collect results                           │
│  5. Smart context sliding window:             │
│     - Priority-based retention                │
│     - Recent + high-value preserved           │
│  6. Self-healing check:                       │
│     └── Tool failure? → supervisor retry      │
│  7. Context level check:                      │
│     ├── < 70% → normal                       │
│     ├── >= 70% → warning signal              │
│     ├── >= 85% → error signal                │
│     └── >= 95% → blocking (must compact)     │
│  8. Return or loop                            │
└──────────────────────────────────────────────┘
```

Key characteristics:
- Reasoning decoupled from execution (parallel subtasks)
- Subagents retain state across invocations (persistent sessions)
- Self-healing via supervisor feedback loop on tool failures
- Graduated context pressure signals to user

### NemoClaw

Wraps OpenClaw's loop with policy enforcement at every syscall:

```
Agent Action (from OpenClaw loop)
    ↓
┌──────────────────────────────────────────────┐
│  OpenShell eBPF Interception Layer            │
│  1. Intercept system call                     │
│  2. Classify against policy:                  │
│     ├── Nemotron 120B MoE (intent analysis)  │
│     └── Declarative policy rules              │
│  3. Decision:                                 │
│     ├── Allow → proceed (< 50μs overhead)    │
│     ├── Deny → block + log                   │
│     └── Escalate → human approval            │
│  4. Route inference through gateway:          │
│     ├── NVIDIA Endpoints                     │
│     ├── OpenAI / Anthropic / Gemini          │
│     └── Local Ollama                          │
└──────────────────────────────────────────────┘
```

Key characteristics:
- Not a new loop — wraps OpenClaw's existing loop with security
- Every syscall intercepted, classified, and gated
- Intent-based policy (120B MoE model) vs. rule-based
- < 50 microseconds per syscall overhead

---

## Deep Dive: Context Engineering

| Agent | Strategy | Trigger | Mechanism |
|---|---|---|---|
| **Claude Code** | Auto-compaction | ~95% context | Clear old tool outputs first, then summarize conversation. CLAUDE.md re-injected. `Compact Instructions` section controls what's preserved. |
| **OpenClaw** | ContextEngine plugin (2026.3.7) | Configurable per plugin | 7 lifecycle hooks: bootstrap, ingest, assemble, compact, afterTurn. Supports RAG-based assembly, conversation branching. Replaced hardcoded sliding-window. |
| **Hermes** | 4-phase ContextCompressor | >50% preflight check | Phase 1: tool pruning. Phase 2: protect system+first+recent 20K. Phase 3: structured summarization. Phase 4: iterative summary updates. |
| **DeepAgents** | 3-tier offloading | Graduated thresholds | >20K tool output → filesystem. >85% context → offload old inputs. Still full → LLM auto-summarization with intent/artifacts/next-steps. |
| **OpenCode** | Priority sliding window | Graduated levels | Priority-based retention (recent + high-value). Context signals at 70%/85%/95%. Tool output > 50KB → disk spool. |
| **NemoClaw** | Inherits OpenClaw | — | — |

### Notable innovations:

- **OpenClaw ContextEngine**: Fully pluggable — custom strategies per deployment. Seven lifecycle hooks allow RAG integration, branching, and external memory stores.
- **Hermes "Infinite Context Buffer"** (proposed): Uses free large-context models (Gemini 1M) as persistent subagents maintaining 600K tokens of historical context while main stays at ~200K.
- **OpenCode RLM** (proposed): Treats context as external environment queried programmatically. Claims 91% performance on 10M+ token tasks vs 0% for base LLMs.
- **DeepAgents filesystem offload**: Large outputs stored as files with path references — context contains only the pointer, not the data.

---

## Deep Dive: Multi-Agent / On-the-Fly Agent Creation

| Agent | Model | How agents are created | Communication | Persistence |
|---|---|---|---|---|
| **Claude Code** | Leader + Workers (Teams) / Isolated (Subagents) | `Task` tool spawns subagents; `/agents` configures custom types; Agent Teams for cross-session coordination | File-based mailboxes (`~/.claude/teams/`) | Teams persist across sessions; subagents are session-scoped |
| **OpenClaw** | Shared-memory delegation | Agents spawned via configuration; communicate through shared markdown/YAML files | Downward delegation pattern via shared directory | File-based (markdown) |
| **Hermes** | Isolated delegates | `delegate_task` tool spawns child AIAgent with fresh context | Goal + context fields passed explicitly; summary returned | Session-scoped (up to 3 concurrent by default) |
| **DeepAgents** | Task-based subagents | `task` tool spawns LangGraph subagent with isolated context | Inherit parent tools unless configured otherwise; summary returned | Durable via LangGraph checkpointers |
| **OpenCode** | Hierarchical chains | `task` tool with `resumeSessionId` for persistent subagents | Subagent-to-subagent delegation with depth limits and call budgets | Persistent (resumable) or stateless |
| **NemoClaw** | Inherits OpenClaw | — | — | — |

### Known issues with multi-agent:

- **Claude Code**: Team lead loses awareness of teammates after context compaction. Background agents' messages silenced post-compaction. Compaction cascade when spawning 10-15+ parallel subagents.
- **OpenCode**: Permission bypass in subagents (security bug, fixed). Nested delegation lost after permission rework.
- **OpenClaw**: Fire-and-forget subagents — no progress tracking, no deviation detection.

### Key patterns:

1. **Isolation is universal** — every framework gives subagents fresh context windows to avoid bloating the parent.
2. **Summary-only return** — subagents return a compressed summary, not their full conversation.
3. **File-based coordination** (Claude Code, OpenClaw) is more durable but has compaction bugs.
4. **Graph-based coordination** (DeepAgents/LangGraph) gets durability from checkpointers.
5. **Persistent subagents** (OpenCode's `resumeSessionId`) enable multi-phase workflows where the same subagent maintains memory across calls.
