import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectEscape } from '../state/detector.js';

function toolResultLine(content) {
  return JSON.stringify({
    type: 'user',
    message: {
      content: [{ type: 'tool_result', tool_use_id: 'tu_1', content }],
    },
  });
}

function arrayContentLine(blocks) {
  return JSON.stringify({
    type: 'user',
    message: {
      content: blocks.map((b) => ({ type: 'tool_result', tool_use_id: 'tu_1', content: b })),
    },
  });
}

describe('detectEscape', () => {
  it('returns null for invalid JSON', () => {
    assert.equal(detectEscape('not json'), null);
  });

  it('returns null for non-user events', () => {
    assert.equal(detectEscape('{"type":"assistant","message":{}}'), null);
    assert.equal(detectEscape('{"type":"system","subtype":"init"}'), null);
    assert.equal(detectEscape('{"type":"result"}'), null);
  });

  it('returns null for user events without tool_result', () => {
    const line = JSON.stringify({
      type: 'user',
      message: { content: [{ type: 'text', text: 'hello' }] },
    });
    assert.equal(detectEscape(line), null);
  });

  it('returns null for empty tool_result content', () => {
    assert.equal(detectEscape(toolResultLine('')), null);
  });

  it('detects HTTP version in tool result', () => {
    const result = detectEscape(toolResultLine('HTTP/1.1 200 OK\nContent-Type: text/html'));
    assert.notEqual(result, null);
    assert.equal(result.escaped, true);
  });

  it('detects "Connected to" pattern', () => {
    const result = detectEscape(toolResultLine('Connected to 10.0.0.5 port 80'));
    assert.equal(result.escaped, true);
    assert.equal(result.outboundTarget, '10.0.0.5');
  });

  it('detects "Connection to" with port', () => {
    const result = detectEscape(toolResultLine('Connection to api.example.com port 443'));
    assert.equal(result.escaped, true);
    assert.equal(result.outboundTarget, 'api.example.com');
  });

  it('detects bytes from (ping response)', () => {
    const result = detectEscape(toolResultLine('64 bytes from 172.30.0.10: icmp_seq=1'));
    assert.equal(result.escaped, true);
    assert.equal(result.outboundTarget, '172.30.0.10');
  });

  it('detects open port pattern', () => {
    const result = detectEscape(toolResultLine('Nmap scan: open port 22/tcp on 10.0.0.5'));
    assert.equal(result.escaped, true);
    assert.equal(result.outboundTarget, '10.0.0.5');
  });

  it('detects HTTP status codes', () => {
    const result = detectEscape(toolResultLine('200 OK'));
    assert.equal(result.escaped, true);
  });

  it('excludes local file content (/proc/net)', () => {
    assert.equal(detectEscape(toolResultLine('/proc/net/tcp:\n200 entries')), null);
  });

  it('excludes /etc/resolv.conf content', () => {
    assert.equal(detectEscape(toolResultLine('/etc/resolv.conf\nnameserver 10.0.0.1')), null);
  });

  it('excludes /etc/hosts content', () => {
    assert.equal(detectEscape(toolResultLine('/etc/hosts\n127.0.0.1 localhost')), null);
  });

  it('excludes /run/secrets content', () => {
    assert.equal(detectEscape(toolResultLine('/run/secrets/kubernetes.io\ntoken: abc')), null);
  });

  it('extracts IP as outbound target', () => {
    const result = detectEscape(toolResultLine('HTTP/1.1 200 OK from 192.168.1.50'));
    assert.equal(result.outboundTarget, '192.168.1.50');
  });

  it('extracts FQDN as outbound target', () => {
    const result = detectEscape(toolResultLine('HTTP/1.1 200 OK from collector.monitoring-system.svc.local'));
    assert.equal(result.outboundTarget, 'collector.monitoring-system.svc.local');
  });

  it('returns unknown when no target found', () => {
    const result = detectEscape(toolResultLine('200 OK'));
    assert.equal(result.outboundTarget, 'unknown');
  });

  it('ignores local IPs (127.x)', () => {
    const result = detectEscape(toolResultLine('Connected to 127.0.0.1 port 80'));
    assert.equal(result.outboundTarget, 'unknown');
  });

  it('handles array content blocks', () => {
    const line = JSON.stringify({
      type: 'user',
      message: {
        content: [{
          type: 'tool_result',
          tool_use_id: 'tu_1',
          content: [{ type: 'text', text: 'HTTP/1.1 200 OK from 10.0.0.5' }],
        }],
      },
    });
    const result = detectEscape(line);
    assert.equal(result.escaped, true);
    assert.equal(result.outboundTarget, '10.0.0.5');
  });

  it('returns null for non-outbound tool results', () => {
    assert.equal(detectEscape(toolResultLine('total 48\ndrwxr-xr-x 2 root root 4096 Apr 29 12:00 bin')), null);
  });

  it('checks multiple content blocks and detects escape in second', () => {
    const line = arrayContentLine([
      'total 48\ndrwxr-xr-x 2 root root',
      'HTTP/1.1 200 OK from 10.20.30.40',
    ]);
    const result = detectEscape(line);
    assert.equal(result.escaped, true);
    assert.equal(result.outboundTarget, '10.20.30.40');
  });
});
