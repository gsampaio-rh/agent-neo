import type { Task } from '../services/tasksApi';

interface TaskViewerProps {
  tasks: Task[];
  selectedTaskId?: string | null;
  onSelectTask?: (task: Task) => void;
}

function StatusBadge({ status }: { status: Task['status'] }) {
  const classes: Record<Task['status'], string> = {
    pending: 'task-badge task-badge--pending',
    in_progress: 'task-badge task-badge--active',
    completed: 'task-badge task-badge--done',
  };
  return <span className={classes[status]} />;
}

const STATUS_LABELS: Record<Task['status'], string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
};

function TaskDetail({ task, tasks, onBack }: { task: Task; tasks: Task[]; onBack: () => void }) {
  const blockers = task.blockedBy?.length
    ? tasks.filter(t => task.blockedBy.includes(t.id))
    : [];
  const blocking = task.blocks?.length
    ? tasks.filter(t => task.blocks.includes(t.id))
    : [];

  return (
    <div className="task-detail">
      <button className="task-detail__back" onClick={onBack}>← Back to list</button>
      <div className="task-detail__header">
        <StatusBadge status={task.status} />
        <span className="task-detail__status">{STATUS_LABELS[task.status]}</span>
      </div>
      <h3 className="task-detail__subject">{task.subject}</h3>
      {task.description && (
        <p className="task-detail__description">{task.description}</p>
      )}
      {task.status === 'in_progress' && task.activeForm && (
        <div className="task-detail__active-form">
          <span className="task-detail__label">Currently:</span> {task.activeForm}
        </div>
      )}
      {blockers.length > 0 && (
        <div className="task-detail__deps">
          <span className="task-detail__label">Blocked by:</span>
          <ul className="task-detail__dep-list">
            {blockers.map(b => (
              <li key={b.id}><StatusBadge status={b.status} /> {b.subject}</li>
            ))}
          </ul>
        </div>
      )}
      {blocking.length > 0 && (
        <div className="task-detail__deps">
          <span className="task-detail__label">Blocks:</span>
          <ul className="task-detail__dep-list">
            {blocking.map(b => (
              <li key={b.id}><StatusBadge status={b.status} /> {b.subject}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function TaskViewer({ tasks, selectedTaskId, onSelectTask }: TaskViewerProps) {
  if (tasks.length === 0) {
    return <div className="task-viewer__empty">No tasks</div>;
  }

  const selected = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) : null;

  if (selected && onSelectTask) {
    return <TaskDetail task={selected} tasks={tasks} onBack={() => onSelectTask(selected)} />;
  }

  return (
    <ul className="task-viewer">
      {tasks.map(task => (
        <li
          key={task.id}
          className={`task-viewer__item${task.blockedBy?.length ? ' task-viewer__item--blocked' : ''}`}
          onClick={() => onSelectTask?.(task)}
        >
          <StatusBadge status={task.status} />
          <span className={`task-viewer__subject${task.status === 'completed' ? ' task-viewer__subject--done' : ''}`}>
            {task.subject}
          </span>
          {task.status === 'in_progress' && task.activeForm && (
            <span className="task-viewer__form">{task.activeForm}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
