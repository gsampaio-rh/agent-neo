export interface AuditEvent {
  ts: string;
  event: string;
  actor: string;
  detail: string;
  meta: Record<string, unknown>;
}

export interface AuditResponse {
  events: AuditEvent[];
  total: number;
  hasMore: boolean;
}

export interface AuditFilters {
  event?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function fetchAuditLog(filters: AuditFilters = {}): Promise<AuditResponse> {
  const params = new URLSearchParams();
  if (filters.event) params.set('event', filters.event);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));

  const qs = params.toString();
  const res = await fetch(`/api/audit${qs ? `?${qs}` : ''}`);
  if (!res.ok) return { events: [], total: 0, hasMore: false };
  return res.json();
}
