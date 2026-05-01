import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { handleListFiles, handleReadFile, handleWriteFile } from '../api/files.js';

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

describe('files API', () => {
  let dir;
  let ctx;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'files-test-'));
    ctx = { config: { claudeWorkspaceDir: dir } };
  });

  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  describe('handleListFiles', () => {
    it('returns empty array when dir is empty', () => {
      const res = fakeRes();
      handleListFiles({}, res, ctx);
      assert.deepEqual(res.body, []);
    });

    it('returns files and directories', () => {
      writeFileSync(join(dir, 'CLAUDE.md'), '# hello');
      mkdirSync(join(dir, 'skills'));
      writeFileSync(join(dir, 'skills', 'attack.md'), 'skill');
      const res = fakeRes();
      handleListFiles({}, res, ctx);
      const tree = res.body;
      assert.equal(tree.length, 2);
      const dirNode = tree.find(n => n.name === 'skills');
      assert.equal(dirNode.type, 'dir');
      assert.equal(dirNode.children.length, 1);
      assert.equal(dirNode.children[0].name, 'attack.md');
      const fileNode = tree.find(n => n.name === 'CLAUDE.md');
      assert.equal(fileNode.type, 'file');
      assert.equal(fileNode.size, 7);
    });

    it('skips hidden files', () => {
      writeFileSync(join(dir, '.hidden'), 'secret');
      writeFileSync(join(dir, 'visible.md'), 'ok');
      const res = fakeRes();
      handleListFiles({}, res, ctx);
      assert.equal(res.body.length, 1);
      assert.equal(res.body[0].name, 'visible.md');
    });
  });

  describe('handleReadFile', () => {
    it('reads file content', () => {
      writeFileSync(join(dir, 'test.md'), 'hello world');
      const req = fakeReq('/api/files/test.md');
      const res = fakeRes();
      handleReadFile(req, res, ctx);
      assert.equal(res.body.content, 'hello world');
      assert.equal(res.body.path, 'test.md');
    });

    it('returns 404 for missing file', () => {
      const req = fakeReq('/api/files/nope.md');
      const res = fakeRes();
      handleReadFile(req, res, ctx);
      assert.equal(res.status, 404);
    });

    it('rejects path traversal', () => {
      const req = fakeReq('/api/files/..%2F..%2Fetc%2Fpasswd');
      const res = fakeRes();
      handleReadFile(req, res, ctx);
      assert.equal(res.status, 403);
    });
  });

  describe('handleWriteFile', () => {
    it('writes file content', async () => {
      const req = fakeReq('/api/files/new.md', 'PUT', JSON.stringify({ content: 'new content' }));
      const res = fakeRes();
      handleWriteFile(req, res, ctx);
      await new Promise(r => setTimeout(r, 20));
      assert.equal(res.status, 200);
      assert.equal(readFileSync(join(dir, 'new.md'), 'utf-8'), 'new content');
    });

    it('creates directories recursively', async () => {
      const req = fakeReq('/api/files/rules%2Fnew-rule.md', 'PUT', JSON.stringify({ content: '# rule' }));
      const res = fakeRes();
      handleWriteFile(req, res, ctx);
      await new Promise(r => setTimeout(r, 20));
      assert.equal(res.status, 200);
      assert.equal(readFileSync(join(dir, 'rules', 'new-rule.md'), 'utf-8'), '# rule');
    });

    it('rejects path traversal', async () => {
      const req = fakeReq('/api/files/..%2Fevil.sh', 'PUT', JSON.stringify({ content: 'bad' }));
      const res = fakeRes();
      handleWriteFile(req, res, ctx);
      await new Promise(r => setTimeout(r, 20));
      assert.equal(res.status, 403);
    });
  });
});
