import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type MilestoneId =
  | 'persona_set'
  | 'first_response'
  | 'log_expanded'
  | 'visited_map'
  | 'file_read';

const STORAGE_KEY = 'neo:milestones';

function loadMilestones(): Set<MilestoneId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr as MilestoneId[]);
    return new Set();
  } catch {
    return new Set();
  }
}

function saveMilestones(milestones: Set<MilestoneId>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...milestones]));
  } catch { /* localStorage unavailable */ }
}

export function clearMilestoneStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* localStorage unavailable */ }
}

interface MilestoneContextValue {
  milestones: Set<MilestoneId>;
  emit: (id: MilestoneId) => void;
  reset: () => void;
}

const MilestoneContext = createContext<MilestoneContextValue>({
  milestones: new Set(),
  emit: () => {},
  reset: () => {},
});

export function MilestoneProvider({ children }: { children: ReactNode }): ReactNode {
  const [milestones, setMilestones] = useState<Set<MilestoneId>>(loadMilestones);

  const emit = useCallback((id: MilestoneId) => {
    setMilestones((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      saveMilestones(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    clearMilestoneStorage();
    setMilestones(new Set());
  }, []);

  return (
    <MilestoneContext.Provider value={{ milestones, emit, reset }}>
      {children}
    </MilestoneContext.Provider>
  );
}

export function useMilestones(): Set<MilestoneId> {
  return useContext(MilestoneContext).milestones;
}

export function useEmitMilestone(): (id: MilestoneId) => void {
  return useContext(MilestoneContext).emit;
}

export function useResetMilestones(): () => void {
  return useContext(MilestoneContext).reset;
}
