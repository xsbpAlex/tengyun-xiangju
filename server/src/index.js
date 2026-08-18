// 腾云香局 · 服务端入口（M0：账号 + 权威存档）
import express from 'express';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import fs from 'node:fs';
import { db, now } from './db.js';
import { createSession, destroySession, requireAuth } from './auth.js';
import gameRouter from './routes/game.js';

const app = express();
app.use(express.json({ limit: '512kb' }));

// ---------- 健康检查 ----------
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, name: '腾云香局', time: now() });
});

// ---------- 账号 ----------
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || !/^[\u4e00-\u9fa5A-Za-z0-9_]{2,16}$/.test(username)) {
    return res.status(400).json({ error: '名号需为 2~16 位中英文、数字或下划线' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: '口令至少 6 位' });
  }
  const exists = db.prepare('SELECT id FROM accounts WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: '此名号已有人用' });

  const result = db
    .prepare('INSERT INTO accounts (username, password_hash, created_at) VALUES (?, ?, ?)')
    .run(username, bcrypt.hashSync(password, 10), now());
  const token = createSession(Number(result.lastInsertRowid));
  res.json({ token, username });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body ?? {};
  const row = db.prepare('SELECT * FROM accounts WHERE username = ?').get(username ?? '');
  if (!row || !bcrypt.compareSync(password ?? '', row.password_hash)) {
    return res.status(401).json({ error: '名号或口令不对' });
  }
  const token = createSession(row.id);
  res.json({ token, username: row.username });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  destroySession(req.token);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id, username, created_at FROM accounts WHERE id = ?')
    .get(req.accountId);
  res.json(row);
});

// ---------- 权威存档 ----------
// GET：取存档（无存档返回 null）
app.get('/api/save', requireAuth, (req, res) => {
  const row = db.prepare('SELECT payload, updated_at FROM saves WHERE account_id = ?')
    .get(req.accountId);
  db.prepare('UPDATE saves SET last_seen_at = ? WHERE account_id = ?')
    .run(now(), req.accountId);
  res.json(row ? { payload: JSON.parse(row.payload), updatedAt: row.updated_at } : null);
});

// PUT：整体覆盖存档。updated_at / last_seen_at 由服务端打戳——
// 这是反作弊地基：离线收益将来按 last_seen_at 结算，客户端时钟无关。
app.put('/api/save', requireAuth, (req, res) => {
  const payload = req.body?.payload;
  if (typeof payload !== 'object' || payload === null) {
    return res.status(400).json({ error: '存档格式不对' });
  }
  const text = JSON.stringify(payload);
  if (text.length > 256 * 1024) {
    return res.status(400).json({ error: '存档过大' });
  }
  const ts = now();
  db.prepare(`
    INSERT INTO saves (account_id, payload, updated_at, last_seen_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at,
      last_seen_at = excluded.last_seen_at
  `).run(req.accountId, text, ts, ts);
  res.json({ ok: true, updatedAt: ts });
});

// ---------- 游戏（M1 核心循环） ----------
app.use('/api/game', gameRouter);

// ---------- M8 生产托管 ----------
// web/dist 存在时同端口服务前端（开发走 vite 代理则跳过），非 /api 路由回 index.html
// 带 hash 的资源长缓存；index.html 不缓存，发新版即达
const DIST_DIR = path.resolve(import.meta.dirname, '../../web/dist');
if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  app.use(express.static(DIST_DIR, { maxAge: '7d', index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'), { headers: { 'Cache-Control': 'no-cache' } });
  });
}

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`腾云香局服务端已开门办公：http://localhost:${PORT}`);
});
