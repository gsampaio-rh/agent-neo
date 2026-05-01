import type { MessageStats } from '../lib/chatReducer';
import { formatNumber, formatDuration } from '../lib/format';

interface ChatStatsProps {
  stats: MessageStats;
}

export function ChatStats({ stats }: ChatStatsProps) {
  const parts: string[] = [];

  if (stats.inputTokens != null) parts.push(`IN: ${formatNumber(stats.inputTokens)}`);
  if (stats.outputTokens != null) parts.push(`OUT: ${formatNumber(stats.outputTokens)}`);
  if (stats.durationMs != null) parts.push(formatDuration(stats.durationMs));
  if (stats.costUsd != null) parts.push(`$${stats.costUsd.toFixed(4)}`);
  if (stats.toolCallCount > 0) {
    parts.push(`${stats.toolCallCount} tool${stats.toolCallCount !== 1 ? 's' : ''}`);
  }

  if (parts.length === 0) return null;

  return (
    <div className="chat-stats">
      {parts.map((part, i) => (
        <span key={i} className="chat-stats__item">{part}</span>
      ))}
    </div>
  );
}
