import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSseClient } from '../sseClient';

class MockEventSource {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((msg: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners: Record<string, ((e: unknown) => void)[]> = {};
  closed = false;

  constructor(url: string) { this.url = url; }

  addEventListener(type: string, cb: (e: unknown) => void) {
    (this.listeners[type] ??= []).push(cb);
  }

  close() { this.closed = true; }

  _fireOpen() { this.onopen?.(); }
  _fireMessage(data: string) { this.onmessage?.({ data }); }
  _fireError() { this.onerror?.(); }
  _fireEvent(type: string, data: unknown) {
    for (const cb of this.listeners[type] ?? []) cb(data);
  }
}

let lastInstance: MockEventSource;
vi.stubGlobal('EventSource', class extends MockEventSource {
  constructor(url: string) {
    super(url);
    lastInstance = this;
  }
});

describe('sseClient', () => {
  const onLine = vi.fn();
  const onConnect = vi.fn();
  const onDisconnect = vi.fn();

  beforeEach(() => {
    onLine.mockReset();
    onConnect.mockReset();
    onDisconnect.mockReset();
  });

  it('creates EventSource with given URL', () => {
    createSseClient('/api/events', onLine, onConnect, onDisconnect);
    expect(lastInstance.url).toBe('/api/events');
  });

  it('calls onConnect on open', () => {
    createSseClient('/api/events', onLine, onConnect, onDisconnect);
    lastInstance._fireOpen();
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('splits messages by newline and trims', () => {
    createSseClient('/api/events', onLine, onConnect, onDisconnect);
    lastInstance._fireMessage('line1\nline2\n  \nline3');
    expect(onLine).toHaveBeenCalledTimes(3);
    expect(onLine).toHaveBeenCalledWith('line1');
    expect(onLine).toHaveBeenCalledWith('line2');
    expect(onLine).toHaveBeenCalledWith('line3');
  });

  it('handles file-change event with data.lines array', () => {
    createSseClient('/api/events', onLine, onConnect, onDisconnect);
    lastInstance._fireEvent('file-change', {
      data: JSON.stringify({ lines: ['a', 'b'] }),
    });
    expect(onLine).toHaveBeenCalledWith('a');
    expect(onLine).toHaveBeenCalledWith('b');
  });

  it('handles file-change with non-JSON data', () => {
    createSseClient('/api/events', onLine, onConnect, onDisconnect);
    lastInstance._fireEvent('file-change', { data: 'raw text' });
    expect(onLine).toHaveBeenCalledWith('raw text');
  });

  it('calls onDisconnect on error', () => {
    createSseClient('/api/events', onLine, onConnect, onDisconnect);
    lastInstance._fireError();
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it('close() closes EventSource and calls onDisconnect', () => {
    const client = createSseClient('/api/events', onLine, onConnect, onDisconnect);
    client.close();
    expect(lastInstance.closed).toBe(true);
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });
});
