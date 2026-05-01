import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isLlmAvailable, startVllmHealthPoller, stopVllmHealthPoller, _setAvailable } from '../health/vllm.js';

describe('vllm health poller', () => {
  beforeEach(() => {
    _setAvailable(true);
  });

  afterEach(() => {
    stopVllmHealthPoller();
    mock.restoreAll();
  });

  it('returns true by default when no poller started', () => {
    assert.equal(isLlmAvailable(), true);
  });

  it('sets available=false when fetch throws', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(() => Promise.reject(new Error('ECONNREFUSED')));

    startVllmHealthPoller('http://vllm:8000/v1', 999999);
    await new Promise((r) => setTimeout(r, 50));

    assert.equal(isLlmAvailable(), false);
    globalThis.fetch = originalFetch;
  });

  it('sets available=false when response is not ok', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(() => Promise.resolve({ ok: false, status: 503 }));

    startVllmHealthPoller('http://vllm:8000/v1', 999999);
    await new Promise((r) => setTimeout(r, 50));

    assert.equal(isLlmAvailable(), false);
    globalThis.fetch = originalFetch;
  });

  it('sets available=true when response is ok', async () => {
    _setAvailable(false);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(() => Promise.resolve({ ok: true, status: 200 }));

    startVllmHealthPoller('http://vllm:8000/v1', 999999);
    await new Promise((r) => setTimeout(r, 50));

    assert.equal(isLlmAvailable(), true);
    globalThis.fetch = originalFetch;
  });

  it('derives health URL by stripping /v1', async () => {
    const originalFetch = globalThis.fetch;
    let calledUrl = '';
    globalThis.fetch = mock.fn((url) => {
      calledUrl = url;
      return Promise.resolve({ ok: true });
    });

    startVllmHealthPoller('http://vllm-svc:8000/v1', 999999);
    await new Promise((r) => setTimeout(r, 50));

    assert.equal(calledUrl, 'http://vllm-svc:8000/health');
    globalThis.fetch = originalFetch;
  });

  it('skips polling when baseUrl is empty', () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock.fn(() => Promise.resolve({ ok: true }));

    startVllmHealthPoller('', 999999);
    assert.equal(globalThis.fetch.mock.calls.length, 0);
    assert.equal(isLlmAvailable(), true);
    globalThis.fetch = originalFetch;
  });
});
