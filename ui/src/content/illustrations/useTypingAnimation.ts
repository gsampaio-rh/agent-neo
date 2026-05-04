import { useEffect, useState } from 'react';

export function useTypingAnimation(lines: string[], delayMs = 60, pauseMs = 800): string[] {
  const [visible, setVisible] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const completed: string[] = [];

    async function run() {
      for (const line of lines) {
        if (cancelled) return;
        let current = '';
        for (const char of line) {
          if (cancelled) return;
          current += char;
          setVisible([...completed, current]);
          await new Promise((r) => setTimeout(r, delayMs));
        }
        completed.push(current);
        setVisible([...completed]);
        await new Promise((r) => setTimeout(r, pauseMs));
      }
    }

    run();
    return () => { cancelled = true; };
  }, [lines, delayMs, pauseMs]);

  return visible;
}
