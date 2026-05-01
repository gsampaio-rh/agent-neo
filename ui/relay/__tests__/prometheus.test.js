import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MetricsCollector } from '../metrics/collector.js';
import { formatPrometheus } from '../metrics/prometheus.js';

describe('formatPrometheus', () => {
  let collector;
  const fakeHub = { clientCount: 3 };

  beforeEach(() => { collector = new MetricsCollector(); });

  it('produces valid Prometheus text for empty state', () => {
    const text = formatPrometheus(collector.getSnapshot(), fakeHub);
    assert.ok(text.includes('# HELP neo_tokens_input_total'));
    assert.ok(text.includes('# TYPE neo_tokens_input_total counter'));
    assert.ok(text.includes('neo_tokens_input_total 0'));
    assert.ok(text.includes('neo_clients_connected 3'));
    assert.ok(text.endsWith('\n'));
  });

  it('includes tool call labels', () => {
    collector.processLine(JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Bash', id: '1', input: {} }] },
    }));
    const text = formatPrometheus(collector.getSnapshot(), fakeHub);
    assert.ok(text.includes('neo_tool_calls_total{name="Bash"} 1'));
  });

  it('includes error category labels', () => {
    collector.processLine('{"type":"system","subtype":"api_retry","error":"rate_limit"}');
    const text = formatPrometheus(collector.getSnapshot(), fakeHub);
    assert.ok(text.includes('neo_errors_total{category="api_retry"} 1'));
  });

  it('escapes label values', () => {
    collector.processLine(JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Tool"With"Quotes', id: '1', input: {} }] },
    }));
    const text = formatPrometheus(collector.getSnapshot(), fakeHub);
    assert.ok(text.includes('Tool\\"With\\"Quotes'));
  });

  it('includes duration counters', () => {
    collector.processLine(JSON.stringify({
      type: 'result',
      usage: { input_tokens: 10, output_tokens: 5 },
      duration_ms: 2000,
    }));
    const text = formatPrometheus(collector.getSnapshot(), fakeHub);
    assert.ok(text.includes('neo_response_duration_seconds_sum 2'));
    assert.ok(text.includes('neo_response_duration_seconds_count 1'));
  });
});
