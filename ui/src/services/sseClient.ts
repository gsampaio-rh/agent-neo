export type SseListener = (line: string) => void;

export interface SseClient {
  close: () => void;
}

export function createSseClient(
  url: string,
  onLine: SseListener,
  onConnect: () => void,
  onDisconnect: () => void,
): SseClient {
  const es = new EventSource(url);

  es.onopen = () => onConnect();

  es.onmessage = (msg) => {
    const lines = msg.data.split('\n');
    for (const line of lines) {
      if (line.trim()) onLine(line.trim());
    }
  };

  es.addEventListener('file-change', ((msg: MessageEvent) => {
    try {
      const data = JSON.parse(msg.data);
      if (data.lines && Array.isArray(data.lines)) {
        for (const line of data.lines) onLine(line);
      }
    } catch {
      onLine(msg.data);
    }
  }) as EventListener);

  es.addEventListener('replay-end', (() => {
    // noop — consumers can subscribe to this if needed
  }) as EventListener);

  es.onerror = () => onDisconnect();

  return {
    close: () => {
      es.close();
      onDisconnect();
    },
  };
}
