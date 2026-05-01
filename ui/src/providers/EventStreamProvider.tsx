import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createSseClient } from '../services/sseClient';
import { parseJsonlEvents, type EscapeEvent } from '../lib/eventParser';

type EventListener = (event: EscapeEvent) => void;

interface EventStreamContextValue {
  connected: boolean;
  subscribe: (listener: EventListener) => () => void;
  dispatch: (event: EscapeEvent) => void;
  setConnected: (value: boolean) => void;
}

const noop = () => {};
const EventStreamContext = createContext<EventStreamContextValue>({
  connected: false,
  subscribe: () => noop,
  dispatch: noop,
  setConnected: noop,
});

export function useEventStream() {
  return useContext(EventStreamContext);
}

interface EventStreamProviderProps {
  url: string | null;
  children: ReactNode;
}

export function EventStreamProvider({ url, children }: EventStreamProviderProps) {
  const [connected, setConnected] = useState(false);
  const listenersRef = useRef<Set<EventListener>>(new Set());

  const dispatch = useCallback((event: EscapeEvent) => {
    for (const listener of listenersRef.current) {
      listener(event);
    }
  }, []);

  const subscribe = useCallback((listener: EventListener) => {
    listenersRef.current.add(listener);
    return () => { listenersRef.current.delete(listener); };
  }, []);

  useEffect(() => {
    if (!url) return;

    const client = createSseClient(
      url,
      (line) => {
        const events = parseJsonlEvents(line);
        for (const event of events) {
          dispatch(event);
        }
      },
      () => setConnected(true),
      () => setConnected(false),
    );

    return () => {
      client.close();
      setConnected(false);
    };
  }, [url, dispatch]);

  const value = useMemo(() => ({ connected, subscribe, dispatch, setConnected }), [connected, subscribe, dispatch]);

  return (
    <EventStreamContext.Provider value={value}>
      {children}
    </EventStreamContext.Provider>
  );
}
