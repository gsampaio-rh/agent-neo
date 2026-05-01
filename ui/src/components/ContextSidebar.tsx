import type { AgentContext } from '../lib/contextReducer';
import { OP_ICON, OP_CLASS, truncatePath } from '../lib/constants';

interface ContextSidebarProps {
  context: AgentContext;
  maxFiles?: number;
  maxNetworkItems?: number;
  className?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

export function ContextSidebar({
  context,
  maxFiles = 5,
  maxNetworkItems = 4,
  className = 'sidebar',
  children,
  footer,
}: ContextSidebarProps) {
  const recentFiles = context.files.slice(-maxFiles);

  return (
    <aside className={className}>
      <div className="sidebar__section">
        <h3 className="sidebar__heading">pwd</h3>
        <span className="sidebar__mono">{truncatePath(context.cwd)}</span>
      </div>

      {children}

      <div className="sidebar__section">
        <h3 className="sidebar__heading">
          files <span className="sidebar__count">{context.files.length}</span>
        </h3>
        {recentFiles.length > 0 ? (
          <ul className="sidebar__list">
            {recentFiles.map((f) => (
              <li key={`${f.op}:${f.path}`} className={`sidebar__list-item ${OP_CLASS[f.op]}`}>
                <span className="sidebar__op-badge">{OP_ICON[f.op]}</span>
                {truncatePath(f.path, 22)}
              </li>
            ))}
          </ul>
        ) : (
          <span className="sidebar__empty">none</span>
        )}
      </div>

      <div className="sidebar__section">
        <h3 className="sidebar__heading">
          network <span className="sidebar__count">{context.networkFinds.length}</span>
        </h3>
        {context.networkFinds.length > 0 ? (
          <ul className="sidebar__list">
            {context.networkFinds.slice(-maxNetworkItems).map((n) => (
              <li key={n} className="sidebar__list-item sidebar__list-item--net">{n}</li>
            ))}
          </ul>
        ) : (
          <span className="sidebar__empty">none</span>
        )}
      </div>

      {footer}
    </aside>
  );
}
