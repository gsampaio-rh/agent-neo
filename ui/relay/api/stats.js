import { isLlmAvailable } from '../health/vllm.js';
import { jsonResponse } from '../lib/response.js';

export function handleStats(req, res, { metricsCollector, hub }) {
  const snap = metricsCollector.getSnapshot();
  jsonResponse(res, 200, {
    session: {
      totalSessions: snap.sessions,
      totalPrompts: snap.prompts,
    },
    tokens: {
      totalInput: snap.tokens.input,
      totalOutput: snap.tokens.output,
      lastInput: snap.tokens.lastInput,
      lastOutput: snap.tokens.lastOutput,
    },
    cost: {
      totalUsd: snap.cost.total,
      lastUsd: snap.cost.last,
    },
    latency: snap.latency,
    tools: snap.tools,
    errors: snap.errors,
    system: {
      clients: hub.clientCount,
      bufferedEvents: hub.eventCount,
      llmAvailable: isLlmAvailable(),
      uptimeMs: snap.uptimeMs,
    },
  });
}
