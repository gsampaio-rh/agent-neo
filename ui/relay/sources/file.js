import { createReadStream, existsSync } from 'fs';
import { createInterface } from 'readline';

export function startFileStream(hub, filePath) {
  console.log(`[relay] Replaying from file: ${filePath}`);
  if (!existsSync(filePath)) {
    console.error(`[relay] File not found: ${filePath}`);
    process.exit(1);
  }

  const rl = createInterface({ input: createReadStream(filePath) });
  let lineNum = 0;

  rl.on('line', (line) => {
    if (!line.trim()) return;
    lineNum++;
    setTimeout(() => { hub.broadcast(line.trim()); process.stdout.write('.'); }, lineNum * 800);
  });
  rl.on('close', () => console.log(`\n[relay] Finished replaying ${lineNum} lines`));
}
