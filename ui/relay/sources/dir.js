import { existsSync, statSync, openSync, readSync, closeSync, watch } from 'fs';
import { join } from 'path';

export function startDirStream(hub, dirPath) {
  const jsonlPath = join(dirPath, 'claude.jsonl');
  console.log(`[relay] Tailing local file: ${jsonlPath}`);

  let offset = 0;
  const BUF_SIZE = 64 * 1024;
  const buf = Buffer.alloc(BUF_SIZE);

  function readNewLines() {
    if (!existsSync(jsonlPath)) return;
    const size = statSync(jsonlPath).size;
    if (size < offset) {
      console.log(`[relay] ${jsonlPath} truncated (${offset} → ${size}), resetting offset`);
      offset = 0;
    }
    if (size <= offset) return;

    const fd = openSync(jsonlPath, 'r');
    let partial = '';
    let pos = offset;

    try {
      while (pos < size) {
        const bytesToRead = Math.min(BUF_SIZE, size - pos);
        const bytesRead = readSync(fd, buf, 0, bytesToRead, pos);
        if (bytesRead === 0) break;
        pos += bytesRead;

        const chunk = partial + buf.toString('utf8', 0, bytesRead);
        const lines = chunk.split('\n');
        partial = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) { hub.broadcast(line.trim()); process.stdout.write('.'); }
        }
      }
    } finally {
      closeSync(fd);
    }
    offset = pos - Buffer.byteLength(partial, 'utf8');
  }

  readNewLines();

  const pollInterval = setInterval(readNewLines, 500);

  let watcher = null;
  try {
    watcher = watch(dirPath, (eventType, filename) => {
      if (filename === 'claude.jsonl') readNewLines();
    });
    watcher.on('error', () => {
      console.log('[relay] fs.watch unavailable, using polling only');
      watcher = null;
    });
  } catch {
    console.log('[relay] fs.watch not supported, using 500ms polling');
  }

  const stop = () => {
    clearInterval(pollInterval);
    if (watcher) { watcher.close(); watcher = null; }
  };

  process.on('SIGTERM', () => { stop(); process.exit(0); });
  process.on('SIGINT',  () => { stop(); process.exit(0); });

  return { stop };
}
