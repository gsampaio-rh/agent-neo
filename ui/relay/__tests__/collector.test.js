import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MetricsCollector } from '../metrics/collector.js';

describe('MetricsCollector', () => {
  let collector;
  beforeEach(() => { collector = new MetricsCollector(); });

  it('starts with zeroed counters', () => {
    const snap = collector.getSnapshot();
    assert.equal(snap.tokens.input, 0);
    assert.equal(snap.tokens.output, 0);
    assert.equal(snap.cost.total, 0);
    assert.equal(snap.sessions, 0);
    assert.equal(snap.prompts, 0);
    assert.equal(snap.tools.total, 0);
    assert.equal(snap.errors.total, 0);
  });

  it('skips irrelevant lines without JSON.parse', () => {
    collector.processLine('{"type":"assistant","message":{"content":[{"type":"text","text":"hello"}]}}');
    collector.processLine('{"type":"user","message":{"content":[{"type":"text","text":"hi"}]}}');
    collector.processLine('just some random text');
    const snap = collector.getSnapshot();
    assert.equal(snap.tokens.input, 0);
    assert.equal(snap.tools.total, 0);
  });

  it('extracts tokens and cost from result events', () => {
    const result = JSON.stringify({
      type: 'result',
      usage: { input_tokens: 100, output_tokens: 50 },
      total_cost_usd: 0.0025,
      duration_ms: 1500,
    });
    collector.processLine(result);

    const snap = collector.getSnapshot();
    assert.equal(snap.tokens.input, 100);
    assert.equal(snap.tokens.output, 50);
    assert.equal(snap.tokens.lastInput, 100);
    assert.equal(snap.tokens.lastOutput, 50);
    assert.equal(snap.cost.total, 0.0025);
    assert.equal(snap.cost.last, 0.0025);
    assert.equal(snap.latency.lastMs, 1500);
    assert.equal(snap.latency.maxMs, 1500);
    assert.equal(snap.latency.count, 1);
  });

  it('accumulates multiple result events', () => {
    const mkResult = (inp, out, cost, dur) => JSON.stringify({
      type: 'result',
      usage: { input_tokens: inp, output_tokens: out },
      total_cost_usd: cost,
      duration_ms: dur,
    });
    collector.processLine(mkResult(100, 50, 0.001, 1000));
    collector.processLine(mkResult(200, 75, 0.002, 3000));

    const snap = collector.getSnapshot();
    assert.equal(snap.tokens.input, 300);
    assert.equal(snap.tokens.output, 125);
    assert.equal(snap.cost.total, 0.003);
    assert.equal(snap.latency.maxMs, 3000);
    assert.equal(snap.latency.count, 2);
    assert.equal(snap.latency.avgMs, 2000);
  });

  it('counts tool calls by name', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', name: 'Bash', id: '1', input: {} },
          { type: 'tool_use', name: 'Read', id: '2', input: {} },
          { type: 'tool_use', name: 'Bash', id: '3', input: {} },
        ],
      },
    });
    collector.processLine(line);

    const snap = collector.getSnapshot();
    assert.equal(snap.tools.total, 3);
    assert.equal(snap.tools.byName.Bash, 2);
    assert.equal(snap.tools.byName.Read, 1);
  });

  it('counts init events as sessions', () => {
    collector.processLine('{"type":"system","subtype":"init","model":"claude"}');
    collector.processLine('{"type":"system","subtype":"init","model":"claude"}');

    const snap = collector.getSnapshot();
    assert.equal(snap.sessions, 2);
  });

  it('counts api_retry errors', () => {
    collector.processLine('{"type":"system","subtype":"api_retry","error":"rate_limit"}');

    const snap = collector.getSnapshot();
    assert.equal(snap.errors.total, 1);
    assert.equal(snap.errors.byCategory.api_retry, 1);
  });

  it('increments prompts', () => {
    collector.incrementPrompts();
    collector.incrementPrompts();
    assert.equal(collector.getSnapshot().prompts, 2);
  });

  it('resets all counters', () => {
    collector.processLine(JSON.stringify({
      type: 'result',
      usage: { input_tokens: 100, output_tokens: 50 },
      total_cost_usd: 0.01,
      duration_ms: 1000,
    }));
    collector.incrementPrompts();
    collector.reset();

    const snap = collector.getSnapshot();
    assert.equal(snap.tokens.input, 0);
    assert.equal(snap.prompts, 0);
    assert.equal(snap.cost.total, 0);
  });

  it('caps tool names at MAX_TOOL_NAMES', () => {
    for (let i = 0; i < 105; i++) {
      collector.processLine(JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: `Tool${i}`, id: String(i), input: {} }] },
      }));
    }
    const snap = collector.getSnapshot();
    assert.equal(Object.keys(snap.tools.byName).length, 100);
  });

  it('handles malformed JSON gracefully', () => {
    collector.processLine('{"type":"result", broken json');
    const snap = collector.getSnapshot();
    assert.equal(snap.tokens.input, 0);
  });

  it('tracks uptimeMs', () => {
    const snap = collector.getSnapshot();
    assert.ok(snap.uptimeMs >= 0);
  });
});
