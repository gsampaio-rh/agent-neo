import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

type AttackPhase = 'normal' | 'compromised' | 'exploiting';

export interface IsolationCheck {
  name: string;
  label: string;
  pass: boolean;
  detail?: string;
}

export interface IsolationState {
  runtime: string;
  checks: IsolationCheck[];
}

export interface SharedServerState {
  escaped: boolean;
  eventCount: number;
  attackPhase: AttackPhase;
  isolation: IsolationState | null;
}

export interface DevOverride {
  attackPhase?: AttackPhase;
  escaped?: boolean;
  isolationRuntime?: 'runc' | 'kata';
}

type DevOverrideUpdater = DevOverride | null | ((prev: DevOverride | null) => DevOverride | null);

interface SharedStateContextValue {
  state: SharedServerState;
  devOverride: DevOverride | null;
  setDevOverride: (override: DevOverrideUpdater) => void;
}

const INITIAL_STATE: SharedServerState = {
  escaped: false,
  eventCount: 0,
  attackPhase: 'normal',
  isolation: null,
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
          isolation: data.isolation ?? prev.isolation,
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
        ...(devOverride.isolationRuntime !== undefined && {
          isolation: {
            runtime: devOverride.isolationRuntime,
            checks: devOverride.isolationRuntime === 'kata'
              ? [
                  { name: 'namespace_escape', label: 'Namespace escape', pass: true, detail: 'unshare blocked by guest kernel boundary' },
                  { name: 'host_pid', label: 'Host filesystem', pass: true, detail: 'host filesystem isolated by Kata guest kernel' },
                  { name: 'kernel_module', label: 'Kernel modules', pass: true, detail: 'modprobe blocked by hypervisor boundary' },
                ]
              : [
                  { name: 'namespace_escape', label: 'Namespace escape', pass: false, detail: 'unshare succeeded \u2014 PID/mount namespaces can be created, container escape possible' },
                  { name: 'host_pid', label: 'Host filesystem', pass: false, detail: 'host root visible: bin, dev, etc, home, lib, proc, root, usr' },
                  { name: 'kernel_module', label: 'Kernel modules', pass: false, detail: 'modprobe succeeded \u2014 kernel modules loadable from container' },
                ],
          },
        }),
      }
    : serverState;

  const stableSetDevOverride = useCallback((override: DevOverrideUpdater) => {
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
