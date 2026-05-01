import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleHealth } from '../api/health.js';

function fakeRes() {
  let status, headers, body;
  return {
    writeHead(s, h) { status = s; headers = h; },
    end(b) { body = b; },
    get status() { return status; },
    get headers() { return headers; },
    get body() { return JSON.parse(body); },
  };
}

describe('handleHealth', () => {
  it('returns status ok with client/event counts', () => {
    const hub = { clientCount: 3, eventCount: 42 };
    const res = fakeRes();
    handleHealth({}, res, { hub });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.clients, 3);
    assert.equal(res.body.events, 42);
  });

  it('includes CORS header', () => {
    const hub = { clientCount: 0, eventCount: 0 };
    const res = fakeRes();
    handleHealth({}, res, { hub });
    assert.equal(res.headers['Access-Control-Allow-Origin'], '*');
  });
});
