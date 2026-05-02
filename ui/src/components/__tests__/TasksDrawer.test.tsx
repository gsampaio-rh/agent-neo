import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TasksDrawer } from '../TasksDrawer';
import type { TasksState } from '../../hooks/useTasks';

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

describe('TasksDrawer', () => {
  it('renders icon button', () => {
    render(<TasksDrawer tasksState={makeTasksState()} />);
    expect(screen.getByLabelText('Toggle tasks panel')).toBeInTheDocument();
  });

  it('opens drawer panel on icon click', () => {
    render(<TasksDrawer tasksState={makeTasksState({ taskCount: 3, completedCount: 1 })} />);
    fireEvent.click(screen.getByLabelText('Toggle tasks panel'));
    expect(screen.getByText('Tasks (1/3)')).toBeInTheDocument();
  });

  it('closes drawer on close button click', () => {
    render(<TasksDrawer tasksState={makeTasksState()} />);
    fireEvent.click(screen.getByLabelText('Toggle tasks panel'));
    fireEvent.click(screen.getByText('✕'));
    expect(screen.queryByText('Tasks (0/0)')).not.toBeInTheDocument();
  });

  it('shows badge dot when hasActivity is true', () => {
    const { container } = render(<TasksDrawer tasksState={makeTasksState({ hasActivity: true })} />);
    expect(container.querySelector('.neo-header__badge-dot')).toBeInTheDocument();
  });

  it('hides badge dot when drawer is open', () => {
    const { container } = render(<TasksDrawer tasksState={makeTasksState({ hasActivity: true })} />);
    fireEvent.click(screen.getByLabelText('Toggle tasks panel'));
    expect(container.querySelector('.neo-header__badge-dot')).not.toBeInTheDocument();
  });
});
