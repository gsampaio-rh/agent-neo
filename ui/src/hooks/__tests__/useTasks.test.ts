import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { EscapeEvent } from '../../lib/eventParser';

type EventListener = (event: EscapeEvent) => void;

const listeners = new Set<EventListener>();
const mockSubscribe = vi.fn((listener: EventListener) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
});

vi.mock('../../providers/EventStreamProvider', () => ({
  useEventStream: () => ({ connected: true, subscribe: mockSubscribe }),
}));

const mockListTasks = vi.fn();
vi.mock('../../services/tasksApi', () => ({
  listTasks: (...args: unknown[]) => mockListTasks(...args),
}));

function dispatch(event: Partial<EscapeEvent>) {
  const full: EscapeEvent = { type: 'unknown', timestamp: new Date().toISOString(), raw: {}, ...event };
  for (const listener of listeners) listener(full);
}

describe('useTasks', () => {
  beforeEach(() => {
    listeners.clear();
    mockSubscribe.mockClear();
    mockListTasks.mockReset();
    mockListTasks.mockResolvedValue({ tasks: [], listId: '' });
  });

  async function loadHook() {
    const { useTasks } = await import('../useTasks');
    return renderHook(() => useTasks());
  }

  it('returns empty tasks on mount when API returns empty', async () => {
    const { result } = await loadHook();
    await waitFor(() => {
      expect(result.current.tasks).toEqual([]);
      expect(result.current.taskCount).toBe(0);
    });
  });

  it('populates tasks from initial REST fetch', async () => {
    mockListTasks.mockResolvedValue({
      tasks: [{ id: '1', subject: 'Test', status: 'pending', blocks: [], blockedBy: [] }],
      listId: 'my-list',
    });
    const { result } = await loadHook();
    await waitFor(() => {
      expect(result.current.tasks.length).toBe(1);
      expect(result.current.listId).toBe('my-list');
    });
  });

  it('updates tasks when SSE task_state event arrives', async () => {
    const { result } = await loadHook();
    act(() => {
      dispatch({
        type: 'task_state',
        raw: { type: 'task_state', tasks: [{ id: '1', subject: 'SSE task', status: 'in_progress', blocks: [], blockedBy: [] }], listId: 'sse' },
      });
    });
    expect(result.current.tasks.length).toBe(1);
    expect(result.current.tasks[0].subject).toBe('SSE task');
  });

  it('derives activeTask from first in_progress task', async () => {
    mockListTasks.mockResolvedValue({
      tasks: [
        { id: '1', subject: 'Done', status: 'completed', blocks: [], blockedBy: [] },
        { id: '2', subject: 'Active', status: 'in_progress', activeForm: 'Working', blocks: [], blockedBy: [] },
      ],
      listId: 'x',
    });
    const { result } = await loadHook();
    await waitFor(() => {
      expect(result.current.activeTask?.subject).toBe('Active');
    });
  });

  it('computes taskCount correctly', async () => {
    mockListTasks.mockResolvedValue({
      tasks: [
        { id: '1', status: 'completed', subject: '', blocks: [], blockedBy: [] },
        { id: '2', status: 'pending', subject: '', blocks: [], blockedBy: [] },
        { id: '3', status: 'pending', subject: '', blocks: [], blockedBy: [] },
      ],
      listId: 'x',
    });
    const { result } = await loadHook();
    await waitFor(() => {
      expect(result.current.taskCount).toBe(3);
      expect(result.current.completedCount).toBe(1);
    });
  });

  it('sets hasActivity on SSE update, resets on clearActivity()', async () => {
    const { result } = await loadHook();
    expect(result.current.hasActivity).toBe(false);

    act(() => {
      dispatch({
        type: 'task_state',
        raw: { type: 'task_state', tasks: [{ id: '1', subject: 'X', status: 'pending', blocks: [], blockedBy: [] }], listId: 'y' },
      });
    });
    expect(result.current.hasActivity).toBe(true);

    act(() => { result.current.clearActivity(); });
    expect(result.current.hasActivity).toBe(false);
  });
});
