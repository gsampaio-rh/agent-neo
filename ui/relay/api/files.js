import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve, dirname, sep } from 'path';

import { jsonResponse } from '../lib/response.js';

function safePath(base, userPath) {
  const absBase = resolve(base);
  const resolved = resolve(absBase, userPath);
  if (!resolved.startsWith(absBase + sep) && resolved !== absBase) return null;
  return resolved;
}

function buildTree(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push({ name: entry.name, type: 'dir', children: buildTree(fullPath) });
    } else {
      const st = statSync(fullPath);
      result.push({ name: entry.name, type: 'file', size: st.size });
    }
  }
  result.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'dir' ? -1 : 1;
  });
  return result;
}

export function handleListFiles(req, res, { config }) {
  const base = resolve(config.claudeWorkspaceDir);
  if (!base || !existsSync(base)) {
    return jsonResponse(res, 200, []);
  }
  try {
    const tree = buildTree(base);
    return jsonResponse(res, 200, tree);
  } catch (err) {
    return jsonResponse(res, 500, { error: err.message });
  }
}

export function handleReadFile(req, res, { config }) {
  const base = config.claudeWorkspaceDir;
  const filePath = decodeURIComponent(req.url.replace('/api/files/', ''));
  const resolved = safePath(base, filePath);
  if (!resolved) {
    return jsonResponse(res, 403, { error: 'Path traversal denied' });
  }
  if (!existsSync(resolved)) {
    return jsonResponse(res, 404, { error: 'File not found' });
  }
  try {
    const content = readFileSync(resolved, 'utf-8');
    return jsonResponse(res, 200, { path: filePath, content });
  } catch (err) {
    return jsonResponse(res, 500, { error: err.message });
  }
}

const MAX_BODY_SIZE = 64 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error('body too large'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

export function handleWriteFile(req, res, { config }) {
  const base = config.claudeWorkspaceDir;
  const filePath = decodeURIComponent(req.url.replace('/api/files/', ''));
  const resolved = safePath(base, filePath);
  if (!resolved) {
    return jsonResponse(res, 403, { error: 'Path traversal denied' });
  }

  (async () => {
    try {
      const raw = await readBody(req);
      const { content } = JSON.parse(raw);
      if (typeof content !== 'string') {
        return jsonResponse(res, 400, { error: 'content field required' });
      }
      const dir = dirname(resolved);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(resolved, content, 'utf-8');
      return jsonResponse(res, 200, { status: 'ok', path: filePath });
    } catch (err) {
      const status = err.message === 'body too large' ? 413 : 500;
      return jsonResponse(res, status, { error: err.message });
    }
  })();
}
