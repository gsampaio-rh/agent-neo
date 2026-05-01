import { useCallback, useEffect, useRef, useState } from 'react';
import { parseJsonlEvents } from '../lib/eventParser';
import { updateContext, INITIAL_AGENT_STATE, INITIAL_CONTEXT, type AgentState, type AgentAction } from '../lib/contextReducer';
import { extractTerminalLine, deriveAction, deriveActionText } from '../lib/terminalLine';
import { DEMO_EVENTS } from '../lib/demoData';

export function useDemoMode(): {
  state: AgentState;
  startDemo: () => void;
  isDemoActive: boolean;
} {
  const [state, setState] = useState<AgentState>({ ...INITIAL_AGENT_STATE });
  const [active, setActive] = useState(false);
  const lineIdRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const startDemo = useCallback(() => {
    setActive(true);
    lineIdRef.current = 0;

    setState({
      ...INITIAL_AGENT_STATE,
      context: { ...INITIAL_CONTEXT },
      connected: true,
      startTime: Date.now(),
    });

    let i = 0;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = window.setInterval(() => {
      if (i >= DEMO_EVENTS.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }

      const line = DEMO_EVENTS[i++];
      const events = parseJsonlEvents(line);
      if (events.length === 0) return;

      for (const event of events) {
        if (event.type === 'unknown' || event.type === 'init' || event.type === 'result') continue;

        const termLine = extractTerminalLine(event, lineIdRef.current++);
        const action = deriveAction(event);
        const bubble = deriveActionText(event);

        setState((prev) => {
          const newCtx = updateContext(prev.context, event);

          return {
            ...prev,
            context: newCtx,
            terminalLines: termLine ? [...prev.terminalLines, termLine] : prev.terminalLines,
            eventCount: prev.eventCount + 1,
            agentAction: action as AgentAction,
            actionText: bubble || prev.actionText,
          };
        });
      }
    }, 1200);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { state, startDemo, isDemoActive: active };
}
