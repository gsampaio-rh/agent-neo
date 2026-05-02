import { useCallback, useEffect, useRef, useState } from 'react';
import { useEventStream } from '../providers/EventStreamProvider';
import { listTasks, type Task } from '../services/tasksApi';
import type { EscapeEvent } from '../lib/eventParser';

export interface TasksState {
  tasks: Task[];
  listId: string;
  activeTask: Task | null;
  taskCount: number;
  completedCount: number;
  hasActivity: boolean;
  clearActivity: () => void;
}

export function useTasks(): TasksState {
  const { subscribe } = useEventStream();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [listId, setListId] = useState('');
  const [hasActivity, setHasActivity] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    listTasks().then(({ tasks: t, listId: id }) => {
      if (!mountedRef.current) return;
      setTasks(t);
      setListId(id);
    }).catch(() => {});
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const processEvent = (event: EscapeEvent) => {
      if (event.type !== 'task_state') return;
      const raw = event.raw as { tasks?: Task[]; listId?: string };
      if (raw.tasks) {
        setTasks(raw.tasks);
        setHasActivity(true);
      }
      if (raw.listId) setListId(raw.listId);
    };
    return subscribe(processEvent);
  }, [subscribe]);

  const clearActivity = useCallback(() => setHasActivity(false), []);

  const activeTask = tasks.find(t => t.status === 'in_progress') || null;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  return {
    tasks,
    listId,
    activeTask,
    taskCount: tasks.length,
    completedCount,
    hasActivity,
    clearActivity,
  };
}
