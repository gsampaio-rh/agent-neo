import { jsonResponse } from '../lib/response.js';

export function handleListTasks(req, res, ctx) {
  const { tasks, listId } = ctx.taskWatcher.getTasks();
  jsonResponse(res, 200, { tasks, listId });
}

export function handleGetTask(req, res, ctx) {
  const id = decodeURIComponent(req.url.replace('/api/tasks/', ''));
  const task = ctx.taskWatcher.getTask(id);
  if (!task) return jsonResponse(res, 404, { error: 'Task not found' });
  jsonResponse(res, 200, task);
}
