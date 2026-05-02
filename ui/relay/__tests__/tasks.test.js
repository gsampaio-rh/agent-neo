import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startTaskWatcher } from '../sources/tasks.js';
import { handleListTasks, handleGetTask } from '../api/tasks.js';

function fakeHub() {
  const events = [];
  return { broadcast(line) { events.push(line); }, events };
}

function fakeRes() {
  let status, body;
  return {
    writeHead(s) { status = s; },
    end(b) { body = b; },
    get status() { return status; },
    get body() { return JSON.parse(body); },
  };
}

describe('TaskWatcher', () => {
  let dir;
  let hub;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tasks-test-'));
    hub = fakeHub();
  });

  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('reads task JSON files from directory', () => {
    const listDir = join(dir, 'tasks', 'my-list');
    mkdirSync(listDir, { recursive: true });
    writeFileSync(join(listDir, '1.json'), JSON.stringify({ id: '1', subject: 'Task one', status: 'completed', blocks: [], blockedBy: [] }));
    writeFileSync(join(listDir, '2.json'), JSON.stringify({ id: '2', subject: 'Task two', status: 'in_progress', blocks: [], blockedBy: [] }));

    const watcher = startTaskWatcher(hub, dir, 'my-list');
    const { tasks, listId } = watcher.getTasks();
    watcher.stop();

    assert.equal(listId, 'my-list');
    assert.equal(tasks.length, 2);
    assert.equal(tasks[0].id, '1');
    assert.equal(tasks[1].id, '2');
  });

  it('returns empty array when tasks/ directory does not exist', () => {
    const watcher = startTaskWatcher(hub, dir, '');
    const { tasks } = watcher.getTasks();
    watcher.stop();
    assert.deepEqual(tasks, []);
  });

  it('returns empty array when tasks/ has no subdirectories', () => {
    mkdirSync(join(dir, 'tasks'));
    const watcher = startTaskWatcher(hub, dir, '');
    const { tasks } = watcher.getTasks();
    watcher.stop();
    assert.deepEqual(tasks, []);
  });

  it('finds active list by most-recent mtime when no taskListId configured', () => {
    const list1 = join(dir, 'tasks', 'old-list');
    const list2 = join(dir, 'tasks', 'new-list');
    mkdirSync(list1, { recursive: true });
    mkdirSync(list2, { recursive: true });
    writeFileSync(join(list1, '1.json'), JSON.stringify({ id: '1', subject: 'old', status: 'pending', blocks: [], blockedBy: [] }));
    writeFileSync(join(list2, '1.json'), JSON.stringify({ id: '1', subject: 'new', status: 'pending', blocks: [], blockedBy: [] }));

    const watcher = startTaskWatcher(hub, dir, '');
    const { tasks } = watcher.getTasks();
    watcher.stop();
    assert.equal(tasks.length, 1);
  });

  it('uses explicit taskListId when configured', () => {
    const list1 = join(dir, 'tasks', 'explicit');
    const list2 = join(dir, 'tasks', 'other');
    mkdirSync(list1, { recursive: true });
    mkdirSync(list2, { recursive: true });
    writeFileSync(join(list1, '1.json'), JSON.stringify({ id: '1', subject: 'explicit task', status: 'pending', blocks: [], blockedBy: [] }));
    writeFileSync(join(list2, '1.json'), JSON.stringify({ id: '1', subject: 'other task', status: 'pending', blocks: [], blockedBy: [] }));

    const watcher = startTaskWatcher(hub, dir, 'explicit');
    const { tasks, listId } = watcher.getTasks();
    watcher.stop();
    assert.equal(listId, 'explicit');
    assert.equal(tasks[0].subject, 'explicit task');
  });

  it('getTask(id) returns single task object', () => {
    const listDir = join(dir, 'tasks', 'test');
    mkdirSync(listDir, { recursive: true });
    writeFileSync(join(listDir, '1.json'), JSON.stringify({ id: '1', subject: 'first', status: 'pending', blocks: [], blockedBy: [] }));
    writeFileSync(join(listDir, '2.json'), JSON.stringify({ id: '2', subject: 'second', status: 'pending', blocks: [], blockedBy: [] }));

    const watcher = startTaskWatcher(hub, dir, 'test');
    const task = watcher.getTask('2');
    watcher.stop();
    assert.equal(task.subject, 'second');
  });

  it('getTask(id) returns null for non-existent task', () => {
    const listDir = join(dir, 'tasks', 'test');
    mkdirSync(listDir, { recursive: true });
    writeFileSync(join(listDir, '1.json'), JSON.stringify({ id: '1', subject: 'first', status: 'pending', blocks: [], blockedBy: [] }));

    const watcher = startTaskWatcher(hub, dir, 'test');
    const task = watcher.getTask('99');
    watcher.stop();
    assert.equal(task, null);
  });

  it('handles malformed JSON files gracefully', () => {
    const listDir = join(dir, 'tasks', 'test');
    mkdirSync(listDir, { recursive: true });
    writeFileSync(join(listDir, '1.json'), '{ broken json');
    writeFileSync(join(listDir, '2.json'), JSON.stringify({ id: '2', subject: 'valid', status: 'pending', blocks: [], blockedBy: [] }));

    const watcher = startTaskWatcher(hub, dir, 'test');
    const { tasks } = watcher.getTasks();
    watcher.stop();
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].id, '2');
  });
});

describe('tasks REST API', () => {
  let dir;
  let hub;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tasks-api-'));
    hub = fakeHub();
  });

  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('handleListTasks returns { tasks, listId }', () => {
    const listDir = join(dir, 'tasks', 'my-list');
    mkdirSync(listDir, { recursive: true });
    writeFileSync(join(listDir, '1.json'), JSON.stringify({ id: '1', subject: 'A', status: 'pending', blocks: [], blockedBy: [] }));

    const watcher = startTaskWatcher(hub, dir, 'my-list');
    const res = fakeRes();
    handleListTasks({}, res, { taskWatcher: watcher });
    watcher.stop();

    assert.equal(res.status, 200);
    assert.equal(res.body.listId, 'my-list');
    assert.equal(res.body.tasks.length, 1);
  });

  it('handleGetTask returns task by id', () => {
    const listDir = join(dir, 'tasks', 'list');
    mkdirSync(listDir, { recursive: true });
    writeFileSync(join(listDir, '1.json'), JSON.stringify({ id: '1', subject: 'found', status: 'pending', blocks: [], blockedBy: [] }));

    const watcher = startTaskWatcher(hub, dir, 'list');
    const res = fakeRes();
    handleGetTask({ url: '/api/tasks/1' }, res, { taskWatcher: watcher });
    watcher.stop();

    assert.equal(res.status, 200);
    assert.equal(res.body.subject, 'found');
  });

  it('handleGetTask returns 404 for missing task', () => {
    const listDir = join(dir, 'tasks', 'list');
    mkdirSync(listDir, { recursive: true });

    const watcher = startTaskWatcher(hub, dir, 'list');
    const res = fakeRes();
    handleGetTask({ url: '/api/tasks/99' }, res, { taskWatcher: watcher });
    watcher.stop();

    assert.equal(res.status, 404);
  });
});
