import { handleChat, handleStop, handleReset } from './api/chat.js';
import { handleStatus } from './api/status.js';
import { handleHealth } from './api/health.js';
import { handleGetState, handleResetState } from './api/state.js';
import { handleListFiles, handleReadFile, handleWriteFile } from './api/files.js';
import { handleListTasks, handleGetTask } from './api/tasks.js';
import { handleListPlans, handleGetPlan } from './api/plans.js';
import { handleMetrics } from './api/metrics.js';
import { handleStats } from './api/stats.js';
import { handleAudit } from './api/audit.js';
import { createAuthCheck } from './lib/auth.js';
import { serveStatic } from './static.js';

export function createRouter({ hub, config, stateManager, metricsCollector, auditLogger, taskWatcher, planReader }) {
  const ctx = { promptDir: config.dirPath ? config.promptDir : null, hub, stateManager, config, metricsCollector, auditLogger, taskWatcher, planReader };
  const checkAuth = createAuthCheck(config.authUser, config.authPass);

  return async function route(req, res) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      });
      res.end();
      return;
    }

    if (req.url === '/health') return handleHealth(req, res, ctx);

    // Prometheus scraper uses cluster-internal networking — no Basic Auth.
    // Exposes only aggregate counters, no PII or prompt content.
    if (req.url === '/api/metrics' && req.method === 'GET') return handleMetrics(req, res, ctx);

    if (checkAuth && !checkAuth(req, res)) return;

    if (req.url === '/api/chat' && req.method === 'POST') return handleChat(req, res, ctx);
    if (req.url === '/api/stop' && req.method === 'POST') return handleStop(req, res, ctx);
    if (req.url === '/api/reset' && req.method === 'POST') return handleReset(req, res, ctx);
    if (req.url === '/api/status' && req.method === 'GET') return handleStatus(req, res, ctx);
    if (req.url === '/api/stats' && req.method === 'GET') return handleStats(req, res, ctx);
    if (req.url === '/api/audit' && req.method === 'GET') return handleAudit(req, res, ctx);
    if (req.url === '/api/state' && req.method === 'GET') return handleGetState(req, res, ctx);
    if (req.url === '/api/state/reset' && req.method === 'POST') return handleResetState(req, res, ctx);
    if (req.url === '/api/files' && req.method === 'GET') return handleListFiles(req, res, ctx);
    if (req.url.startsWith('/api/files/') && req.method === 'GET') return handleReadFile(req, res, ctx);
    if (req.url.startsWith('/api/files/') && req.method === 'PUT') return handleWriteFile(req, res, ctx);
    if (req.url === '/api/tasks' && req.method === 'GET') return handleListTasks(req, res, ctx);
    if (req.url.startsWith('/api/tasks/') && req.method === 'GET') return handleGetTask(req, res, ctx);
    if (req.url === '/api/plans' && req.method === 'GET') return handleListPlans(req, res, ctx);
    if (req.url.startsWith('/api/plans/') && req.method === 'GET') return handleGetPlan(req, res, ctx);

    if (req.url === '/api/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      hub.addClient(res);
      console.log(`[relay] Client connected (total: ${hub.clientCount}), replaying ${hub.eventCount} buffered events`);
      hub.replayTo(res);

      const keepAlive = setInterval(() => res.write(':ping\n\n'), 15000);
      req.on('close', () => {
        clearInterval(keepAlive);
        hub.removeClient(res);
        console.log(`[relay] Client disconnected (total: ${hub.clientCount})`);
      });
      return;
    }

    if (config.hasDist) {
      serveStatic(req, res, config.distDir);
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
    res.end(`<html><body style="background:#0a0a1a;color:#33ff66;font-family:monospace;padding:2em">
      <h2>Neo — SSE Relay</h2>
      <p>Clients connected: ${hub.clientCount}</p>
      <p>Buffered events: ${hub.eventCount}</p>
      <p>SSE endpoint: <code>GET /api/events</code></p>
    </body></html>`);
  };
}
