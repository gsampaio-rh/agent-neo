export interface Task {
  id: string;
  subject: string;
  description: string;
  activeForm: string;
  status: 'pending' | 'in_progress' | 'completed';
  blocks: string[];
  blockedBy: string[];
}

export interface TaskListResponse {
  tasks: Task[];
  listId: string;
}

export async function listTasks(): Promise<TaskListResponse> {
  const res = await fetch('/api/tasks');
  if (!res.ok) return { tasks: [], listId: '' };
  return res.json();
}

export async function getTask(id: string): Promise<Task> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to get task ${id}`);
  return res.json();
}
