import { useCallback, useEffect, useRef, useState } from 'react';
import { listPlans, getPlan, type PlanSummary, type PlanDetail } from '../services/plansApi';

const POLL_INTERVAL_MS = 10_000;

export interface PlansState {
  plans: PlanSummary[];
  selectedPlan: PlanDetail | null;
  selectPlan: (filename: string) => void;
}

export function usePlans(): PlansState {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PlanDetail | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    function poll() {
      listPlans().then(({ plans: p }) => {
        if (mountedRef.current) setPlans(p);
      }).catch(() => {});
    }

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => { mountedRef.current = false; clearInterval(timer); };
  }, []);

  const selectPlan = useCallback((filename: string) => {
    if (selectedPlan?.filename === filename) {
      setSelectedPlan(null);
      return;
    }
    getPlan(filename).then(setSelectedPlan).catch(() => {});
  }, [selectedPlan?.filename]);

  return { plans, selectedPlan, selectPlan };
}
