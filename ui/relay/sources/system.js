import { existsSync, statSync, openSync, readSync, closeSync, watch } from 'fs';
import { join } from 'path';

export function startSystemLogStream(hub, dirPath) {
  const logPath = join(dirPath, 'system.log');
  console.log(`[relay] Tailing system log: ${logPath}`);

  let offset = 0;
  const BUF_SIZE = 16 * 1024;
  const buf = Buffer.alloc(BUF_SIZE);

  function readNewLines() {
    if (!existsSync(logPath)) return;
    const size = statSync(logPath).size;
    if (size < offset) offset = 0;
    if (size <= offset) return;

    const fd = openSync(logPath, 'r');
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
          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('{')) continue;

          const event = JSON.stringify({
            type: 'system',
            message: trimmed,
            timestamp: new Date().toISOString(),
          });
          hub.broadcast(event);
        }
      }
    } finally {
      closeSync(fd);
    }
    offset = pos - Buffer.byteLength(partial, 'utf8');
  }

  readNewLines();

  const pollInterval = setInterval(readNewLines, 1000);

  let watcher = null;
  try {
    watcher = watch(dirPath, (eventType, filename) => {
      if (filename === 'system.log') readNewLines();
    });
    watcher.on('error', () => {
      console.log('[relay] fs.watch unavailable for system.log, using polling only');
      watcher = null;
    });
  } catch {
    console.log('[relay] fs.watch not supported for system.log, using 1s polling');
  }

  return {
    stop: () => {
      clearInterval(pollInterval);
      if (watcher) { watcher.close(); watcher = null; }
    },
  };
}
