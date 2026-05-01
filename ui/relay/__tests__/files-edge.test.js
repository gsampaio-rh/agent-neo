import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { handleWriteFile, handleReadFile } from '../api/files.js';

function fakeRes() {
  let status, body;
  return {
    writeHead(s) { status = s; },
    end(b) { body = b; },
    get status() { return status; },
    get body() { return JSON.parse(body); },
  };
}

function fakeReq(url, method = 'GET', bodyStr = '') {
  const listeners = {};
  const req = {
    url,
    method,
    on(event, cb) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
      return req;
    },
    destroy() {},
  };
  process.nextTick(() => {
    if (bodyStr && listeners['data']) listeners['data'].forEach(cb => cb(Buffer.from(bodyStr)));
    if (listeners['end']) listeners['end'].forEach(cb => cb());
  });
  return req;
}

describe('files edge cases', () => {
  let dir, ctx;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'files-edge-'));
    ctx = { config: { claudeWorkspaceDir: dir } };
  });

  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('rejects body larger than 64KB', async () => {
    const bigBody = JSON.stringify({ content: 'x'.repeat(70000) });
    const req = fakeReq('/api/files/big.txt', 'PUT', bigBody);
    const res = fakeRes();
    handleWriteFile(req, res, ctx);
    await new Promise(r => setTimeout(r, 30));
    assert.equal(res.status, 413);
  });

  it('rejects invalid JSON body', async () => {
    const req = fakeReq('/api/files/bad.txt', 'PUT', 'not json');
    const res = fakeRes();
    handleWriteFile(req, res, ctx);
    await new Promise(r => setTimeout(r, 20));
    assert.equal(res.status, 500);
  });

  it('rejects missing content field', async () => {
    const req = fakeReq('/api/files/no-content.txt', 'PUT', JSON.stringify({ wrong: 'field' }));
    const res = fakeRes();
    handleWriteFile(req, res, ctx);
    await new Promise(r => setTimeout(r, 20));
    assert.equal(res.status, 400);
  });

  it('handles path traversal with encoded dots', () => {
    const req = fakeReq('/api/files/..%2F..%2Fetc%2Fpasswd');
    const res = fakeRes();
    handleReadFile(req, res, ctx);
    assert.equal(res.status, 403);
  });

  it('handles double-encoded traversal as literal filename (no double-decode)', () => {
    const req = fakeReq('/api/files/%252e%252e%2Fetc%2Fpasswd');
    const res = fakeRes();
    handleReadFile(req, res, ctx);
    // After single decodeURIComponent: "%2e%2e/etc/passwd" — still within base dir
    // Result is 404 (file not found) not 403 (traversal)
    assert.equal(res.status, 404);
  });

  it('handles empty path segment', () => {
    writeFileSync(join(dir, 'test.txt'), 'hello');
    const req = fakeReq('/api/files/test.txt');
    const res = fakeRes();
    handleReadFile(req, res, ctx);
    assert.equal(res.status, 200);
    assert.equal(res.body.content, 'hello');
  });
});
