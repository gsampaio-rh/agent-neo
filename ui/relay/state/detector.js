const OUTBOUND_PATTERNS = [
  /HTTP\/[12]/,
  /Connected to\s+\S+/i,
  /Connection to\s+\S+\s+port\s+\d+/i,
  /\b\d+\s+bytes?\s+from\b/i,
  /\bopen\b.*\bport\b/i,
  /\b(200|201|301|302|403|404|500)\s/,
];

const LOCAL_FILE_CONTENT = /\/proc\/net|\/etc\/resolv|\/etc\/hosts|\/run\/secrets/;

const IP_REGEX = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g;
const FQDN_REGEX = /\b([a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+\.(?:svc|com|io|org|net|dev|local|internal|cloud|app|co|br|uk|de|fr|us|edu|gov|mil|info|biz|me|[a-z]{2,6}))\b/gi;

function isLocalIp(ip) {
  return ip.startsWith('127.') || ip.startsWith('0.') || ip === '255.255.255.255';
}

function extractIps(text) {
  const ips = [];
  for (const m of text.matchAll(IP_REGEX)) {
    if (!isLocalIp(m[1]) && !ips.includes(m[1])) ips.push(m[1]);
  }
  return ips;
}

function extractHosts(text) {
  const hosts = [];
  for (const m of text.matchAll(FQDN_REGEX)) {
    const h = m[1].toLowerCase();
    if (!hosts.includes(h)) hosts.push(h);
  }
  return hosts;
}

function extractToolResultContent(block) {
  const raw = block.content;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw.map((c) => (typeof c.text === 'string' ? c.text : JSON.stringify(c))).join('\n');
  }
  return JSON.stringify(raw);
}

export function detectEscape(jsonLine) {
  let parsed;
  try { parsed = JSON.parse(jsonLine); } catch { return null; }

  if (parsed.type !== 'user') return null;

  const content = parsed.message?.content;
  if (!Array.isArray(content)) return null;

  for (const block of content) {
    if (block.type !== 'tool_result') continue;

    const text = extractToolResultContent(block);
    if (!text) continue;
    if (LOCAL_FILE_CONTENT.test(text)) continue;

    if (OUTBOUND_PATTERNS.some((p) => p.test(text))) {
      const ips = extractIps(text);
      const hosts = extractHosts(text);
      return { escaped: true, outboundTarget: ips[0] || hosts[0] || 'unknown' };
    }
  }

  return null;
}
