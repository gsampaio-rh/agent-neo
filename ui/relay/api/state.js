import { writeFileSync } from 'fs';
import { join } from 'path';
import { jsonResponse } from '../lib/response.js';

export function handleGetState(req, res, ctx) {
  const state = ctx.stateManager.getState();
  jsonResponse(res, 200, state);
}

export function handleResetState(req, res, ctx) {
  ctx.stateManager.reset();

  const promptDir = ctx.promptDir;
  if (promptDir) {
    try {
      writeFileSync(join(promptDir, 'prompt.reset-attack'), '');
      console.log('[relay] Attack reset control file written');
    } catch (err) {
      console.error('[relay] Failed to write prompt.reset-attack:', err.message);
    }
  }

  jsonResponse(res, 200, { ok: true });
}
