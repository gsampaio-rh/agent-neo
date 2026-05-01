import { existsSync, writeFileSync, unlinkSync, openSync, closeSync } from 'fs';
import { join } from 'path';

const MAX_BODY_SIZE = 64 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('body too large'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function isAgentRunning(promptDir) {
  return (
    existsSync(join(promptDir, 'prompt.json')) ||
    existsSync(join(promptDir, 'prompt.running'))
  );
}

import { jsonResponse } from '../lib/response.js';

export function handleChat(req, res, { promptDir, hub, metricsCollector, auditLogger }) {
  if (!promptDir) return jsonResponse(res, 503, { error: 'chat API unavailable in this mode' });

  (async () => {
    try {
      const body = JSON.parse(await readBody(req));
      const prompt = (body.prompt || '').trim();
      if (!prompt) return jsonResponse(res, 400, { error: 'prompt is required' });
      if (isAgentRunning(promptDir)) return jsonResponse(res, 409, { status: 'busy', error: 'agent is already running' });

      const payload = { prompt, timestamp: new Date().toISOString() };
      const promptPath = join(promptDir, 'prompt.json');
      let fd;
      try {
        fd = openSync(promptPath, 'wx');
        writeFileSync(fd, JSON.stringify(payload));
      } catch (writeErr) {
        if (writeErr.code === 'EEXIST') {
          return jsonResponse(res, 409, { status: 'busy', error: 'agent is already running' });
        }
        throw writeErr;
      } finally {
        if (fd !== undefined) closeSync(fd);
      }
      if (metricsCollector) metricsCollector.incrementPrompts();
      if (auditLogger) auditLogger.log('prompt_sent', 'user', `Prompt queued (${prompt.length} chars)`, { promptLength: prompt.length });
      console.log(`[relay] Prompt queued (${prompt.length} chars)`);
      return jsonResponse(res, 202, { status: 'queued' });
    } catch (err) {
      console.error('[relay] POST /api/chat error:', err.message);
      return jsonResponse(res, 500, { error: err.message });
    }
  })();
}

export function handleStop(req, res, { promptDir, auditLogger }) {
  if (!promptDir) return jsonResponse(res, 503, { error: 'chat API unavailable in this mode' });

  try {
    if (!isAgentRunning(promptDir)) return jsonResponse(res, 200, { status: 'idle', message: 'no agent running' });
    writeFileSync(join(promptDir, 'prompt.stop'), '');
    if (auditLogger) auditLogger.log('agent_stop', 'user', 'Stop signal sent');
    console.log('[relay] Stop signal sent');
    return jsonResponse(res, 200, { status: 'stopping' });
  } catch (err) {
    console.error('[relay] POST /api/stop error:', err.message);
    return jsonResponse(res, 500, { error: err.message });
  }
}

export function handleReset(req, res, { promptDir, hub, stateManager, metricsCollector, auditLogger }) {
  if (!promptDir) return jsonResponse(res, 503, { error: 'chat API unavailable in this mode' });

  try {
    const donePath = join(promptDir, 'reset.done');
    if (existsSync(donePath)) unlinkSync(donePath);

    if (isAgentRunning(promptDir)) {
      writeFileSync(join(promptDir, 'prompt.stop'), '');
    }
    writeFileSync(join(promptDir, 'prompt.reset'), '');
    hub.reset();
    if (stateManager) stateManager.reset();
    if (metricsCollector) metricsCollector.reset();
    if (auditLogger) auditLogger.log('agent_reset', 'user', 'Agent reset');
    console.log('[relay] Reset signal sent, buffer cleared, state reset');
    return jsonResponse(res, 200, { status: 'resetting' });
  } catch (err) {
    console.error('[relay] POST /api/reset error:', err.message);
    return jsonResponse(res, 500, { error: err.message });
  }
}
