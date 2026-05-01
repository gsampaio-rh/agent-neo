import type { SessionStats } from '../lib/chatReducer';
import { formatNumber, formatElapsed } from '../lib/format';

interface SessionStatsPanelProps {
  stats: SessionStats;
}

export function SessionStatsPanel({ stats }: SessionStatsPanelProps) {
  const hasActivity = stats.totalPrompts > 0;
  if (!hasActivity) return null;

  return (
    <div className="sidebar__section">
      <h3 className="sidebar__heading">session</h3>
      <ul className="session-stats">
        <li className="session-stats__row">
          <span className="session-stats__label">prompts</span>
          <span className="session-stats__value">{stats.totalPrompts}</span>
        </li>
        {(stats.totalInputTokens > 0 || stats.totalOutputTokens > 0) && (
          <li className="session-stats__row">
            <span className="session-stats__label">tokens</span>
            <span className="session-stats__value">
              {formatNumber(stats.totalInputTokens)} / {formatNumber(stats.totalOutputTokens)}
            </span>
          </li>
        )}
        {stats.totalToolCalls > 0 && (
          <li className="session-stats__row">
            <span className="session-stats__label">tools</span>
            <span className="session-stats__value">{stats.totalToolCalls}</span>
          </li>
        )}
        {stats.sessionStartedAt && (
          <li className="session-stats__row">
            <span className="session-stats__label">elapsed</span>
            <span className="session-stats__value">{formatElapsed(stats.sessionStartedAt)}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
