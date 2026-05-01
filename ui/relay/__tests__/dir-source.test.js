import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startDirStream } from '../sources/dir.js';

describe('startDirStream', () => {
  let dir, hub, broadcasts;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'dir-source-test-'));
    broadcasts = [];
    hub = { broadcast: (line) => broadcasts.push(line) };
  });

  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('reads existing lines on start', () => {
    writeFileSync(join(dir, 'claude.jsonl'), '{"type":"a"}\n{"type":"b"}\n');
    const { stop } = startDirStream(hub, dir);
    stop();
    assert.equal(broadcasts.length, 2);
    assert.equal(broadcasts[0], '{"type":"a"}');
    assert.equal(broadcasts[1], '{"type":"b"}');
  });

  it('ignores empty file', () => {
    writeFileSync(join(dir, 'claude.jsonl'), '');
    const { stop } = startDirStream(hub, dir);
    stop();
    assert.equal(broadcasts.length, 0);
  });

  it('handles missing jsonl file gracefully', () => {
    const { stop } = startDirStream(hub, dir);
    stop();
    assert.equal(broadcasts.length, 0);
  });

  it('detects new lines after start via poll', async () => {
    writeFileSync(join(dir, 'claude.jsonl'), '');
    const { stop } = startDirStream(hub, dir);

    writeFileSync(join(dir, 'claude.jsonl'), '{"type":"new"}\n');
    await new Promise(r => setTimeout(r, 600));

    stop();
    assert.ok(broadcasts.some(b => b === '{"type":"new"}'));
  });

  it('returns stop function that cleans up', () => {
    writeFileSync(join(dir, 'claude.jsonl'), '');
    const result = startDirStream(hub, dir);
    assert.equal(typeof result.stop, 'function');
    result.stop();
  });

  it('handles file truncation', () => {
    writeFileSync(join(dir, 'claude.jsonl'), '{"line1":"x"}\n{"line2":"y"}\n');
    const { stop } = startDirStream(hub, dir);
    assert.equal(broadcasts.length, 2);

    writeFileSync(join(dir, 'claude.jsonl'), '{"new":"data"}\n');
    stop();
  });
});
