import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthCheck } from '../lib/auth.js';

function fakeReq(authHeader) {
  return { headers: { authorization: authHeader } };
}

function fakeRes() {
  let status = null;
  let headers = {};
  let body = '';
  return {
    writeHead(s, h) { status = s; headers = h; },
    end(b) { body = b || ''; },
    get status() { return status; },
    get headers() { return headers; },
    get body() { return body; },
  };
}

function basicHeader(user, pass) {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

describe('createAuthCheck', () => {
  it('returns null when user is empty (auth disabled)', () => {
    assert.strictEqual(createAuthCheck('', 'pass'), null);
    assert.strictEqual(createAuthCheck(null, 'pass'), null);
    assert.strictEqual(createAuthCheck(undefined, 'pass'), null);
  });

  it('allows valid credentials', () => {
    const check = createAuthCheck('admin', 's3cret');
    const req = fakeReq(basicHeader('admin', 's3cret'));
    const res = fakeRes();
    assert.strictEqual(check(req, res), true);
  });

  it('rejects invalid password', () => {
    const check = createAuthCheck('admin', 's3cret');
    const req = fakeReq(basicHeader('admin', 'wrong'));
    const res = fakeRes();
    assert.strictEqual(check(req, res), false);
    assert.strictEqual(res.status, 401);
    assert.ok(res.headers['WWW-Authenticate'].includes('Basic'));
  });

  it('rejects invalid username', () => {
    const check = createAuthCheck('admin', 's3cret');
    const req = fakeReq(basicHeader('hacker', 's3cret'));
    const res = fakeRes();
    assert.strictEqual(check(req, res), false);
    assert.strictEqual(res.status, 401);
  });

  it('rejects missing Authorization header', () => {
    const check = createAuthCheck('admin', 's3cret');
    const req = { headers: {} };
    const res = fakeRes();
    assert.strictEqual(check(req, res), false);
    assert.strictEqual(res.status, 401);
  });

  it('rejects non-Basic scheme', () => {
    const check = createAuthCheck('admin', 's3cret');
    const req = fakeReq('Bearer some-token');
    const res = fakeRes();
    assert.strictEqual(check(req, res), false);
    assert.strictEqual(res.status, 401);
  });

  it('handles passwords containing colons', () => {
    const check = createAuthCheck('user', 'pass:with:colons');
    const req = fakeReq(basicHeader('user', 'pass:with:colons'));
    const res = fakeRes();
    assert.strictEqual(check(req, res), true);
  });

  it('rejects malformed base64 (no colon separator)', () => {
    const check = createAuthCheck('admin', 's3cret');
    const req = fakeReq('Basic ' + Buffer.from('nocolon').toString('base64'));
    const res = fakeRes();
    assert.strictEqual(check(req, res), false);
    assert.strictEqual(res.status, 401);
  });
});
