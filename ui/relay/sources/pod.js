import { spawn } from 'child_process';
import { createInterface } from 'readline';

export function startPodStream(hub, { namespace, releaseName }) {
  const logPath = process.env.JSONL_PATH || '/tmp/claude-logs/claude.jsonl';
  console.log(`[relay] Streaming from pod in namespace: ${namespace}`);
  console.log(`[relay] Tailing via oc exec: ${logPath}`);

  const oc = spawn('oc', [
    'exec', `deployment/${releaseName}`,
    '-n', namespace, '-c', 'claude-code',
    '--', 'tail', '-f', '-n', '+1', logPath,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

  const rl = createInterface({ input: oc.stdout });
  rl.on('line', (line) => {
    if (line.trim()) { hub.broadcast(line.trim()); process.stdout.write('.'); }
  });

  oc.stderr.on('data', (chunk) => {
    const msg = chunk.toString().trim();
    if (msg) console.error(`[relay] stderr: ${msg}`);
  });

  oc.on('close', (code) => {
    console.log(`\n[relay] oc exited with code ${code}`);
    if (code !== 0) {
      console.log('[relay] Retrying in 5s...');
      setTimeout(() => startPodStream(hub, { namespace, releaseName }), 5000);
    }
  });
}
