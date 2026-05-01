import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { SseHub } from '../sse/hub.js';

describe('SseHub', () => {
  let hub;
  beforeEach(() => { hub = new SseHub(5); });

  it('starts empty', () => {
    assert.equal(hub.eventCount, 0);
    assert.equal(hub.clientCount, 0);
  });

  it('broadcasts to connected clients', () => {
    const received = [];
    const fakeRes = { write: (data) => received.push(data) };
    hub.addClient(fakeRes);
    hub.broadcast('{"type":"test"}');
    assert.equal(received.length, 1);
    assert.ok(received[0].includes('{"type":"test"}'));
  });

  it('buffers events', () => {
    hub.broadcast('line1');
    hub.broadcast('line2');
    assert.equal(hub.eventCount, 2);
  });

  it('evicts oldest events when buffer exceeds max (FIFO)', () => {
    for (let i = 0; i < 7; i++) hub.broadcast(`line${i}`);
    assert.equal(hub.eventCount, 5);
    assert.equal(hub.buffer[0], 'line2');
    assert.equal(hub.buffer[4], 'line6');
  });

  it('replays buffer to new client', () => {
    hub.broadcast('a');
    hub.broadcast('b');
    const received = [];
    const fakeRes = { write: (data) => received.push(data) };
    hub.replayTo(fakeRes);
    assert.equal(received.length, 3); // 2 data + 1 replay-end
    assert.ok(received[0].includes('a'));
    assert.ok(received[1].includes('b'));
    assert.ok(received[2].includes('replay-end'));
  });

  it('removes disconnected client', () => {
    const fakeRes = { write: () => {} };
    hub.addClient(fakeRes);
    assert.equal(hub.clientCount, 1);
    hub.removeClient(fakeRes);
    assert.equal(hub.clientCount, 0);
  });

  it('handles write errors gracefully', () => {
    const badRes = { write: () => { throw new Error('broken pipe'); } };
    hub.addClient(badRes);
    hub.broadcast('test');
    assert.equal(hub.clientCount, 0); // removed after error
  });

  it('reset clears buffer', () => {
    hub.broadcast('a');
    hub.broadcast('b');
    hub.reset();
    assert.equal(hub.eventCount, 0);
  });
});
