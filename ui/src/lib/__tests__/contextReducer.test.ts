import { describe, it, expect } from 'vitest';
import { updateContext, INITIAL_CONTEXT, addFile, addDir, extractIpsFromText, extractHostsFromText } from '../contextReducer';
import type { EscapeEvent } from '../eventParser';

function makeEvent(overrides: Partial<EscapeEvent>): EscapeEvent {
  return { type: 'unknown', timestamp: new Date().toISOString(), raw: {}, ...overrides };
}

describe('addFile', () => {
  it('adds a new file entry', () => {
    const result = addFile([], '/tmp/test.py', 'write');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ path: '/tmp/test.py', op: 'write' });
  });

  it('deduplicates same path + op', () => {
    const files = [{ path: '/tmp/test.py', op: 'write' as const }];
    const result = addFile(files, '/tmp/test.py', 'write');
    expect(result).toHaveLength(1);
  });

  it('allows same path with different op', () => {
    const files = [{ path: '/tmp/test.py', op: 'write' as const }];
    const result = addFile(files, '/tmp/test.py', 'read');
    expect(result).toHaveLength(2);
  });
});

describe('addDir', () => {
  it('adds a new directory', () => {
    expect(addDir([], '/tmp')).toEqual(['/tmp']);
  });

  it('deduplicates', () => {
    expect(addDir(['/tmp'], '/tmp')).toEqual(['/tmp']);
  });
});

describe('extractIpsFromText', () => {
  it('extracts non-local IPs', () => {
    expect(extractIpsFromText('Connected to 10.0.0.5 on port 80')).toEqual(['10.0.0.5']);
  });

  it('ignores localhost IPs', () => {
    expect(extractIpsFromText('127.0.0.1 localhost')).toEqual([]);
  });

  it('deduplicates', () => {
    expect(extractIpsFromText('10.0.0.1 and 10.0.0.1 again')).toEqual(['10.0.0.1']);
  });
});

describe('extractHostsFromText', () => {
  it('extracts FQDNs', () => {
    const hosts = extractHostsFromText('curl http://api.example.com/data');
    expect(hosts).toContain('api.example.com');
  });

  it('extracts .svc cluster-internal hosts', () => {
    const hosts = extractHostsFromText('collector.monitoring-system.svc');
    expect(hosts).toContain('collector.monitoring-system.svc');
  });
});

describe('updateContext', () => {
  it('tracks cd command', () => {
    const event = makeEvent({
      type: 'tool_call',
      toolCall: { id: '1', name: 'Bash', input: { command: 'cd /tmp' } },
    });
    const ctx = updateContext({ ...INITIAL_CONTEXT }, event);
    expect(ctx.cwd).toBe('/tmp');
    expect(ctx.dirsVisited).toContain('/tmp');
  });

  it('tracks cat command as file read', () => {
    const event = makeEvent({
      type: 'tool_call',
      toolCall: { id: '1', name: 'Bash', input: { command: 'cat /etc/resolv.conf' } },
    });
    const ctx = updateContext({ ...INITIAL_CONTEXT }, event);
    expect(ctx.files).toContainEqual({ path: '/etc/resolv.conf', op: 'read' });
  });

  it('tracks Write tool call', () => {
    const event = makeEvent({
      type: 'tool_call',
      toolCall: { id: '1', name: 'Write', input: { filePath: '/tmp/exploit.py' } },
    });
    const ctx = updateContext({ ...INITIAL_CONTEXT }, event);
    expect(ctx.files).toContainEqual({ path: '/tmp/exploit.py', op: 'write' });
    expect(ctx.dirsVisited).toContain('/tmp');
  });

  it('tracks gcc output and input', () => {
    const event = makeEvent({
      type: 'tool_call',
      toolCall: { id: '1', name: 'Bash', input: { command: 'gcc exploit.c -o /tmp/exploit' } },
    });
    const ctx = updateContext({ ...INITIAL_CONTEXT }, event);
    expect(ctx.files).toContainEqual({ path: '/tmp/exploit', op: 'write' });
    expect(ctx.files).toContainEqual({ path: 'exploit.c', op: 'read' });
  });

  it('tracks curl as network find', () => {
    const event = makeEvent({
      type: 'tool_call',
      toolCall: { id: '1', name: 'Bash', input: { command: 'curl http://api.cluster.svc:8080/data' } },
    });
    const ctx = updateContext({ ...INITIAL_CONTEXT }, event);
    expect(ctx.networkFinds).toContain('api.cluster.svc');
  });

  it('extracts IPs from tool result', () => {
    const event = makeEvent({
      type: 'tool_result',
      toolResult: { toolUseId: '1', content: 'Server at 10.128.0.5 responded', isError: false },
    });
    const ctx = updateContext({ ...INITIAL_CONTEXT }, event);
    expect(ctx.networkFinds).toContain('10.128.0.5');
  });
});
