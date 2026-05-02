import type { TasksState } from '../hooks/useTasks';

interface TaskStatusBarProps {
  tasksState: TasksState;
  onOpen?: () => void;
}

export function TaskStatusBar({ tasksState, onOpen }: TaskStatusBarProps) {
  const { tasks, activeTask, completedCount, taskCount } = tasksState;

  if (taskCount === 0) return null;

  return (
    <div className="task-status-bar" onClick={onOpen} role="button" tabIndex={0}>
      <div className="task-status-bar__dots">
        {tasks.map(t => (
          <span key={t.id} className={`task-status-bar__dot task-status-bar__dot--${t.status}`} />
        ))}
      </div>
      <span className="task-status-bar__text">
        {activeTask?.activeForm || activeTask?.subject || 'Tasks'}
        {' — '}
        {completedCount}/{taskCount} done
      </span>
    </div>
  );
}
