import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { serveStatic } from '../static.js';

function fakeRes() {
  let status, body, headers = {};
  return {
    writeHead(s, h) { status = s; headers = h || {}; },
    end(b) { body = b; },
    get status() { return status; },
    get body() { return body; },
    get contentType() { return headers['Content-Type']; },
  };
}

describe('serveStatic', () => {
  let distDir;
  beforeEach(() => {
    distDir = mkdtempSync(join(tmpdir(), 'static-test-'));
    writeFileSync(join(distDir, 'index.html'), '<html>test</html>');
    mkdirSync(join(distDir, 'assets'));
    writeFileSync(join(distDir, 'assets', 'app.js'), 'console.log("hi")');
  });
  afterEach(() => { rmSync(distDir, { recursive: true, force: true }); });

  it('serves index.html for root', () => {
    const res = fakeRes();
    serveStatic({ url: '/' }, res, distDir);
    assert.equal(res.status, 200);
    assert.ok(res.body.toString().includes('<html>'));
    assert.equal(res.contentType, 'text/html');
  });

  it('serves nested files', () => {
    const res = fakeRes();
    serveStatic({ url: '/assets/app.js' }, res, distDir);
    assert.equal(res.status, 200);
    assert.equal(res.contentType, 'application/javascript');
  });

  it('blocks path traversal', () => {
    const res = fakeRes();
    serveStatic({ url: '/../../../etc/passwd' }, res, distDir);
    assert.equal(res.status, 403);
  });

  it('falls back to index.html for unknown paths', () => {
    const res = fakeRes();
    serveStatic({ url: '/unknown-route' }, res, distDir);
    assert.equal(res.status, 200);
    assert.ok(res.body.toString().includes('<html>'));
  });
});
