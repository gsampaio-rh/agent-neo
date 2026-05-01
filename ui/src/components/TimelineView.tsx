import { useCallback, useEffect, useRef, useState } from 'react';
import type { TerminalLine } from '../lib/terminalLine';
import { formatJson } from '../lib/format';

interface TimelineViewProps {
  lines: TerminalLine[];
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

function TimelineEntry({ line }: { line: TerminalLine }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!line.detail;

  const toggle = useCallback(() => {
    if (hasDetail) setExpanded((v) => !v);
  }, [hasDetail]);

  return (
    <>
      <div
        className={`timeline-view__entry ${hasDetail ? 'timeline-view__entry--expandable' : ''}`}
        onClick={toggle}
        onKeyDown={hasDetail ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } } : undefined}
        role={hasDetail ? 'button' : undefined}
        tabIndex={hasDetail ? 0 : undefined}
        aria-expanded={hasDetail ? expanded : undefined}
      >
        <span className={`timeline-view__dot timeline-view__dot--${line.type}`} />
        <span className="timeline-view__time">{formatTimestamp(line.timestamp)}</span>
        <span className={`timeline-view__text timeline-view__text--${line.type}`}>
          {line.text}
          {hasDetail && (
            <span className="timeline-view__expand-icon">{expanded ? '▾' : '▸'}</span>
          )}
        </span>
      </div>
      {expanded && line.detail && (
        <div className="timeline-view__detail">
          <pre>{formatJson(line.detail)}</pre>
        </div>
      )}
    </>
  );
}

export function TimelineView({ lines }: TimelineViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [lines.length]);

  return (
    <div className="timeline-view" ref={scrollRef}>
      {lines.length === 0 && (
        <div className="timeline-view__entry">
          <span className="timeline-view__dot timeline-view__dot--info" />
          <span className="timeline-view__time" />
          <span className="timeline-view__text timeline-view__text--info">
            Waiting for agent events...
          </span>
        </div>
      )}
      {lines.map((line) => (
        <TimelineEntry key={line.id} line={line} />
      ))}
    </div>
  );
}
