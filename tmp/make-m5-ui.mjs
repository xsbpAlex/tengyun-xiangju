// 为浏览器 E2E 造一个「岔路降临」状态的账号：m5ui / 123456
import { db, now } from '../server/src/db.js';
import bcrypt from 'bcryptjs';

const BASE = 'http://localhost:3001';
const username = 'm5ui';

// 不存在则注册
const exists = db.prepare('SELECT id FROM accounts WHERE username = ?').get(username);
if (!exists) {
  const hash = bcrypt.hashSync('123456', 8);
  db.prepare('INSERT INTO accounts (username, password_hash, created_at) VALUES (?, ?, ?)').run(username, hash, now());
}

const acct = db.prepare('SELECT id FROM accounts WHERE username = ?').get(username);
let row = db.prepare('SELECT payload FROM saves WHERE account_id = ?').get(acct.id);
let st = row ? JSON.parse(row.payload) : null;
if (!st) {
  // 用接口造初始档
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: '123456' }),
  });
  const { token } = await r.json();
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  await fetch(BASE + '/api/game/state', { headers: auth });
  await fetch(BASE + '/api/game/choose-dept', {
    method: 'POST', headers: auth, body: JSON.stringify({ deptId: 'guangwensi' }),
  }).catch(() => {});
  row = db.prepare('SELECT payload FROM saves WHERE account_id = ?').get(acct.id);
  st = JSON.parse(row.payload);
}
if (!st.dept) st.dept = 'guangwensi';
st.fork = 'pending';
st.huanmie = 100;
st.ledger = 3;
st.xianjiStage = 2;
st.wallNotice = null;
st.lastTickAt = now();
st.createdAt = now() - 5 * 86400_000;
db.prepare('UPDATE saves SET payload = ? WHERE account_id = ?').run(JSON.stringify(st), acct.id);
console.log('OK: m5ui / 123456 ready (fork=pending, ledger=3, huanmie=100)');
