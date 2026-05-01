import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendPrompt, stopAgent, resetConversation, fetchStatus } from '../chatApi';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(body: unknown) {
  return { json: () => Promise.resolve(body) };
}

beforeEach(() => { mockFetch.mockReset(); });

describe('chatApi', () => {
  describe('sendPrompt', () => {
    it('calls POST /api/chat with prompt body', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ status: 'queued' }));

      const result = await sendPrompt('hello');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/chat');
      expect(opts.method).toBe('POST');
      expect(opts.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(opts.body)).toEqual({ prompt: 'hello' });
      expect(result.status).toBe('queued');
    });
  });

  describe('stopAgent', () => {
    it('calls POST /api/stop', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ status: 'stopping' }));

      const result = await stopAgent();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/stop');
      expect(opts.method).toBe('POST');
      expect(result.status).toBe('stopping');
    });
  });

  describe('resetConversation', () => {
    it('calls POST /api/reset', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ status: 'reset' }));

      const result = await resetConversation();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/reset');
      expect(opts.method).toBe('POST');
      expect(result.status).toBe('reset');
    });
  });

  describe('fetchStatus', () => {
    it('calls GET /api/status and returns parsed response', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ status: 'idle', events: 42, clients: 1 }));

      const result = await fetchStatus();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('/api/status');
      expect(result).toEqual({ status: 'idle', events: 42, clients: 1 });
    });
  });
});
