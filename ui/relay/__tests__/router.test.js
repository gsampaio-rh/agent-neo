import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../router.js';
import { SseHub } from '../sse/hub.js';

function fakeReq(url, method = 'GET') {
  const listeners = {};
  return {
    url,
    method,
    headers: {},
    on(event, cb) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    },
    emit(event) {
      (listeners[event] || []).forEach(cb => cb());
    },
  };
}

function fakeRes() {
  let status, headers;
  const written = [];
  let ended = false;
  return {
    writeHead(s, h) { status = s; headers = h; },
    write(data) { written.push(data); return true; },
    end(data) { if (data) written.push(data); ended = true; },
    get status() { return status; },
    get headers() { return headers; },
    get written() { return written; },
    get ended() { return ended; },
    get body() { return written.join(''); },
  };
}

function basicHeader(user, pass) {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

describe('router', () => {
  let router, hub, stateManager;

  beforeEach(() => {
    hub = new SseHub(100);
    stateManager = {
      getState: () => ({ escaped: false, eventCount: 0, attackPhase: 'normal' }),
      reset: () => {},
    };
    router = createRouter({
      hub,
      config: { dirPath: null, promptDir: null, hasDist: false, distDir: '', claudeWorkspaceDir: '/tmp', authUser: '', authPass: '' },
      stateManager,
    });
  });

  it('responds 204 to OPTIONS with CORS headers', async () => {
    const req = fakeReq('/api/chat', 'OPTIONS');
    const res = fakeRes();
    await router(req, res);
    assert.equal(res.status, 204);
    assert.equal(res.headers['Access-Control-Allow-Origin'], '*');
    assert.ok(res.headers['Access-Control-Allow-Methods'].includes('POST'));
  });

  it('routes GET /api/status', async () => {
    const req = fakeReq('/api/status', 'GET');
    const res = fakeRes();
    await router(req, res);
    assert.equal(res.status, 200);
    const body = JSON.parse(res.body);
    assert.ok('status' in body);
  });

  it('routes GET /api/state', async () => {
    const req = fakeReq('/api/state', 'GET');
    const res = fakeRes();
    await router(req, res);
    assert.equal(res.status, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.escaped, false);
  });

  it('routes GET /api/events as SSE stream', async () => {
    const req = fakeReq('/api/events', 'GET');
    const res = fakeRes();
    await router(req, res);
    assert.equal(res.status, 200);
    assert.equal(res.headers['Content-Type'], 'text/event-stream');
    assert.equal(hub.clientCount, 1);
    req.emit('close');
    assert.equal(hub.clientCount, 0);
  });

  it('routes GET /health', async () => {
    const req = fakeReq('/health', 'GET');
    const res = fakeRes();
    await router(req, res);
    assert.equal(res.status, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'ok');
  });

  it('returns HTML fallback for unknown paths when no dist', async () => {
    const req = fakeReq('/unknown', 'GET');
    const res = fakeRes();
    await router(req, res);
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('Neo'));
  });

  it('returns 503 for POST /api/chat when no promptDir', async () => {
    const listeners = {};
    const req = {
      url: '/api/chat',
      method: 'POST',
      on(event, cb) { listeners[event] = cb; },
    };
    const res = fakeRes();
    await router(req, res);
    assert.equal(res.status, 503);
  });
});

describe('router with auth enabled', () => {
  let router, hub, stateManager;

  beforeEach(() => {
    hub = new SseHub(100);
    stateManager = {
      getState: () => ({ escaped: false, eventCount: 0, attackPhase: 'normal' }),
      reset: () => {},
    };
    router = createRouter({
      hub,
      config: { dirPath: null, promptDir: null, hasDist: false, distDir: '', claudeWorkspaceDir: '/tmp', authUser: 'admin', authPass: 's3cret' },
      stateManager,
    });
  });

  it('/health bypasses auth', async () => {
    const req = fakeReq('/health', 'GET');
    const res = fakeRes();
    await router(req, res);
    assert.equal(res.status, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, 'ok');
  });

  it('OPTIONS bypasses auth', async () => {
    const req = fakeReq('/api/status', 'OPTIONS');
    const res = fakeRes();
    await router(req, res);
    assert.equal(res.status, 204);
  });

  it('returns 401 when no credentials provided', async () => {
    const req = fakeReq('/api/status', 'GET');
    req.headers = {};
    const res = fakeRes();
    await router(req, res);
    assert.equal(res.status, 401);
    assert.ok(res.headers['WWW-Authenticate'].includes('Basic'));
  });

  it('returns 401 for wrong credentials', async () => {
    const req = fakeReq('/api/status', 'GET');
    req.headers = { authorization: basicHeader('admin', 'wrong') };
    const res = fakeRes();
    await router(req, res);
    assert.equal(res.status, 401);
  });

  it('allows request with valid credentials', async () => {
    const req = fakeReq('/api/status', 'GET');
    req.headers = { authorization: basicHeader('admin', 's3cret') };
    const res = fakeRes();
    await router(req, res);
    assert.equal(res.status, 200);
    const body = JSON.parse(res.body);
    assert.ok('status' in body);
  });

  it('includes Authorization in Access-Control-Allow-Headers for OPTIONS', async () => {
    const req = fakeReq('/api/chat', 'OPTIONS');
    const res = fakeRes();
    await router(req, res);
    assert.ok(res.headers['Access-Control-Allow-Headers'].includes('Authorization'));
  });
});
