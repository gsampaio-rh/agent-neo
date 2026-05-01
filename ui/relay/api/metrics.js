import { formatPrometheus } from '../metrics/prometheus.js';

export function handleMetrics(req, res, { metricsCollector, hub }) {
  const snap = metricsCollector.getSnapshot();
  const body = formatPrometheus(snap, hub);
  res.writeHead(200, {
    'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}
