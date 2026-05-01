import { appendFileSync, statSync, renameSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const DEFAULT_RING_SIZE = 1000;
const FLUSH_INTERVAL_MS = 1000;
const FLUSH_BATCH_SIZE = 10;
const DEFAULT_MAX_SIZE_MB = 10;

export class AuditLogger {
  /** @param {string} dataDir */
  constructor(dataDir) {
    this._filePath = join(dataDir, 'audit.jsonl');
    this._maxBytes = (parseInt(process.env.AUDIT_MAX_SIZE_MB, 10) || DEFAULT_MAX_SIZE_MB) * 1024 * 1024;
    this._ringSize = DEFAULT_RING_SIZE;

    this._ring = [];
    this._writeQueue = [];
    this._flushTimer = null;

    this._hydrate();
    this._flushTimer = setInterval(() => this._flush(), FLUSH_INTERVAL_MS);
  }

  /**
   * Fire-and-forget: pushes to ring buffer + write queue.
   * Never throws, never blocks.
   */
  log(event, actor, detail, meta = {}) {
    const entry = { ts: new Date().toISOString(), event, actor, detail, meta };
    this._ring.push(entry);
    if (this._ring.length > this._ringSize) this._ring.shift();
    this._writeQueue.push(entry);
    if (this._writeQueue.length >= FLUSH_BATCH_SIZE) this._flush();
  }

  /**
   * Query the in-memory ring buffer — no file I/O.
   * @param {{ event?: string, from?: string, to?: string, limit?: number, offset?: number }} filters
   */
  query(filters = {}) {
    const { event, from, to, limit = 50, offset = 0 } = filters;
    let results = [...this._ring].reverse();

    if (event) results = results.filter(e => e.event === event);
    if (from) results = results.filter(e => e.ts >= from);
    if (to) results = results.filter(e => e.ts <= to);

    const total = results.length;
    const page = results.slice(offset, offset + limit);
    return { events: page, total, hasMore: offset + limit < total };
  }

  destroy() {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
    this._flush();
  }

  _hydrate() {
    try {
      if (!existsSync(this._filePath)) return;
      const content = readFileSync(this._filePath, 'utf8').trim();
      if (!content) return;
      const lines = content.split('\n');
      const start = Math.max(0, lines.length - this._ringSize);
      for (let i = start; i < lines.length; i++) {
        try { this._ring.push(JSON.parse(lines[i])); } catch { /* skip malformed */ }
      }
    } catch { /* file unreadable — start fresh */ }
  }

  /**
   * Appends queued events to disk synchronously.
   * Audit events are low-frequency (a few per minute at most), so the
   * sub-millisecond appendFileSync cost is negligible vs the complexity
   * of managing an async WriteStream lifecycle.
   */
  _flush() {
    if (this._writeQueue.length === 0) return;
    this._maybeRotate();
    const batch = this._writeQueue.splice(0);
    const payload = batch.map(e => JSON.stringify(e)).join('\n') + '\n';
    try {
      appendFileSync(this._filePath, payload);
    } catch (err) {
      console.error('[audit] Write error:', err.message);
    }
  }

  _maybeRotate() {
    try {
      if (!existsSync(this._filePath)) return;
      const size = statSync(this._filePath).size;
      if (size < this._maxBytes) return;
      const backup = this._filePath + '.1';
      renameSync(this._filePath, backup);
      console.log(`[audit] Rotated ${this._filePath} (${(size / 1024 / 1024).toFixed(1)}MB)`);
    } catch (err) {
      console.error('[audit] Rotation error:', err.message);
    }
  }
}
