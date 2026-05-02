import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createPlanReader } from '../sources/plans.js';
import { handleListPlans, handleGetPlan } from '../api/plans.js';

function fakeRes() {
  let status, body;
  return {
    writeHead(s) { status = s; },
    end(b) { body = b; },
    get status() { return status; },
    get body() { return JSON.parse(body); },
  };
}

describe('PlanReader', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'plans-test-'));
  });

  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('lists .md files with title extracted from # Plan: header', () => {
    const plansDir = join(dir, 'plans');
    mkdirSync(plansDir);
    writeFileSync(join(plansDir, 'my-plan.md'), '# Plan: My Strategy\n\nContent here.');

    const reader = createPlanReader(dir);
    const plans = reader.getPlans();

    assert.equal(plans.length, 1);
    assert.equal(plans[0].filename, 'my-plan.md');
    assert.equal(plans[0].title, 'My Strategy');
  });

  it('returns empty array when plans/ does not exist', () => {
    const reader = createPlanReader(dir);
    assert.deepEqual(reader.getPlans(), []);
  });

  it('sorts plans by mtime (most recent first)', () => {
    const plansDir = join(dir, 'plans');
    mkdirSync(plansDir);
    writeFileSync(join(plansDir, 'old.md'), '# Plan: Old\n');
    // Delay slightly to ensure different mtime
    writeFileSync(join(plansDir, 'new.md'), '# Plan: New\n');

    const reader = createPlanReader(dir);
    const plans = reader.getPlans();
    assert.equal(plans.length, 2);
    assert.equal(plans[0].filename, 'new.md');
  });

  it('getPlan(filename) returns full content', () => {
    const plansDir = join(dir, 'plans');
    mkdirSync(plansDir);
    const content = '# Plan: Test\n\nSome detailed content.';
    writeFileSync(join(plansDir, 'test.md'), content);

    const reader = createPlanReader(dir);
    const plan = reader.getPlan('test.md');

    assert.equal(plan.filename, 'test.md');
    assert.equal(plan.title, 'Test');
    assert.equal(plan.content, content);
  });

  it('getPlan(filename) returns null for missing file', () => {
    mkdirSync(join(dir, 'plans'));
    const reader = createPlanReader(dir);
    assert.equal(reader.getPlan('nope.md'), null);
  });

  it('handles files without # Plan: header (uses filename as title)', () => {
    const plansDir = join(dir, 'plans');
    mkdirSync(plansDir);
    writeFileSync(join(plansDir, 'no-header.md'), 'Just content without a plan header.');

    const reader = createPlanReader(dir);
    const plans = reader.getPlans();
    assert.equal(plans[0].title, 'no-header');
  });

  it('rejects path traversal in getPlan', () => {
    mkdirSync(join(dir, 'plans'));
    const reader = createPlanReader(dir);
    assert.equal(reader.getPlan('../etc/passwd'), null);
    assert.equal(reader.getPlan('sub/dir.md'), null);
  });
});

describe('plans REST API', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'plans-api-'));
    mkdirSync(join(dir, 'plans'));
  });

  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('handleListPlans returns plan summaries', () => {
    writeFileSync(join(dir, 'plans', 'a.md'), '# Plan: Alpha\nContent.');

    const reader = createPlanReader(dir);
    const res = fakeRes();
    handleListPlans({}, res, { planReader: reader });

    assert.equal(res.status, 200);
    assert.equal(res.body.plans.length, 1);
    assert.equal(res.body.plans[0].title, 'Alpha');
  });

  it('handleGetPlan returns full plan content', () => {
    writeFileSync(join(dir, 'plans', 'b.md'), '# Plan: Beta\nDetails.');

    const reader = createPlanReader(dir);
    const res = fakeRes();
    handleGetPlan({ url: '/api/plans/b.md' }, res, { planReader: reader });

    assert.equal(res.status, 200);
    assert.equal(res.body.title, 'Beta');
    assert.equal(res.body.content, '# Plan: Beta\nDetails.');
  });

  it('handleGetPlan returns 404 for missing file', () => {
    const reader = createPlanReader(dir);
    const res = fakeRes();
    handleGetPlan({ url: '/api/plans/nope.md' }, res, { planReader: reader });

    assert.equal(res.status, 404);
  });
});
