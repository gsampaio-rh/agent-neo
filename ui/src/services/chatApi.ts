export interface ChatResponse {
  status: string;
  error?: string;
}

export interface EnvironmentInfo {
  model: string;
  namespace: string;
  podName: string;
  permissionMode: string;
}

export interface StatusResponse {
  status: 'running' | 'idle';
  events: number;
  clients: number;
  resetting?: boolean;
  llmAvailable?: boolean;
  environment?: EnvironmentInfo;
}

export async function sendPrompt(prompt: string): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  return res.json();
}

export async function stopAgent(): Promise<ChatResponse> {
  const res = await fetch('/api/stop', { method: 'POST' });
  return res.json();
}

export async function resetConversation(): Promise<ChatResponse> {
  const res = await fetch('/api/reset', { method: 'POST' });
  return res.json();
}

export async function fetchStatus(): Promise<StatusResponse> {
  const res = await fetch('/api/status');
  return res.json();
}
