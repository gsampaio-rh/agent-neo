import { useEffect, useRef, useState } from 'react';

export interface SharedServerState {
  escaped: boolean;
  eventCount: number;
  attackPhase: 'normal' | 'compromised' | 'exploiting';
}

const INITIAL_STATE: SharedServerState = {
  escaped: false,
  eventCount: 0,
  attackPhase: 'normal',
};

const POLL_INTERVAL_MS = 2000;

export function useSharedState(): SharedServerState {
  const [state, setState] = useState<SharedServerState>(INITIAL_STATE);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('/api/state');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setState((prev) => ({
          escaped: data.escaped ?? prev.escaped,
          eventCount: data.eventCount ?? prev.eventCount,
          attackPhase: data.attackPhase ?? prev.attackPhase,
        }));
      } catch {
        // network error — keep current state
      }
    }

    poll();
    timerRef.current = window.setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return state;
}
