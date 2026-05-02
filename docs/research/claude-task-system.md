# Claude Code Task System — Research Findings

**Date:** 2026-05-01
**Claude Code version:** 2.1.109
**Platform:** macOS (darwin 25.4.0)

## Directory Structure

All Claude Code state lives under `~/.claude/`:

```
~/.claude/
├── tasks/              # Task lists (one folder per list)
│   └── <uuid>/         # Session UUID or explicit CLAUDE_CODE_TASK_LIST_ID
│       ├── .lock       # Lock file (empty, signals active use)
│       ├── 1.json      # Task #1
│       ├── 2.json      # Task #2
│       └── N.json      # Task #N
├── plans/              # Plans created by Claude (markdown)
│   └── <adjective>-<adjective>-<noun>.md
├── projects/           # Per-project session logs
│   └── <encoded-path>/ # Path encoding: slashes → dashes, leading dash
│       ├── <session-uuid>.jsonl   # Full session transcript
│       └── memory/     # Auto-memory files (*.md)
├── todos/              # Separate system (JSON arrays, unrelated to tasks/)
├── session-env/        # Env vars per session UUID
├── sessions/           # Empty in testing (metadata placeholder)
├── settings.json       # User settings
├── history.jsonl       # Command history
└── ...                 # cache, debug, plugins, skills, etc.
```

## Task System

### Activation

| Mode | Tasks enabled by default? | Required env var |
|---|---|---|
| Interactive (`claude`) | Yes | None |
| Non-interactive (`claude -p`) | **No** | `CLAUDE_CODE_ENABLE_TASKS=1` |

**Critical for Neo:** The agent container runs `claude -p`, so `CLAUDE_CODE_ENABLE_TASKS=1` MUST be set in the deployment.

### Task List ID

- **Without** `CLAUDE_CODE_TASK_LIST_ID`: Claude uses the session UUID as the folder name under `~/.claude/tasks/`
- **With** `CLAUDE_CODE_TASK_LIST_ID=<name>`: Claude uses that name as the folder. Multiple sessions sharing the same ID share the same task list.
- `--continue` reuses the same session UUID, so tasks persist across continued prompts without needing an explicit ID.

### Task File Schema

Each task is stored as `<id>.json`:

```json
{
  "id": "1",
  "subject": "Short task title",
  "description": "Longer description of what needs to be done",
  "activeForm": "Present participle describing current activity",
  "status": "pending | in_progress | completed",
  "blocks": ["2", "3"],
  "blockedBy": ["1"]
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Numeric string, sequential starting at "1" |
| `subject` | string | Short task title |
| `description` | string | Detailed description |
| `activeForm` | string | Gerund phrase (e.g. "Writing tests") |
| `status` | enum | `pending`, `in_progress`, `completed` |
| `blocks` | string[] | Task IDs that this task blocks |
| `blockedBy` | string[] | Task IDs that block this task |

### Lock File

A `.lock` file (empty, 0 bytes) is created alongside task JSON files. Purpose: signals the task list is actively being used.

### Status Transitions

Status updates happen in real-time on disk:
- `TaskCreate` → writes new JSON file with `status: "pending"` (or `"in_progress"` if starting immediately)
- `TaskUpdate` → rewrites the JSON file with new status
- Updates occur synchronously with the tool call — the file is written before the tool_use result appears in the JSONL stream

## JSONL Stream Events

Task operations appear as standard `tool_use` events in `--output-format stream-json` (requires `--verbose` flag).

### Available Task Tools

From the `init` event's `tools` array:
- `TaskCreate` — create a new task
- `TaskUpdate` — update task status/fields
- `TaskList` — list all tasks
- `TaskGet` — get details of a specific task
- `TaskOutput` — output task results
- `TaskStop` — stop/cancel a task

### Stream Event Structure

**TaskCreate tool_use:**
```json
{
  "type": "assistant",
  "message": {
    "content": [{
      "type": "tool_use",
      "id": "toolu_01UiXZNZd6z3ExPqenwif3fL",
      "name": "TaskCreate",
      "input": {
        "subject": "Write hello.py",
        "description": "Create hello.py with a print statement",
        "activeForm": "Writing hello.py"
      }
    }]
  }
}
```

**TaskCreate tool_result:**
```json
{
  "type": "user",
  "message": {
    "content": [{
      "tool_use_id": "toolu_01UiXZNZd6z3ExPqenwif3fL",
      "type": "tool_result",
      "content": "Task #1 created successfully: Write hello.py"
    }]
  },
  "tool_use_result": {
    "task": { "id": "1", "subject": "Write hello.py" }
  }
}
```

**TaskUpdate tool_use:**
```json
{
  "type": "assistant",
  "message": {
    "content": [{
      "type": "tool_use",
      "name": "TaskUpdate",
      "input": { "taskId": "1", "status": "in_progress" }
    }]
  }
}
```

**TaskUpdate tool_result:**
```json
{
  "type": "user",
  "tool_use_result": {
    "success": true,
    "taskId": "1",
    "updatedFields": ["status"],
    "statusChange": { "from": "pending", "to": "in_progress" }
  }
}
```

### Detection Strategy

Task events can be detected via fast-path string matching:
```javascript
if (line.includes('"TaskCreate"')) // new task
if (line.includes('"TaskUpdate"')) // status change
if (line.includes('"TaskList"'))   // task list query
```

## Projects Folder

### Path Encoding

Project paths are encoded by replacing `/` with `-` and prepending a leading `-`:
- `/private/tmp` → `-private-tmp`
- `/Users/gsampaio/redhat/claude-projects-example` → `-Users-gsampaio-redhat-claude-projects-example`

### Contents

Each project folder contains:
- `<session-uuid>.jsonl` — full session transcript (one per session in that project)
- `memory/` — auto-memory markdown files (may be empty)

### JSONL Session Log Format

Session logs contain these event types:
1. `queue-operation` — prompt enqueue/dequeue
2. `user` — user messages with content and metadata
3. `assistant` — model responses (thinking, tool_use, text)
4. `ai-title` — auto-generated session title
5. `permission-mode` — permission configuration
6. `file-history-snapshot` — file state tracking
7. `skill_listing` — available skills at session start

No `sessions-index.json` exists — session discovery is by listing JSONL files in the project folder.

## Plans Folder

### Behavior

- Plans are stored as markdown files in `~/.claude/plans/`
- File naming: `<adjective>-<adjective>-<noun>.md` (auto-generated)
- Created when Claude produces a plan (even in `-p` mode)
- Full markdown content with headers, tables, code blocks

### Format

Standard markdown with:
- `# Plan: <Title>` header
- `## Context` section
- Technology choice tables
- Implementation steps (numbered headings)
- Verification section with test commands

## Implications for Neo Integration

### Recommended Approach: Dual detection (disk watch + JSONL parsing)

1. **Primary: Watch task files on disk** (`/data/claude-workspace/tasks/`)
   - The `claude-workspace` volume mounts `~/.claude` → files appear in real-time
   - Use `fs.watch` or polling on the `tasks/` subdirectory
   - Handles all task state regardless of stream-json parsing

2. **Secondary: Parse JSONL stream events**
   - Task tool_use events in `claude.jsonl` provide additional metadata (timing, caller context)
   - Useful for real-time UI updates before disk polling catches up
   - String matching is reliable: `"TaskCreate"`, `"TaskUpdate"`

### Required Deployment Changes

```yaml
# In chart/templates/deployment.yaml (claude-code container env)
- name: CLAUDE_CODE_ENABLE_TASKS
  value: "1"
```

Optional (for cross-session task persistence):
```yaml
- name: CLAUDE_CODE_TASK_LIST_ID
  value: "neo-{{ .Release.Name }}"
```

### API Design

| Endpoint | Method | Response |
|---|---|---|
| `GET /api/tasks` | GET | List all tasks from active task list |
| `GET /api/tasks/:id` | GET | Single task detail |
| `SSE event: task` | — | Real-time task state changes |

### UI Component

A task viewer component showing:
- Task list with status indicators (pending/in_progress/completed)
- Dependency graph (blocks/blockedBy relationships)
- Real-time status transitions via SSE
- Active task highlighted with `activeForm` text

---

## Detailed Integration Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Neo Pod                                  │
│                                                              │
│  claude-code container          neo-ui container             │
│  ┌─────────────────────┐       ┌──────────────────────────┐ │
│  │ claude -p            │       │ relay.mjs                │ │
│  │  └─ TaskCreate/Update│       │  ├─ TaskWatcher (new)    │ │
│  │     writes JSON      │       │  │   fs.watch + poll     │ │
│  │                      │       │  ├─ MetricsCollector     │ │
│  │ ~/.claude/tasks/     │       │  │   detects task events │ │
│  │  └─ <list-id>/      │       │  └─ hub.broadcast()      │ │
│  │      ├─ .lock        │       │      └─ SSE to browser   │ │
│  │      ├─ 1.json       │       │                          │ │
│  │      └─ N.json       │       │  GET /api/tasks          │ │
│  └────────┬─────────────┘       │  GET /api/tasks/:id      │ │
│           │                     └───────────┬──────────────┘ │
│           │  claude-workspace (emptyDir)     │                │
│           │  /opt/app-root/src/.claude   ═══ /data/claude-workspace
│           └─────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### New Files

| File | Purpose |
|---|---|
| `ui/relay/sources/tasks.js` | Watch `tasks/` directory for changes, broadcast task events |
| `ui/relay/api/tasks.js` | REST handlers: `GET /api/tasks`, `GET /api/tasks/:id` |
| `ui/src/services/tasksApi.ts` | Frontend API client for tasks |
| `ui/src/components/TaskViewer.tsx` | Task list/board UI component |

### `ui/relay/sources/tasks.js` — TaskWatcher

Watches `<claudeWorkspaceDir>/tasks/` for new/modified JSON files:

```javascript
import { existsSync, readdirSync, readFileSync, watch } from 'fs';
import { join } from 'path';

export function startTaskWatcher(hub, workspaceDir) {
  const tasksRoot = join(workspaceDir, 'tasks');
  let activeListDir = null;
  let pollInterval = null;

  function findActiveList() {
    if (!existsSync(tasksRoot)) return null;
    const entries = readdirSync(tasksRoot, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory());
    // Most recently modified directory is the active list
    // (or use CLAUDE_CODE_TASK_LIST_ID if configured)
    return dirs.length > 0 ? dirs[dirs.length - 1].name : null;
  }

  function readTasks(listId) {
    const dir = join(tasksRoot, listId);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); }
        catch { return null; }
      })
      .filter(Boolean);
  }

  function broadcastTaskState() {
    const listId = findActiveList();
    if (!listId) return;
    activeListDir = listId;
    const tasks = readTasks(listId);
    hub.broadcast(JSON.stringify({
      type: 'task_state',
      listId,
      tasks,
      timestamp: new Date().toISOString()
    }));
  }

  // Initial read + periodic poll
  broadcastTaskState();
  pollInterval = setInterval(broadcastTaskState, 2000);

  // fs.watch for faster detection
  let watcher = null;
  try {
    if (existsSync(tasksRoot)) {
      watcher = watch(tasksRoot, { recursive: true }, () => {
        broadcastTaskState();
      });
    }
  } catch { /* fallback to polling */ }

  return {
    getTasks: () => {
      const listId = findActiveList();
      return listId ? readTasks(listId) : [];
    },
    getTask: (id) => {
      const listId = findActiveList();
      if (!listId) return null;
      const tasks = readTasks(listId);
      return tasks.find(t => t.id === id) || null;
    },
    stop: () => {
      if (pollInterval) clearInterval(pollInterval);
      if (watcher) watcher.close();
    }
  };
}
```

### `ui/relay/api/tasks.js` — REST handlers

```javascript
export function handleListTasks(req, res, ctx) {
  const tasks = ctx.taskWatcher.getTasks();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ tasks }));
}

export function handleGetTask(req, res, ctx) {
  const id = req.url.split('/api/tasks/')[1];
  const task = ctx.taskWatcher.getTask(id);
  if (!task) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Task not found' }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(task));
}
```

### MetricsCollector Enhancement

Add task event detection to the existing `processLine` hot path:

```javascript
// In MetricsCollector.processLine():
if (line.includes('"TaskCreate"')) return this._handleTaskEvent(line, 'create');
if (line.includes('"TaskUpdate"')) return this._handleTaskEvent(line, 'update');
```

This provides task counters in metrics without a separate watcher.

### Helm Deployment Changes

In `chart/templates/deployment.yaml`, add to the claude-code container env:

```yaml
- name: CLAUDE_CODE_ENABLE_TASKS
  value: "1"
```

And in `chart/values.yaml`, add a configurable option:

```yaml
tasks:
  enabled: true
  listId: ""  # Leave empty for session-UUID based lists, or set for cross-session persistence
```

### SSE Event Format

The TaskWatcher broadcasts a `task_state` event type through the hub:

```json
{
  "type": "task_state",
  "listId": "session-uuid-or-explicit-id",
  "tasks": [
    { "id": "1", "subject": "...", "status": "completed", ... },
    { "id": "2", "subject": "...", "status": "in_progress", ... }
  ],
  "timestamp": "2026-05-01T..."
}
```

The frontend filters for `type: "task_state"` events in the SSE stream.

### Frontend Component

`TaskViewer.tsx` renders:
1. A compact task list (sidebar or panel)
2. Status badges: green (completed), yellow (in_progress), gray (pending)
3. The `activeForm` text for the in_progress task (e.g., "Writing tests")
4. Dependency arrows between tasks (blocks/blockedBy)
5. Auto-updates via SSE without polling
