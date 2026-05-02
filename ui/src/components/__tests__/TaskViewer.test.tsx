import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskViewer } from '../TaskViewer';
import type { Task } from '../../services/tasksApi';

function makeTask(overrides: Partial<Task> = {}): Task {
  return { id: '1', subject: 'Test', description: '', activeForm: '', status: 'pending', blocks: [], blockedBy: [], ...overrides };
}

describe('TaskViewer', () => {
  it('renders empty state when no tasks', () => {
    render(<TaskViewer tasks={[]} />);
    expect(screen.getByText('No tasks')).toBeInTheDocument();
  });

  it('renders tasks with correct status badges', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', subject: 'Done', status: 'completed' }),
      makeTask({ id: '2', subject: 'Active', status: 'in_progress', activeForm: 'Writing' }),
      makeTask({ id: '3', subject: 'Todo', status: 'pending' }),
    ];
    const { container } = render(<TaskViewer tasks={tasks} />);
    expect(container.querySelectorAll('.task-badge--done')).toHaveLength(1);
    expect(container.querySelectorAll('.task-badge--active')).toHaveLength(1);
    expect(container.querySelectorAll('.task-badge--pending')).toHaveLength(1);
  });

  it('shows activeForm text for in_progress tasks', () => {
    const tasks = [makeTask({ id: '1', status: 'in_progress', activeForm: 'Writing tests' })];
    render(<TaskViewer tasks={tasks} />);
    expect(screen.getByText('Writing tests')).toBeInTheDocument();
  });

  it('applies strikethrough to completed tasks', () => {
    const tasks = [makeTask({ id: '1', subject: 'Finished', status: 'completed' })];
    const { container } = render(<TaskViewer tasks={tasks} />);
    expect(container.querySelector('.task-viewer__subject--done')).toBeInTheDocument();
  });

  it('indents blocked tasks', () => {
    const tasks = [
      makeTask({ id: '1', subject: 'Parent', blockedBy: [] }),
      makeTask({ id: '2', subject: 'Child', blockedBy: ['1'] }),
    ];
    const { container } = render(<TaskViewer tasks={tasks} />);
    expect(container.querySelectorAll('.task-viewer__item--blocked')).toHaveLength(1);
  });

  it('shows detail view when task is selected', () => {
    const tasks = [
      makeTask({ id: '1', subject: 'Build API', description: 'Create REST endpoints', status: 'in_progress', activeForm: 'Writing handlers', blocks: ['2'] }),
      makeTask({ id: '2', subject: 'Write tests', blockedBy: ['1'] }),
    ];
    render(<TaskViewer tasks={tasks} selectedTaskId="1" onSelectTask={vi.fn()} />);
    expect(screen.getByText('Build API')).toBeInTheDocument();
    expect(screen.getByText('Create REST endpoints')).toBeInTheDocument();
    expect(screen.getByText(/Writing handlers/)).toBeInTheDocument();
    expect(screen.getByText('Write tests')).toBeInTheDocument();
  });

  it('calls onSelectTask when a task item is clicked', () => {
    const onSelect = vi.fn();
    const tasks = [makeTask({ id: '1', subject: 'Click me' })];
    render(<TaskViewer tasks={tasks} onSelectTask={onSelect} />);
    fireEvent.click(screen.getByText('Click me'));
    expect(onSelect).toHaveBeenCalledWith(tasks[0]);
  });

  it('navigates back to list from detail view', () => {
    const onSelect = vi.fn();
    const tasks = [makeTask({ id: '1', subject: 'Detail task', description: 'Desc' })];
    render(<TaskViewer tasks={tasks} selectedTaskId="1" onSelectTask={onSelect} />);
    fireEvent.click(screen.getByText('← Back to list'));
    expect(onSelect).toHaveBeenCalledWith(tasks[0]);
  });
});
