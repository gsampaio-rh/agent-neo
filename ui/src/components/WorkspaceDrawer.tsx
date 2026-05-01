import { useState } from 'react';
import { FileExplorer } from './FileExplorer';

export function WorkspaceDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="neo-header__icon-btn"
        onClick={() => setOpen(!open)}
        title=".claude workspace"
        aria-label="Toggle workspace explorer"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1 3.5A1.5 1.5 0 012.5 2h3.172a1.5 1.5 0 011.06.44l.829.828A.5.5 0 008 3.5h5.5A1.5 1.5 0 0115 5v8a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 13V3.5zM2.5 3a.5.5 0 00-.5.5V13a.5.5 0 00.5.5h11a.5.5 0 00.5-.5V5a.5.5 0 00-.5-.5H8a1.5 1.5 0 01-1.06-.44l-.829-.828A.5.5 0 005.672 3H2.5z"/>
        </svg>
      </button>

      {open && (
        <div className="workspace-drawer">
          <div className="workspace-drawer__header">
            <span className="workspace-drawer__title">.claude workspace</span>
            <button className="workspace-drawer__close" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div className="workspace-drawer__body">
            <FileExplorer />
          </div>
        </div>
      )}
    </>
  );
}
