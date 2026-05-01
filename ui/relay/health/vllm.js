let available = true;
let intervalHandle = null;

export function startVllmHealthPoller(baseUrl, intervalMs = 5000) {
  if (!baseUrl) return null;
  const healthUrl = baseUrl.replace(/\/v1\/?$/, '') + '/health';

  async function check() {
    try {
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(3000) });
      available = res.ok;
    } catch {
      available = false;
    }
  }

  check();
  intervalHandle = setInterval(check, intervalMs);
  return intervalHandle;
}

export function stopVllmHealthPoller() {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

export function isLlmAvailable() {
  return available;
}

export function _setAvailable(value) {
  available = value;
}
