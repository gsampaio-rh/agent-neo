import { jsonResponse } from '../lib/response.js';

export function handleAudit(req, res, { auditLogger }) {
  if (!auditLogger) return jsonResponse(res, 503, { error: 'audit log not available' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  if (Number.isNaN(limit) || Number.isNaN(offset) || limit < 0 || offset < 0) {
    return jsonResponse(res, 400, { error: 'limit and offset must be non-negative integers' });
  }

  const filters = {
    event: url.searchParams.get('event') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
    limit,
    offset,
  };

  const result = auditLogger.query(filters);
  jsonResponse(res, 200, result);
}
