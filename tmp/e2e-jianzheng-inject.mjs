// 一次性 E2E 注入：二周目满配号，供玩家手动体验 M7.5 监正争夺战
import { DatabaseSync } from 'node:sqlite';

const NAME = 'm75e2e_jianzheng';
const BASE = 'http://localhost:3001';

// 1. 注册/登录拿 token
let r = await fetch(BASE + '/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: NAME, password: 'E2E_PASS_1' }),
});
if (r.status !== 200) {
  r = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: NAME, password: 'E2E_PASS_1' }),
  });
}
const auth = await r.json();
console.log('auth:', r.status, JSON.stringify(auth).slice(0, 80));
const hdr = { Authorization: `Bearer ${auth.token}` };

// 首次拉状态，确保 saves 行落盘
await fetch(BASE + '/api/game/state', { headers: hdr });

// 2. 直接改存档为二周目满配（对齐 18 段验证口径，办差力稳进榜前五，立即开议）
const db = new DatabaseSync('d:/niuma/server/data/game.db');
const acct = db.prepare('SELECT id FROM accounts WHERE username = ?').get(NAME);
const row = db.prepare('SELECT payload FROM saves WHERE account_id = ?').get(acct.id);
const st = JSON.parse(row.payload);
st.dept = st.dept ?? 'qianyafang';
st.loop = 2;
st.rank = 6; st.rankLvl = 10; st.gongfaLvl = 10; st.deptGongfaLvl = 10;
st.gear = {
  hand: { name: '巧', slot: 'hand', rarity: 4, lvl: 20, temper: 0 },
  shield: { name: '巧', slot: 'shield', rarity: 4, lvl: 20, temper: 0 },
  soul: { name: '巧', slot: 'soul', rarity: 4, lvl: 20, temper: 0 },
  craft: { name: '巧', slot: 'craft', rarity: 4, lvl: 20, temper: 0 },
};
st.bank = 500000;
st.jianzheng = null;
st.pendingSpecial = null;
const ts = Date.now();
db.prepare('UPDATE saves SET payload = ?, updated_at = ?, last_seen_at = ? WHERE account_id = ?')
  .run(JSON.stringify(st), ts, ts, acct.id);
db.close();

// 3. 拉一次状态触发惰性开议
const hb = await fetch(BASE + '/api/game/state', { headers: hdr });
const hd = await hb.json();
console.log('state:', hb.status);
console.log('jianzheng:', JSON.stringify(hd.state?.jianzheng));
console.log('pendingSpecial:', hd.state?.pendingSpecial);
console.log('体验账号：', NAME, '/ E2E_PASS_1');
