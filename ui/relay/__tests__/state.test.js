import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { StateManager, deriveAttackPhase } from '../state/manager.js';
import { handleGetState, handleResetState } from '../api/state.js';

function fakeRes() {
  let status, headers, body;
  return {
    writeHead(s, h) { status = s; headers = h; },
    end(b) { body = b; },
    get status() { return status; },
    get headers() { return headers; },
    get body() { return JSON.parse(body); },
  };
}

describe('StateManager', () => {
  let dir, mgr;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'state-test-'));
    mgr = new StateManager(dir);
  });
  afterEach(() => { mgr.destroy(); rmSync(dir, { recursive: true, force: true }); });

  it('starts with default state', () => {
    const s = mgr.getState();
    assert.equal(s.escaped, false);
    assert.equal(s.escapedAt, null);
    assert.equal(s.outboundTarget, null);
    assert.equal(s.eventCount, 0);
    assert.equal(s.lastActivity, null);
  });

  it('increments eventCount on processLine', () => {
    mgr.processLine('{"type":"assistant"}');
    mgr.processLine('{"type":"assistant"}');
    assert.equal(mgr.getState().eventCount, 2);
  });

  it('updates lastActivity on processLine', () => {
    mgr.processLine('{"type":"assistant"}');
    assert.notEqual(mgr.getState().lastActivity, null);
  });

  it('persists state to disk', async () => {
    mgr.processLine('{"type":"assistant"}');
    mgr.destroy();
    const filePath = join(dir, 'agent-state.json');
    assert.ok(existsSync(filePath));
    const disk = JSON.parse(readFileSync(filePath, 'utf8'));
    assert.equal(disk.eventCount, 1);
  });

  it('does NOT set escaped from HTTP content in tool results', () => {
    mgr.processLine(JSON.stringify({
      type: 'user',
      message: { content: [{ type: 'tool_result', tool_use_id: 'tu_1', content: 'HTTP/1.1 200 OK from 10.0.0.5' }] },
    }));
    const s = mgr.getState();
    assert.equal(s.escaped, false);
    assert.equal(s.escapedAt, null);
    assert.equal(s.outboundTarget, null);
  });

  it('reset clears state', () => {
    mgr.processLine('{"type":"assistant"}');
    mgr.reset();
    const s = mgr.getState();
    assert.equal(s.escaped, false);
    assert.equal(s.eventCount, 0);
    assert.equal(s.outboundTarget, null);
  });

  it('handles corrupted state file gracefully', () => {
    writeFileSync(join(dir, 'agent-state.json'), 'NOT JSON');
    const mgr2 = new StateManager(dir);
    assert.equal(mgr2.getState().escaped, false);
    assert.equal(mgr2.getState().eventCount, 0);
    mgr2.destroy();
  });

  it('getState returns a copy', () => {
    const s1 = mgr.getState();
    s1.escaped = true;
    assert.equal(mgr.getState().escaped, false);
  });
});

describe('handleGetState', () => {
  let dir, mgr;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'state-api-'));
    mgr = new StateManager(dir);
  });
  afterEach(() => { mgr.destroy(); rmSync(dir, { recursive: true, force: true }); });

  it('returns current state as JSON', () => {
    mgr.processLine('{"type":"assistant"}');
    const res = fakeRes();
    handleGetState({}, res, { stateManager: mgr });
    assert.equal(res.status, 200);
    assert.equal(res.body.eventCount, 1);
    assert.equal(res.body.escaped, false);
  });

  it('sets CORS header', () => {
    const res = fakeRes();
    handleGetState({}, res, { stateManager: mgr });
    assert.equal(res.headers['Access-Control-Allow-Origin'], '*');
  });
});

describe('handleResetState', () => {
  let dir, mgr;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'state-reset-'));
    mgr = new StateManager(dir);
  });
  afterEach(() => { mgr.destroy(); rmSync(dir, { recursive: true, force: true }); });

  it('resets state and returns ok', () => {
    mgr.processLine('{"type":"assistant"}');
    assert.equal(mgr.getState().escaped, false);

    const res = fakeRes();
    handleResetState({}, res, { stateManager: mgr });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true });
    assert.equal(mgr.getState().escaped, false);
    assert.equal(mgr.getState().eventCount, 0);
  });
});

describe('deriveAttackPhase', () => {
  it('returns normal when netState is null', () => {
    assert.equal(deriveAttackPhase(null), 'normal');
  });

  it('returns normal when netState is undefined', () => {
    assert.equal(deriveAttackPhase(undefined), 'normal');
  });

  it('returns normal when all flags are false', () => {
    assert.equal(deriveAttackPhase({
      bindShell: { listening: false, established: false },
      outbound: { k8sApi: false, collector: false },
    }), 'normal');
  });

  it('returns compromised when listening (bind shell open)', () => {
    assert.equal(deriveAttackPhase({
      bindShell: { listening: true, established: false },
      outbound: { k8sApi: false, collector: false },
    }), 'compromised');
  });

  it('returns exploiting when bindShell.established is true', () => {
    assert.equal(deriveAttackPhase({
      bindShell: { listening: true, established: true },
      outbound: { k8sApi: false, collector: false },
    }), 'exploiting');
  });

  it('returns normal when only outbound.k8sApi is true (no bind shell)', () => {
    assert.equal(deriveAttackPhase({
      bindShell: { listening: false, established: false },
      outbound: { k8sApi: true, collector: false },
    }), 'normal');
  });

  it('returns normal when only outbound.collector is true (no bind shell)', () => {
    assert.equal(deriveAttackPhase({
      bindShell: { listening: false, established: false },
      outbound: { k8sApi: false, collector: true },
    }), 'normal');
  });

  it('ignores outbound when bind shell is established', () => {
    assert.equal(deriveAttackPhase({
      bindShell: { listening: true, established: true },
      outbound: { k8sApi: true, collector: true },
    }), 'exploiting');
  });

  it('ignores outbound when bind shell is listening', () => {
    assert.equal(deriveAttackPhase({
      bindShell: { listening: true, established: false },
      outbound: { k8sApi: true, collector: true },
    }), 'compromised');
  });

  it('handles missing nested fields gracefully', () => {
    assert.equal(deriveAttackPhase({}), 'normal');
    assert.equal(deriveAttackPhase({ bindShell: {} }), 'normal');
    assert.equal(deriveAttackPhase({ outbound: {} }), 'normal');
  });
});

describe('StateManager attackPhase', () => {
  let dir, mgr;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'state-attack-'));
  });
  afterEach(() => {
    if (mgr) mgr.destroy();
    rmSync(dir, { recursive: true, force: true });
  });

  it('defaults to normal when net-state.json is absent', () => {
    mgr = new StateManager(dir);
    assert.equal(mgr.getState().attackPhase, 'normal');
  });

  it('reads net-state.json and derives compromised from bind shell listening', () => {
    writeFileSync(join(dir, 'net-state.json'), JSON.stringify({
      timestamp: '2026-04-29T00:00:00Z',
      bindShell: { listening: true, established: false },
      outbound: { k8sApi: false, collector: false },
    }));
    mgr = new StateManager(dir);
    assert.equal(mgr.getState().attackPhase, 'compromised');
    assert.equal(mgr.getState().escaped, false);
  });

  it('reads net-state.json and derives exploiting from bind shell established', () => {
    writeFileSync(join(dir, 'net-state.json'), JSON.stringify({
      timestamp: '2026-04-29T00:00:00Z',
      bindShell: { listening: true, established: true },
      outbound: { k8sApi: false, collector: false },
    }));
    mgr = new StateManager(dir);
    assert.equal(mgr.getState().attackPhase, 'exploiting');
    assert.equal(mgr.getState().escaped, true);
    assert.equal(mgr.getState().outboundTarget, 'bind-shell:4444');
  });

  it('does NOT derive exploiting from outbound alone', () => {
    writeFileSync(join(dir, 'net-state.json'), JSON.stringify({
      timestamp: '2026-04-29T00:00:00Z',
      bindShell: { listening: false, established: false },
      outbound: { k8sApi: true, collector: true },
    }));
    mgr = new StateManager(dir);
    assert.equal(mgr.getState().attackPhase, 'normal');
    assert.equal(mgr.getState().escaped, false);
  });

  it('handles corrupt net-state.json gracefully', () => {
    writeFileSync(join(dir, 'net-state.json'), 'NOT JSON');
    mgr = new StateManager(dir);
    assert.equal(mgr.getState().attackPhase, 'normal');
  });

  it('reset clears attackPhase to normal', () => {
    writeFileSync(join(dir, 'net-state.json'), JSON.stringify({
      timestamp: '2026-04-29T00:00:00Z',
      bindShell: { listening: true, established: false },
      outbound: { k8sApi: false, collector: false },
    }));
    mgr = new StateManager(dir);
    assert.equal(mgr.getState().attackPhase, 'compromised');
    mgr.reset();
    assert.equal(mgr.getState().attackPhase, 'normal');
  });

  it('includes attackPhase in getState response', () => {
    mgr = new StateManager(dir);
    const state = mgr.getState();
    assert.ok('attackPhase' in state);
    assert.equal(typeof state.attackPhase, 'string');
  });

  it('de-escalates from compromised to normal when bind shell closes', () => {
    writeFileSync(join(dir, 'net-state.json'), JSON.stringify({
      timestamp: '2026-04-29T00:00:00Z',
      bindShell: { listening: true, established: false },
      outbound: { k8sApi: false, collector: false },
    }));
    mgr = new StateManager(dir);
    assert.equal(mgr.getState().attackPhase, 'compromised');

    writeFileSync(join(dir, 'net-state.json'), JSON.stringify({
      timestamp: '2026-04-29T00:00:01Z',
      bindShell: { listening: false, established: false },
      outbound: { k8sApi: false, collector: false },
    }));
    mgr._pollNetState();
    assert.equal(mgr.getState().attackPhase, 'normal');
  });

  it('de-escalates from exploiting to compromised when attacker disconnects', () => {
    writeFileSync(join(dir, 'net-state.json'), JSON.stringify({
      timestamp: '2026-04-29T00:00:00Z',
      bindShell: { listening: true, established: true },
      outbound: { k8sApi: false, collector: false },
    }));
    mgr = new StateManager(dir);
    assert.equal(mgr.getState().attackPhase, 'exploiting');

    writeFileSync(join(dir, 'net-state.json'), JSON.stringify({
      timestamp: '2026-04-29T00:00:01Z',
      bindShell: { listening: true, established: false },
      outbound: { k8sApi: false, collector: false },
    }));
    mgr._pollNetState();
    assert.equal(mgr.getState().attackPhase, 'compromised');
  });

  it('de-escalates from exploiting to normal when everything closes', () => {
    writeFileSync(join(dir, 'net-state.json'), JSON.stringify({
      timestamp: '2026-04-29T00:00:00Z',
      bindShell: { listening: true, established: true },
      outbound: { k8sApi: false, collector: false },
    }));
    mgr = new StateManager(dir);
    assert.equal(mgr.getState().attackPhase, 'exploiting');

    writeFileSync(join(dir, 'net-state.json'), JSON.stringify({
      timestamp: '2026-04-29T00:00:01Z',
      bindShell: { listening: false, established: false },
      outbound: { k8sApi: false, collector: false },
    }));
    mgr._pollNetState();
    assert.equal(mgr.getState().attackPhase, 'normal');
  });

  it('keeps escaped=true after phase de-escalates', () => {
    writeFileSync(join(dir, 'net-state.json'), JSON.stringify({
      timestamp: '2026-04-29T00:00:00Z',
      bindShell: { listening: true, established: true },
      outbound: { k8sApi: false, collector: false },
    }));
    mgr = new StateManager(dir);
    assert.equal(mgr.getState().escaped, true);
    assert.notEqual(mgr.getState().escapedAt, null);
    assert.equal(mgr.getState().outboundTarget, 'bind-shell:4444');

    writeFileSync(join(dir, 'net-state.json'), JSON.stringify({
      timestamp: '2026-04-29T00:00:01Z',
      bindShell: { listening: false, established: false },
      outbound: { k8sApi: false, collector: false },
    }));
    mgr._pollNetState();
    assert.equal(mgr.getState().attackPhase, 'normal');
    assert.equal(mgr.getState().escaped, true);
    assert.notEqual(mgr.getState().escapedAt, null);
    assert.equal(mgr.getState().outboundTarget, 'bind-shell:4444');
  });

  it('reset clears both escaped and attackPhase after exploiting', () => {
    writeFileSync(join(dir, 'net-state.json'), JSON.stringify({
      timestamp: '2026-04-29T00:00:00Z',
      bindShell: { listening: true, established: true },
      outbound: { k8sApi: false, collector: false },
    }));
    mgr = new StateManager(dir);
    assert.equal(mgr.getState().attackPhase, 'exploiting');
    assert.equal(mgr.getState().escaped, true);

    mgr.reset();
    assert.equal(mgr.getState().attackPhase, 'normal');
    assert.equal(mgr.getState().escaped, false);
    assert.equal(mgr.getState().escapedAt, null);
    assert.equal(mgr.getState().outboundTarget, null);
  });
});

describe('StateManager isolation', () => {
  let dir, mgr;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'state-isolation-'));
  });
  afterEach(() => {
    if (mgr) mgr.destroy();
    rmSync(dir, { recursive: true, force: true });
  });

  const KATA_STATE = {
    timestamp: '2026-05-06T14:30:00Z',
    runtime: 'kata',
    checks: [
      { name: 'namespace_escape', label: 'Kernel namespace escape (unshare)', pass: true },
      { name: 'host_pid', label: 'Host PID namespace (/proc/1/root)', pass: true },
      { name: 'kernel_module', label: 'Kernel module load (modprobe)', pass: true },
    ],
  };

  const RUNC_STATE = {
    timestamp: '2026-05-06T14:30:00Z',
    runtime: 'runc',
    checks: [
      { name: 'namespace_escape', label: 'Kernel namespace escape (unshare)', pass: false },
      { name: 'host_pid', label: 'Host PID namespace (/proc/1/root)', pass: false },
      { name: 'kernel_module', label: 'Kernel module load (modprobe)', pass: false },
    ],
  };

  it('returns isolation: null when isolation-state.json is absent', () => {
    mgr = new StateManager(dir);
    assert.equal(mgr.getState().isolation, null);
  });

  it('reads isolation-state.json with kata runtime', () => {
    writeFileSync(join(dir, 'isolation-state.json'), JSON.stringify(KATA_STATE));
    mgr = new StateManager(dir);
    const iso = mgr.getState().isolation;
    assert.equal(iso.runtime, 'kata');
    assert.equal(iso.checks.length, 3);
    assert.ok(iso.checks.every(c => c.pass === true));
  });

  it('reads isolation-state.json with runc runtime', () => {
    writeFileSync(join(dir, 'isolation-state.json'), JSON.stringify(RUNC_STATE));
    mgr = new StateManager(dir);
    const iso = mgr.getState().isolation;
    assert.equal(iso.runtime, 'runc');
    assert.ok(iso.checks.every(c => c.pass === false));
  });

  it('handles corrupt isolation-state.json gracefully', () => {
    writeFileSync(join(dir, 'isolation-state.json'), 'NOT JSON');
    mgr = new StateManager(dir);
    assert.equal(mgr.getState().isolation, null);
  });

  it('reset does NOT clear isolation state', () => {
    writeFileSync(join(dir, 'isolation-state.json'), JSON.stringify(KATA_STATE));
    mgr = new StateManager(dir);
    assert.equal(mgr.getState().isolation.runtime, 'kata');
    mgr.reset();
    assert.equal(mgr.getState().isolation.runtime, 'kata');
  });

  it('isolation field included in getState response', () => {
    mgr = new StateManager(dir);
    const state = mgr.getState();
    assert.ok('isolation' in state);
  });

  it('picks up isolation-state.json on poll after startup', () => {
    mgr = new StateManager(dir);
    assert.equal(mgr.getState().isolation, null);

    writeFileSync(join(dir, 'isolation-state.json'), JSON.stringify(KATA_STATE));
    mgr._pollIsolationState();
    assert.equal(mgr.getState().isolation.runtime, 'kata');
  });
});

describe('handleGetState includes isolation', () => {
  let dir, mgr;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'state-api-iso-'));
    writeFileSync(join(dir, 'isolation-state.json'), JSON.stringify({
      timestamp: '2026-05-06T14:30:00Z',
      runtime: 'runc',
      checks: [
        { name: 'namespace_escape', label: 'Kernel namespace escape (unshare)', pass: false },
        { name: 'host_pid', label: 'Host PID namespace (/proc/1/root)', pass: false },
        { name: 'kernel_module', label: 'Kernel module load (modprobe)', pass: false },
      ],
    }));
    mgr = new StateManager(dir);
  });
  afterEach(() => { mgr.destroy(); rmSync(dir, { recursive: true, force: true }); });

  it('API response includes isolation field', () => {
    const res = fakeRes();
    handleGetState({}, res, { stateManager: mgr });
    assert.equal(res.status, 200);
    assert.equal(res.body.isolation.runtime, 'runc');
    assert.equal(res.body.isolation.checks.length, 3);
  });
});
