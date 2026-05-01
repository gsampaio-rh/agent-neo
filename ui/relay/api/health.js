import { jsonResponse } from '../lib/response.js';

export function handleHealth(req, res, { hub }) {
  jsonResponse(res, 200, { status: 'ok', clients: hub.clientCount, events: hub.eventCount });
}
