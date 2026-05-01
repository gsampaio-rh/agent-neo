import { useEffect, useState } from 'react';

export function useElapsed(startTime: number | null, stopped: boolean): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime || stopped) return;

    setElapsed(Math.floor((Date.now() - startTime) / 1000));

    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime, stopped]);

  return elapsed;
}
