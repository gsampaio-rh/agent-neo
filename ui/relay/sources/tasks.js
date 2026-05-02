import { existsSync, readdirSync, readFileSync, statSync, watch } from 'fs';
import { join } from 'path';

const POLL_INTERVAL_MS = 2000;
const DEBOUNCE_MS = 100;

export function startTaskWatcher(hub, workspaceDir, taskListId) {
  const tasksRoot = join(workspaceDir, 'tasks');
  let debounceTimer = null;
  let lastBroadcast = '';

  function findActiveListId() {
    if (taskListId) return taskListId;
    if (!existsSync(tasksRoot)) return null;

    let best = null;
    let bestMtime = 0;
    try {
      const entries = readdirSync(tasksRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const mtime = statSync(join(tasksRoot, entry.name)).mtimeMs;
        if (mtime > bestMtime) { bestMtime = mtime; best = entry.name; }
      }
    } catch { /* directory unreadable */ }
    return best;
  }

  function readTasks(listId) {
    const dir = join(tasksRoot, listId);
    if (!existsSync(dir)) return [];
    try {
      return readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); }
          catch { return null; }
        })
        .filter(Boolean)
        .sort((a, b) => parseInt(a.id) - parseInt(b.id));
    } catch { return []; }
  }

  function broadcastTaskState() {
    const listId = findActiveListId();
    if (!listId) return;
    const tasks = readTasks(listId);
    const payload = JSON.stringify({ type: 'task_state', listId, tasks, timestamp: new Date().toISOString() });
    if (payload === lastBroadcast) return;
    lastBroadcast = payload;
    hub.broadcast(payload);
  }

  function debouncedBroadcast() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(broadcastTaskState, DEBOUNCE_MS);
  }

  broadcastTaskState();
  const pollInterval = setInterval(debouncedBroadcast, POLL_INTERVAL_MS);

  let watcher = null;
  try {
    if (existsSync(tasksRoot)) {
      watcher = watch(tasksRoot, { recursive: true }, debouncedBroadcast);
      watcher.on('error', () => { watcher = null; });
    }
  } catch { /* polling only */ }

  console.log(`[relay] TaskWatcher started (root: ${tasksRoot}, listId: ${taskListId || 'auto'})`);

  return {
    getTasks() {
      const listId = findActiveListId();
      return { tasks: listId ? readTasks(listId) : [], listId: listId || '' };
    },
    getTask(id) {
      const listId = findActiveListId();
      if (!listId) return null;
      return readTasks(listId).find(t => t.id === id) || null;
    },
    stop() {
      clearInterval(pollInterval);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (watcher) { watcher.close(); watcher = null; }
    },
  };
}
