import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { handleStatus } from '../api/status.js';
import { SseHub } from '../sse/hub.js';
import { _setAvailable } from '../health/vllm.js';

function fakeRes() {
  let status, body;
  return {
    writeHead(s) { status = s; },
    end(b) { body = b; },
    get status() { return status; },
    get body() { return JSON.parse(body); },
  };
}

describe('handleStatus', () => {
  let dir, hub;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'status-test-'));
    hub = new SseHub();
  });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('returns idle when no prompt files exist', () => {
    const res = fakeRes();
    handleStatus({}, res, { promptDir: dir, hub });
    assert.equal(res.body.status, 'idle');
  });

  it('returns running when prompt.running exists', () => {
    writeFileSync(join(dir, 'prompt.running'), '');
    const res = fakeRes();
    handleStatus({}, res, { promptDir: dir, hub });
    assert.equal(res.body.status, 'running');
  });

  it('returns running when prompt.json exists', () => {
    writeFileSync(join(dir, 'prompt.json'), '{}');
    const res = fakeRes();
    handleStatus({}, res, { promptDir: dir, hub });
    assert.equal(res.body.status, 'running');
  });

  it('includes event and client counts', () => {
    hub.broadcast('test');
    const res = fakeRes();
    handleStatus({}, res, { promptDir: dir, hub });
    assert.equal(res.body.events, 1);
    assert.equal(res.body.clients, 0);
  });

  it('returns resetting=true when prompt.reset exists without reset.done', () => {
    writeFileSync(join(dir, 'prompt.reset'), '');
    const res = fakeRes();
    handleStatus({}, res, { promptDir: dir, hub });
    assert.equal(res.body.resetting, true);
  });

  it('returns resetting=false when reset.done exists', () => {
    writeFileSync(join(dir, 'prompt.reset'), '');
    writeFileSync(join(dir, 'reset.done'), '');
    const res = fakeRes();
    handleStatus({}, res, { promptDir: dir, hub });
    assert.equal(res.body.resetting, false);
  });

  it('returns resetting=false when no reset files exist', () => {
    const res = fakeRes();
    handleStatus({}, res, { promptDir: dir, hub });
    assert.equal(res.body.resetting, false);
  });

  it('returns llmAvailable=true when vllm is healthy', () => {
    _setAvailable(true);
    const res = fakeRes();
    handleStatus({}, res, { promptDir: dir, hub });
    assert.equal(res.body.llmAvailable, true);
  });

  it('returns llmAvailable=false when vllm is down', () => {
    _setAvailable(false);
    const res = fakeRes();
    handleStatus({}, res, { promptDir: dir, hub });
    assert.equal(res.body.llmAvailable, false);
  });
});
