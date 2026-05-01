import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { handleChat, handleStop, handleReset } from '../api/chat.js';
import { SseHub } from '../sse/hub.js';

function fakeReq(body) {
  const chunks = [Buffer.from(JSON.stringify(body))];
  return {
    on(evt, cb) {
      if (evt === 'data') chunks.forEach(c => cb(c));
      if (evt === 'end') setTimeout(cb, 0);
    },
    destroy() {},
  };
}

function fakeRes() {
  let status, body, headers;
  return {
    writeHead(s, h) { status = s; headers = h; },
    end(b) { body = b; },
    get status() { return status; },
    get body() { return JSON.parse(body); },
    get headers() { return headers; },
  };
}

describe('chat API', () => {
  let dir, hub;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'relay-test-'));
    hub = new SseHub();
  });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('returns 503 when promptDir is null', async () => {
    const res = fakeRes();
    handleChat(fakeReq({ prompt: 'hello' }), res, { promptDir: null, hub });
    await new Promise(r => setTimeout(r, 50));
    assert.equal(res.status, 503);
  });

  it('queues a prompt (202)', async () => {
    const res = fakeRes();
    handleChat(fakeReq({ prompt: 'hello' }), res, { promptDir: dir, hub });
    await new Promise(r => setTimeout(r, 50));
    assert.equal(res.status, 202);
    assert.ok(existsSync(join(dir, 'prompt.json')));
    const queued = JSON.parse(readFileSync(join(dir, 'prompt.json'), 'utf8'));
    assert.equal(queued.prompt, 'hello');
  });

  it('rejects empty prompt (400)', async () => {
    const res = fakeRes();
    handleChat(fakeReq({ prompt: '' }), res, { promptDir: dir, hub });
    await new Promise(r => setTimeout(r, 50));
    assert.equal(res.status, 400);
  });

  it('returns 409 when agent is busy', async () => {
    writeFileSync(join(dir, 'prompt.running'), '');
    const res = fakeRes();
    handleChat(fakeReq({ prompt: 'hello' }), res, { promptDir: dir, hub });
    await new Promise(r => setTimeout(r, 50));
    assert.equal(res.status, 409);
  });

  it('stop creates prompt.stop file', () => {
    writeFileSync(join(dir, 'prompt.running'), '');
    const res = fakeRes();
    handleStop({}, res, { promptDir: dir });
    assert.equal(res.status, 200);
    assert.ok(existsSync(join(dir, 'prompt.stop')));
  });

  it('stop returns idle when nothing running', () => {
    const res = fakeRes();
    handleStop({}, res, { promptDir: dir });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'idle');
  });

  it('reset creates prompt.reset and clears hub', () => {
    hub.broadcast('event1');
    const res = fakeRes();
    handleReset({}, res, { promptDir: dir, hub });
    assert.equal(res.status, 200);
    assert.ok(existsSync(join(dir, 'prompt.reset')));
    assert.equal(hub.eventCount, 0);
  });

  it('reset deletes reset.done marker', () => {
    writeFileSync(join(dir, 'reset.done'), '');
    assert.ok(existsSync(join(dir, 'reset.done')));
    const res = fakeRes();
    handleReset({}, res, { promptDir: dir, hub });
    assert.ok(!existsSync(join(dir, 'reset.done')));
    assert.equal(res.body.status, 'resetting');
  });

  it('reset calls stateManager.reset()', () => {
    let resetCalled = false;
    const stateManager = { reset() { resetCalled = true; } };
    const res = fakeRes();
    handleReset({}, res, { promptDir: dir, hub, stateManager });
    assert.ok(resetCalled);
  });
});
