import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const DEFAULT_STATE = {
  escaped: false,
  escapedAt: null,
  outboundTarget: null,
  eventCount: 0,
  lastActivity: null,
};

const NET_STATE_POLL_MS = 2000;

/**
 * Derives the attack phase from network state.
 * Detection is 100% bind-shell-driven — outbound connections are irrelevant.
 *   established → attacker connected to bind shell → exploiting
 *   listening   → bind shell port open, no connection yet → compromised
 */
export function deriveAttackPhase(netState) {
  if (!netState) return 'normal';
  const { bindShell } = netState;
  if (bindShell?.established) return 'exploiting';
  if (bindShell?.listening) return 'compromised';
  return 'normal';
}

const PERSIST_DEBOUNCE_MS = 1000;

export class StateManager {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.filePath = join(dataDir, 'agent-state.json');
    this.netStatePath = join(dataDir, 'net-state.json');
    this.isolationStatePath = join(dataDir, 'isolation-state.json');
    this.state = this._load();
    this.attackPhase = 'normal';
    this.isolationState = null;
    this._persistTimer = null;
    this._persistDirty = false;

    this._pollNetState();
    this._pollIsolationState();
    this._netPollTimer = setInterval(() => {
      this._pollNetState();
      this._pollIsolationState();
    }, NET_STATE_POLL_MS);
  }

  _load() {
    try {
      if (existsSync(this.filePath)) {
        return { ...DEFAULT_STATE, ...JSON.parse(readFileSync(this.filePath, 'utf8')) };
      }
    } catch { /* corrupted file, start fresh */ }
    return { ...DEFAULT_STATE };
  }

  _persist() {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const tmp = this.filePath + '.tmp';
    writeFileSync(tmp, JSON.stringify(this.state, null, 2));
    renameSync(tmp, this.filePath);
  }

  _pollNetState() {
    try {
      if (!existsSync(this.netStatePath)) return;
      const raw = readFileSync(this.netStatePath, 'utf8');
      const netState = JSON.parse(raw);
      const detected = deriveAttackPhase(netState);

      if (detected !== this.attackPhase) {
        const prev = this.attackPhase;
        this.attackPhase = detected;
        console.log(`[state] attackPhase: ${prev} → ${this.attackPhase}`);
      }

      // escaped is sticky — once an attacker connected, this is a permanent record
      if (detected === 'exploiting' && !this.state.escaped) {
        this.state.escaped = true;
        this.state.escapedAt = new Date().toISOString();
        this.state.outboundTarget = 'bind-shell:4444';
        this._persist();
        console.log('[state] Escape detected → bind-shell:4444');
      }
    } catch { /* keep current phase on error */ }
  }

  _pollIsolationState() {
    try {
      if (!existsSync(this.isolationStatePath)) return;
      const raw = readFileSync(this.isolationStatePath, 'utf8');
      this.isolationState = JSON.parse(raw);
    } catch { /* keep current isolation on error */ }
  }

  _debouncedPersist() {
    this._persistDirty = true;
    if (this._persistTimer) return;
    this._persistTimer = setTimeout(() => {
      this._persistTimer = null;
      if (this._persistDirty) {
        this._persistDirty = false;
        this._persist();
      }
    }, PERSIST_DEBOUNCE_MS);
  }

  processLine(line) {
    this.state.eventCount++;
    this.state.lastActivity = new Date().toISOString();
    this._debouncedPersist();
  }

  getState() {
    return { ...this.state, attackPhase: this.attackPhase, isolation: this.isolationState };
  }

  reset() {
    this.state = { ...DEFAULT_STATE };
    this.attackPhase = 'normal';
    this._persist();
    console.log('[state] State reset');
  }

  destroy() {
    if (this._netPollTimer) {
      clearInterval(this._netPollTimer);
      this._netPollTimer = null;
    }
    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
      this._persistTimer = null;
    }
    if (this._persistDirty) {
      this._persistDirty = false;
      this._persist();
    }
  }
}
