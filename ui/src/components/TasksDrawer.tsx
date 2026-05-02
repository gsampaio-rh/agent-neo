import { useCallback, useEffect, useState } from 'react';
import { TaskViewer } from './TaskViewer';
import type { TasksState } from '../hooks/useTasks';
import type { Task } from '../services/tasksApi';

interface TasksDrawerProps {
  tasksState: TasksState;
}

export function TasksDrawer({ tasksState }: TasksDrawerProps) {
  const [open, setOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (open) tasksState.clearActivity();
  }, [open, tasksState.clearActivity]);

  const handleSelectTask = useCallback((task: Task) => {
    setSelectedTaskId(prev => prev === task.id ? null : task.id);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setSelectedTaskId(null);
  }, []);

  return (
    <>
      <button
        className="neo-header__icon-btn"
        onClick={() => setOpen(!open)}
        title="Tasks"
        aria-label="Toggle tasks panel"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2.5A.5.5 0 012.5 2h11a.5.5 0 010 1h-11A.5.5 0 012 2.5zm0 4A.5.5 0 012.5 6h11a.5.5 0 010 1h-11A.5.5 0 012 6.5zm0 4A.5.5 0 012.5 10h11a.5.5 0 010 1h-11a.5.5 0 010-1zM.5 3a.5.5 0 11-1 0 .5.5 0 011 0zm0 4a.5.5 0 11-1 0 .5.5 0 011 0zm0 4a.5.5 0 11-1 0 .5.5 0 011 0z"/>
        </svg>
        {tasksState.hasActivity && !open && <span className="neo-header__badge-dot" />}
      </button>

      {open && (
        <div className="workspace-drawer">
          <div className="workspace-drawer__header">
            <span className="workspace-drawer__title">
              Tasks ({tasksState.completedCount}/{tasksState.taskCount})
            </span>
            <button className="workspace-drawer__close" onClick={handleClose}>✕</button>
          </div>
          <div className="workspace-drawer__body">
            <TaskViewer
              tasks={tasksState.tasks}
              selectedTaskId={selectedTaskId}
              onSelectTask={handleSelectTask}
            />
          </div>
        </div>
      )}
    </>
  );
}
