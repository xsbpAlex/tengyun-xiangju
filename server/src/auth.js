// 会话与鉴权：Bearer token 存 sessions 表，简单可靠
import crypto from 'node:crypto';
import { db, now } from './db.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

export function createSession(accountId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare(
    'INSERT INTO sessions (token, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).run(token, accountId, now(), now() + SESSION_TTL_MS);
  return token;
}

export function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// Express 中间件：校验 Authorization: Bearer <token>，挂 req.accountId
export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: '未登录' });

  const row = db
    .prepare('SELECT account_id, expires_at FROM sessions WHERE token = ?')
    .get(token);
  if (!row || row.expires_at < now()) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
  req.accountId = row.account_id;
  req.token = token;
  next();
}
