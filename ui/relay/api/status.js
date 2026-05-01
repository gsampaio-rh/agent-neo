import { existsSync } from 'fs';
import { join } from 'path';
import { isLlmAvailable } from '../health/vllm.js';
import { jsonResponse } from '../lib/response.js';

export function handleStatus(req, res, { promptDir, hub, config }) {
  const running = promptDir
    ? existsSync(join(promptDir, 'prompt.json')) || existsSync(join(promptDir, 'prompt.running'))
    : false;

  const resetting = promptDir
    ? existsSync(join(promptDir, 'prompt.reset')) && !existsSync(join(promptDir, 'reset.done'))
    : false;

  jsonResponse(res, 200, {
    status: running ? 'running' : 'idle',
    events: hub.eventCount,
    clients: hub.clientCount,
    resetting,
    llmAvailable: isLlmAvailable(),
    environment: {
      model: process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || 'unknown',
      namespace: config?.namespace || 'unknown',
      podName: process.env.HOSTNAME || 'local',
      permissionMode: process.env.CLAUDE_PERMISSION_MODE || 'default',
    },
  });
}
