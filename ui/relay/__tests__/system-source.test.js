import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startSystemLogStream } from '../sources/system.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

describe('startSystemLogStream', () => {
  let dir, broadcasted, handle;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sys-source-'));
    broadcasted = [];
  });

  afterEach(() => {
    if (handle) handle.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads existing lines on startup', async () => {
    writeFileSync(join(dir, 'system.log'), '[net-monitor] started\n[prompt-watcher] ready\n');
    const hub = { broadcast: (line) => broadcasted.push(line) };
    handle = startSystemLogStream(hub, dir);

    assert.equal(broadcasted.length, 2);
    const e1 = JSON.parse(broadcasted[0]);
    assert.equal(e1.type, 'system');
    assert.equal(e1.message, '[net-monitor] started');
  });

  it('tails new lines via polling', async () => {
    writeFileSync(join(dir, 'system.log'), '');
    const hub = { broadcast: (line) => broadcasted.push(line) };
    handle = startSystemLogStream(hub, dir);

    assert.equal(broadcasted.length, 0);

    appendFileSync(join(dir, 'system.log'), '[state] phase changed\n');
    await sleep(1500);

    assert.ok(broadcasted.length >= 1, `expected >=1 broadcast, got ${broadcasted.length}`);
    const parsed = JSON.parse(broadcasted[0]);
    assert.equal(parsed.message, '[state] phase changed');
  });

  it('skips empty lines', () => {
    writeFileSync(join(dir, 'system.log'), 'line1\n\n\nline2\n');
    const hub = { broadcast: (line) => broadcasted.push(line) };
    handle = startSystemLogStream(hub, dir);

    assert.equal(broadcasted.length, 2);
  });

  it('skips JSONL lines (handled by dir.js from claude.jsonl)', () => {
    writeFileSync(join(dir, 'system.log'),
      '[net-monitor] started\n' +
      '{"type":"system","subtype":"init","model":"glm47-flash","tools":["Bash","Read"]}\n' +
      '{"type":"result","duration_ms":5000,"num_turns":3,"total_cost_usd":0.25}\n' +
      '[prompt-watcher] done\n'
    );
    const hub = { broadcast: (line) => broadcasted.push(line) };
    handle = startSystemLogStream(hub, dir);

    assert.equal(broadcasted.length, 2);

    const e1 = JSON.parse(broadcasted[0]);
    assert.equal(e1.message, '[net-monitor] started');

    const e2 = JSON.parse(broadcasted[1]);
    assert.equal(e2.message, '[prompt-watcher] done');
  });

  it('does nothing when system.log does not exist', () => {
    const hub = { broadcast: (line) => broadcasted.push(line) };
    handle = startSystemLogStream(hub, dir);
    assert.equal(broadcasted.length, 0);
  });
});
