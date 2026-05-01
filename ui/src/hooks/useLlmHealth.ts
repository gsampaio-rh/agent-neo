import { useEffect, useRef, useState } from 'react';
import * as chatApi from '../services/chatApi';

const LLM_POLL_INTERVAL_MS = 5000;

export function useLlmHealth(connected: boolean): {
  llmAvailable: boolean;
  llmAvailableRef: React.RefObject<boolean>;
} {
  const [llmAvailable, setLlmAvailable] = useState(true);
  const llmAvailableRef = useRef(true);

  useEffect(() => {
    if (!connected) return;

    chatApi.fetchStatus()
      .then((data) => {
        const avail = data.llmAvailable !== false;
        llmAvailableRef.current = avail;
        setLlmAvailable(avail);
      })
      .catch(() => {});

    const id = window.setInterval(() => {
      chatApi.fetchStatus()
        .then((data) => {
          const avail = data.llmAvailable !== false;
          llmAvailableRef.current = avail;
          setLlmAvailable(avail);
        })
        .catch(() => {});
    }, LLM_POLL_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, [connected]);

  return { llmAvailable, llmAvailableRef };
}
