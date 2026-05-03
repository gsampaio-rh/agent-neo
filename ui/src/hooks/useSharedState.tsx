import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

type AttackPhase = 'normal' | 'compromised' | 'exploiting';

export interface SharedServerState {
  escaped: boolean;
  eventCount: number;
  attackPhase: AttackPhase;
}

export interface DevOverride {
  attackPhase?: AttackPhase;
  escaped?: boolean;
}

interface SharedStateContextValue {
  state: SharedServerState;
  devOverride: DevOverride | null;
  setDevOverride: (override: DevOverride | null) => void;
}

const INITIAL_STATE: SharedServerState = {
  escaped: false,
  eventCount: 0,
  attackPhase: 'normal',
};

const SharedStateContext = createContext<SharedStateContextValue>({
  state: INITIAL_STATE,
  devOverride: null,
  setDevOverride: () => {},
});

const POLL_INTERVAL_MS = 2000;

export function SharedStateProvider({ children }: { children: ReactNode }): ReactNode {
  const [serverState, setServerState] = useState<SharedServerState>(INITIAL_STATE);
  const [devOverride, setDevOverride] = useState<DevOverride | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('/api/state');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setServerState((prev) => ({
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

  const effectiveState: SharedServerState = devOverride
    ? {
        ...serverState,
        ...(devOverride.attackPhase !== undefined && { attackPhase: devOverride.attackPhase }),
        ...(devOverride.escaped !== undefined && { escaped: devOverride.escaped }),
      }
    : serverState;

  const stableSetDevOverride = useCallback((override: DevOverride | null) => {
    setDevOverride(override);
  }, []);

  return (
    <SharedStateContext.Provider value={{ state: effectiveState, devOverride, setDevOverride: stableSetDevOverride }}>
      {children}
    </SharedStateContext.Provider>
  );
}

export function useSharedState(): SharedServerState {
  return useContext(SharedStateContext).state;
}

export function useDevOverride(): Pick<SharedStateContextValue, 'devOverride' | 'setDevOverride'> {
  const { devOverride, setDevOverride } = useContext(SharedStateContext);
  return { devOverride, setDevOverride };
}
