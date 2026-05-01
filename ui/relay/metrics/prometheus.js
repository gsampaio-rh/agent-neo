import { isLlmAvailable } from '../health/vllm.js';

/**
 * Formats a MetricsCollector snapshot as Prometheus text exposition.
 * @param {ReturnType<import('./collector.js').MetricsCollector['getSnapshot']>} snap
 * @param {{ clientCount: number }} hub
 * @returns {string}
 */
export function formatPrometheus(snap, hub) {
  const lines = [];

  counter(lines, 'neo_tokens_input_total', 'Total input tokens consumed', snap.tokens.input);
  counter(lines, 'neo_tokens_output_total', 'Total output tokens generated', snap.tokens.output);
  counter(lines, 'neo_cost_usd_total', 'Total cost in USD', snap.cost.total);
  counter(lines, 'neo_prompts_total', 'Total prompts sent', snap.prompts);
  counter(lines, 'neo_sessions_total', 'Total agent sessions started', snap.sessions);

  counter(lines, 'neo_response_duration_seconds_sum', 'Sum of response durations', snap.latency.count > 0 ? snap.latency.avgMs * snap.latency.count / 1000 : 0);
  counter(lines, 'neo_response_duration_seconds_count', 'Number of completed responses', snap.latency.count);

  if (Object.keys(snap.tools.byName).length > 0) {
    lines.push('# HELP neo_tool_calls_total Tool calls by name');
    lines.push('# TYPE neo_tool_calls_total counter');
    for (const [name, count] of Object.entries(snap.tools.byName)) {
      lines.push(`neo_tool_calls_total{name="${escapeLabelValue(name)}"} ${count}`);
    }
  }

  if (Object.keys(snap.errors.byCategory).length > 0) {
    lines.push('# HELP neo_errors_total Errors by category');
    lines.push('# TYPE neo_errors_total counter');
    for (const [cat, count] of Object.entries(snap.errors.byCategory)) {
      lines.push(`neo_errors_total{category="${escapeLabelValue(cat)}"} ${count}`);
    }
  }

  gauge(lines, 'neo_clients_connected', 'Number of SSE clients connected', hub.clientCount);
  gauge(lines, 'neo_llm_available', 'Whether the LLM backend is reachable', isLlmAvailable() ? 1 : 0);

  return lines.join('\n') + '\n';
}

function counter(lines, name, help, value) {
  lines.push(`# HELP ${name} ${help}`);
  lines.push(`# TYPE ${name} counter`);
  lines.push(`${name} ${value}`);
}

function gauge(lines, name, help, value) {
  lines.push(`# HELP ${name} ${help}`);
  lines.push(`# TYPE ${name} gauge`);
  lines.push(`${name} ${value}`);
}

function escapeLabelValue(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}
