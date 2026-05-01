import { timingSafeEqual } from 'crypto';

export function createAuthCheck(user, pass) {
  if (!user) return null;

  return function checkAuth(req, res) {
    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Basic ')) return deny(res);

    const decoded = Buffer.from(header.slice(6), 'base64').toString();
    const sep = decoded.indexOf(':');
    if (sep === -1) return deny(res);

    const u = decoded.slice(0, sep);
    const p = decoded.slice(sep + 1);

    if (safeEqual(u, user) && safeEqual(p, pass)) return true;
    return deny(res);
  };
}

function deny(res) {
  res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Neo"' });
  res.end('Unauthorized');
  return false;
}

function safeEqual(a, b) {
  const bufA = Buffer.from(a ?? '');
  const bufB = Buffer.from(b ?? '');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
