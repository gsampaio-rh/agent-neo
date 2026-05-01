import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { AuditLogger } from '../audit/logger.js';

describe('AuditLogger', () => {
  let dir;
  let logger;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'audit-test-'));
    logger = new AuditLogger(dir);
  });

  afterEach(() => {
    logger.destroy();
    rmSync(dir, { recursive: true, force: true });
  });

  it('logs events to the ring buffer', () => {
    logger.log('prompt_sent', 'user', 'Test prompt', { promptLength: 10 });
    const result = logger.query();
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].event, 'prompt_sent');
    assert.equal(result.events[0].actor, 'user');
    assert.equal(result.events[0].detail, 'Test prompt');
  });

  it('returns events in reverse chronological order', () => {
    logger.log('prompt_sent', 'user', 'First');
    logger.log('agent_stop', 'user', 'Second');
    const result = logger.query();
    assert.equal(result.events[0].detail, 'Second');
    assert.equal(result.events[1].detail, 'First');
  });

  it('filters by event type', () => {
    logger.log('prompt_sent', 'user', 'A');
    logger.log('error', 'system', 'B');
    logger.log('prompt_sent', 'user', 'C');
    const result = logger.query({ event: 'prompt_sent' });
    assert.equal(result.total, 2);
    assert.ok(result.events.every(e => e.event === 'prompt_sent'));
  });

  it('supports pagination', () => {
    for (let i = 0; i < 10; i++) {
      logger.log('prompt_sent', 'user', `Event ${i}`);
    }
    const page1 = logger.query({ limit: 3, offset: 0 });
    assert.equal(page1.events.length, 3);
    assert.equal(page1.total, 10);
    assert.equal(page1.hasMore, true);

    const page2 = logger.query({ limit: 3, offset: 9 });
    assert.equal(page2.events.length, 1);
    assert.equal(page2.hasMore, false);
  });

  it('caps ring buffer size', () => {
    for (let i = 0; i < 1100; i++) {
      logger.log('prompt_sent', 'user', `Event ${i}`);
    }
    const result = logger.query({ limit: 2000 });
    assert.equal(result.total, 1000);
  });

  it('writes events to JSONL file on flush', async () => {
    logger.log('prompt_sent', 'user', 'Flush test');
    logger.destroy();

    const filePath = join(dir, 'audit.jsonl');
    assert.ok(existsSync(filePath));
    const content = readFileSync(filePath, 'utf8').trim();
    const parsed = JSON.parse(content);
    assert.equal(parsed.event, 'prompt_sent');
    assert.equal(parsed.detail, 'Flush test');
  });

  it('hydrates ring buffer from existing file on startup', () => {
    logger.log('prompt_sent', 'user', 'Persisted event');
    logger.destroy();

    const logger2 = new AuditLogger(dir);
    const result = logger2.query();
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].detail, 'Persisted event');
    logger2.destroy();
  });
});
