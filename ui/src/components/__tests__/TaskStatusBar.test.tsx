import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskStatusBar } from '../TaskStatusBar';
import type { TasksState } from '../../hooks/useTasks';
import type { Task } from '../../services/tasksApi';

function makeTask(overrides: Partial<Task> = {}): Task {
  return { id: '1', subject: 'Test', description: '', activeForm: '', status: 'pending', blocks: [], blockedBy: [], ...overrides };
}

function makeTasksState(overrides: Partial<TasksState> = {}): TasksState {
  return {
    tasks: [],
    listId: '',
    activeTask: null,
    taskCount: 0,
    completedCount: 0,
    hasActivity: false,
    clearActivity: vi.fn(),
    ...overrides,
  };
}

describe('TaskStatusBar', () => {
  it('is hidden when no tasks exist', () => {
    const { container } = render(<TaskStatusBar tasksState={makeTasksState()} />);
    expect(container.querySelector('.task-status-bar')).not.toBeInTheDocument();
  });

  it('shows progress dots matching task count and statuses', () => {
    const tasks = [
      makeTask({ id: '1', status: 'completed' }),
      makeTask({ id: '2', status: 'in_progress' }),
      makeTask({ id: '3', status: 'pending' }),
    ];
    const { container } = render(<TaskStatusBar tasksState={makeTasksState({ tasks, taskCount: 3, completedCount: 1 })} />);
    expect(container.querySelectorAll('.task-status-bar__dot')).toHaveLength(3);
    expect(container.querySelector('.task-status-bar__dot--completed')).toBeInTheDocument();
    expect(container.querySelector('.task-status-bar__dot--in_progress')).toBeInTheDocument();
    expect(container.querySelector('.task-status-bar__dot--pending')).toBeInTheDocument();
  });

  it('shows active task activeForm text', () => {
    const active = makeTask({ id: '1', status: 'in_progress', activeForm: 'Writing tests' });
    const state = makeTasksState({ tasks: [active], taskCount: 1, completedCount: 0, activeTask: active });
    render(<TaskStatusBar tasksState={state} />);
    expect(screen.getByText(/Writing tests/)).toBeInTheDocument();
  });

  it('shows completion count', () => {
    const tasks = [
      makeTask({ id: '1', status: 'completed' }),
      makeTask({ id: '2', status: 'completed' }),
      makeTask({ id: '3', status: 'pending' }),
      makeTask({ id: '4', status: 'pending' }),
      makeTask({ id: '5', status: 'pending' }),
    ];
    const state = makeTasksState({ tasks, taskCount: 5, completedCount: 2 });
    render(<TaskStatusBar tasksState={state} />);
    expect(screen.getByText(/2\/5 done/)).toBeInTheDocument();
  });

  it('calls onOpen when clicked', () => {
    const onOpen = vi.fn();
    const tasks = [makeTask({ id: '1', status: 'pending' })];
    const state = makeTasksState({ tasks, taskCount: 1 });
    render(<TaskStatusBar tasksState={state} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalled();
  });
});
