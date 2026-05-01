#!/usr/bin/env node
/**
 * Neo SSE Relay — entry point.
 *
 * Modes:
 *   node relay.mjs                           # oc exec tail (local dev)
 *   node relay.mjs --namespace agent-ns      # custom namespace
 *   node relay.mjs --file /path/to/log.jsonl # one-shot replay from file
 *   node relay.mjs --dir /data/claude-logs   # tail local JSONL (in-cluster sidecar)
 */

import { createServer } from 'http';
import { config } from './relay/config.js';
import { SseHub } from './relay/sse/hub.js';
import { createRouter } from './relay/router.js';
import { startPodStream } from './relay/sources/pod.js';
import { startFileStream } from './relay/sources/file.js';
import { startDirStream } from './relay/sources/dir.js';
import { startSystemLogStream } from './relay/sources/system.js';
import { StateManager } from './relay/state/manager.js';
import { startVllmHealthPoller } from './relay/health/vllm.js';

const hub = new SseHub();
const stateManager = new StateManager(config.promptDir);

const originalBroadcast = hub.broadcast.bind(hub);
hub.broadcast = (line) => {
  stateManager.processLine(line);
  originalBroadcast(line);
};

const router = createRouter({ hub, config, stateManager });
const server = createServer(router);

server.listen(config.port, '0.0.0.0', () => {
  console.log(`[relay] Listening on http://0.0.0.0:${config.port}`);
  if (config.hasDist) console.log(`[relay] Serving static files from ${config.distDir}`);
  startVllmHealthPoller(config.anthropicBaseUrl, config.vllmHealthIntervalMs);
  console.log('');

  if (config.dirPath) {
    startDirStream(hub, config.dirPath);
    startSystemLogStream(hub, config.dirPath);
  } else if (config.filePath) {
    startFileStream(hub, config.filePath);
  } else {
    startPodStream(hub, config);
  }
});
