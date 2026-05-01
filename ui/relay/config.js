import { parseArgs } from 'util';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { values } = parseArgs({
  options: {
    namespace: { type: 'string', default: process.env.NAMESPACE || 'agent-namespace' },
    file: { type: 'string' },
    dir: { type: 'string', default: process.env.JSONL_DIR || '' },
  },
  strict: false,
  allowPositionals: true,
});

const port = parseInt(process.env.RELAY_PORT || '3457', 10);
const namespace = values.namespace;
const filePath = values.file || null;
const dirPath = values.dir || null;
const distDir = join(__dirname, '..', 'dist');
const hasDist = existsSync(distDir) && statSync(distDir).isDirectory();
const promptDir = dirPath || '/data/claude-logs';
const releaseName = process.env.RELEASE_NAME || 'neo';
const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL || '';
const vllmHealthIntervalMs = parseInt(process.env.VLLM_HEALTH_INTERVAL_MS || '5000', 10);
const claudeWorkspaceDir = process.env.CLAUDE_WORKSPACE_DIR || '/data/claude-workspace';
const authUser = process.env.NEO_AUTH_USER || '';
const authPass = process.env.NEO_AUTH_PASS || '';

export const config = {
  port,
  namespace,
  filePath,
  dirPath,
  distDir,
  hasDist,
  promptDir,
  releaseName,
  anthropicBaseUrl,
  vllmHealthIntervalMs,
  claudeWorkspaceDir,
  authUser,
  authPass,
};
