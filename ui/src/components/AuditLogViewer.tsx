import { useCallback, useEffect, useState } from 'react';
import { fetchAuditLog, type AuditEvent } from '../services/auditApi';

const EVENT_TYPES = ['', 'login', 'prompt_sent', 'prompt_completed', 'agent_stop', 'agent_reset', 'config_change', 'error'] as const;
const PAGE_SIZE = 25;

export function AuditLogViewer() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [eventFilter, setEventFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (filter: string, page: number) => {
    setLoading(true);
    try {
      const result = await fetchAuditLog({
        event: filter || undefined,
        limit: PAGE_SIZE,
        offset: page,
      });
      setEvents(result.events);
      setTotal(result.total);
      setHasMore(result.hasMore);
    } catch {
      setEvents([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(eventFilter, offset);
  }, [eventFilter, offset, load]);

  const handleFilterChange = (value: string) => {
    setEventFilter(value);
    setOffset(0);
  };

  return (
    <div className="settings-drawer__section">
      <h3 className="settings-drawer__section-title">Audit Log</h3>

      <div className="audit-log__controls">
        <select
          className="audit-log__filter"
          value={eventFilter}
          onChange={e => handleFilterChange(e.target.value)}
        >
          {EVENT_TYPES.map(t => (
            <option key={t} value={t}>{t || 'All events'}</option>
          ))}
        </select>
        <span className="audit-log__total">{total} event{total !== 1 ? 's' : ''}</span>
      </div>

      {loading && <div className="settings-drawer__loading">Loading...</div>}

      {!loading && events.length === 0 && (
        <div className="settings-drawer__value">No audit events found</div>
      )}

      {events.length > 0 && (
        <div className="audit-log__table-wrap">
          <table className="audit-log__table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Actor</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={`${e.ts}-${i}`}>
                  <td className="audit-log__cell--time">{formatTime(e.ts)}</td>
                  <td><span className={`audit-log__badge audit-log__badge--${badgeColor(e.event)}`}>{e.event}</span></td>
                  <td>{e.actor}</td>
                  <td className="audit-log__cell--detail">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(offset > 0 || hasMore) && (
        <div className="audit-log__pagination">
          <button
            className="audit-log__page-btn"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Prev
          </button>
          <span className="audit-log__page-info">
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <button
            className="audit-log__page-btn"
            disabled={!hasMore}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

function badgeColor(event: string): string {
  if (event === 'error') return 'red';
  if (event.startsWith('prompt')) return 'green';
  if (event.startsWith('agent')) return 'cyan';
  if (event === 'config_change') return 'yellow';
  return 'default';
}
