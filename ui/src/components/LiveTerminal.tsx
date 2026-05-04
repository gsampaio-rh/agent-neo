import { useCallback, useEffect, useRef, useState } from 'react';
import type { TerminalLine } from '../lib/terminalLine';
import { formatJson } from '../lib/format';
import { TimelineView } from './TimelineView';
import { useEmitMilestone } from '../hooks/useMilestones';

interface LiveTerminalProps {
  lines: TerminalLine[];
  agentAction?: string;
  escaped?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const TYPE_ICONS: Record<string, string> = {
  command: '$',
  output: '←',
  info: '💭',
  success: '✓',
  error: '✗',
  system: '⚙',
};

function TerminalLineRow({ line, onExpand }: { line: TerminalLine; onExpand?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!line.detail;

  const toggle = useCallback(() => {
    if (hasDetail) {
      setExpanded((v) => {
        if (!v && onExpand) onExpand();
        return !v;
      });
    }
  }, [hasDetail, onExpand]);

  return (
    <>
      <div
        className={`live-terminal__line live-terminal__line--${line.type} ${hasDetail ? 'live-terminal__line--expandable' : ''}`}
        onClick={toggle}
        onKeyDown={hasDetail ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } } : undefined}
        role={hasDetail ? 'button' : undefined}
        tabIndex={hasDetail ? 0 : undefined}
        aria-expanded={hasDetail ? expanded : undefined}
      >
        <span className="live-terminal__type-icon">{TYPE_ICONS[line.type] || '·'}</span>
        <span className="live-terminal__text">{line.text}</span>
        {hasDetail && (
          <span className="live-terminal__expand-toggle">{expanded ? '▾' : '▸'}</span>
        )}
      </div>
      {expanded && line.detail && (
        <div className="live-terminal__detail">
          <pre>{formatJson(line.detail)}</pre>
        </div>
      )}
    </>
  );
}

export function LiveTerminal({ lines, agentAction = 'idle', escaped = false, expanded = false, onToggleExpand }: LiveTerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'log' | 'timeline'>('log');
  const emitMilestone = useEmitMilestone();
  const logExpandedEmitted = useRef(false);
  const handleLogExpand = useCallback(() => {
    if (!logExpandedEmitted.current) {
      logExpandedEmitted.current = true;
      emitMilestone('log_expanded');
    }
  }, [emitMilestone]);

  useEffect(() => {
    if (!expanded) setViewMode('log');
  }, [expanded]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [lines.length]);

  const glowClass = escaped
    ? 'live-terminal--glow-breach'
    : lines.length > 0
      ? `live-terminal--glow-${agentAction}`
      : '';

  const expandedClass = expanded ? 'live-terminal--expanded' : '';

  return (
    <div className={`live-terminal ${glowClass} ${expandedClass}`}>
      {onToggleExpand && (
        <div className="live-terminal__header">
          <span className="live-terminal__header-title">agent log</span>
          <div className="live-terminal__header-controls">
            {expanded && (
              <div className="live-terminal__toggle">
                <button
                  className={`live-terminal__toggle-btn ${viewMode === 'log' ? 'live-terminal__toggle-btn--active' : ''}`}
                  onClick={() => setViewMode('log')}
                >
                  Log
                </button>
                <button
                  className={`live-terminal__toggle-btn ${viewMode === 'timeline' ? 'live-terminal__toggle-btn--active' : ''}`}
                  onClick={() => setViewMode('timeline')}
                >
                  Timeline
                </button>
              </div>
            )}
            <button className="live-terminal__expand-btn" onClick={onToggleExpand} title={expanded ? 'Collapse' : 'Expand'}>
              {expanded ? '⤡' : '⤢'}
            </button>
          </div>
        </div>
      )}
      <div className="live-terminal__scroll" ref={scrollRef}>
        {expanded && viewMode === 'timeline' ? (
          <TimelineView lines={lines} />
        ) : (
          <div className="live-terminal__content">
            {lines.length === 0 && (
              <div className="live-terminal__line live-terminal__line--info">
                Waiting for agent events...
                <span className="live-terminal__cursor" />
              </div>
            )}
            {lines.map((line) => (
              <TerminalLineRow key={line.id} line={line} onExpand={handleLogExpand} />
            ))}
            {lines.length > 0 && (
              <div className="live-terminal__line">
                <span className="live-terminal__cursor" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
