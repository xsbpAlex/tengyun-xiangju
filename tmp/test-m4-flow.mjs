// M4 完整飞轮实测：注册→选部门→时间快进→差事办结→锻造→强化→领赏
import { db, now } from '../server/src/db.js';

const BASE = 'http://localhost:3001';
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
};
const post = (path, body, headers) =>
  fetch(BASE + path, { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined });

const name = 'f' + (Date.now() % 1e9);
let r = await post('/api/auth/register', { username: name, password: '123456' }, { 'Content-Type': 'application/json' });
const { token } = await r.json();
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

// 选部门（随便选一房，法器不依赖部门）
r = await post('/api/game/choose-dept', { deptId: 'qianyafang' }, auth);
check('选任部门', r.status === 200);

// 1. 挂机推进：把 lastTickAt 回拨 3 小时（离线段 0.6 倍照样办结差事）
const acct = db.prepare('SELECT id FROM accounts WHERE username = ?').get(name);
const save = db.prepare('SELECT payload FROM saves WHERE account_id = ?').get(acct.id);
const st = JSON.parse(save.payload);
st.lastTickAt = now() - 3 * 3600_000; // 3 小时前 → 有效进度约 108 分
db.prepare('UPDATE saves SET payload = ?, last_seen_at = ? WHERE account_id = ?')
  .run(JSON.stringify(st), st.lastTickAt, acct.id);

r = await fetch(BASE + '/api/game/state', { headers: auth });
let d = await r.json();
check('3 小时挂机差事自动办结', d.state.questCount > 40, `办结 ${d.state.questCount} 次`);
check('灵石与灵材双入账', d.state.bank > 200 && d.state.materials > 50, `bank=${d.state.bank} mats=${d.state.materials}`);
check('案牍牌差事进度累计', d.state.daily.quest > 5, `daily.quest=${d.state.daily.quest}`);
check('长离弹离线报告', d.offlineReport !== null && d.offlineReport.earned > 0);

// 2. 收菜×3 凑案牍牌进度
for (let i = 0; i < 3; i++) {
  r = await post('/api/game/collect', null, auth);
}
d = await r.json();
check('收菜 3 次计入案牍牌', d.state.daily.collect === 3);

// 3. 摸鱼×3（用回拨冷却的方式绕过 120 秒）
for (let i = 0; i < 3; i++) {
  const s2 = JSON.parse(db.prepare('SELECT payload FROM saves WHERE account_id = ?').get(acct.id).payload);
  s2.moyuReadyAt = 0;
  db.prepare('UPDATE saves SET payload = ? WHERE account_id = ?').run(JSON.stringify(s2), acct.id);
  r = await post('/api/game/moyu', null, auth);
  if (r.status !== 200) break;
}
d = await r.json();
check('摸鱼 3 次计入案牍牌', d.state.daily.moyu === 3);

// 4. 锻造 + 强化
r = await post('/api/game/forge', { slot: 'hand' }, auth);
d = await r.json();
check('锻造出品', r.status === 200 && d.item?.name && d.state.gear.hand?.name === d.item.name, d.item?.name);
const zabanliAfterForge = d.zabanli;
check('法器提升办差力', zabanliAfterForge > 10, `办差力=${zabanliAfterForge}`);
r = await post('/api/game/enhance', { slot: 'hand' }, auth);
d = await r.json();
check('强化成功', r.status === 200 && d.state.gear.hand.lvl === 2, `power=${d.power}`);

// 5. 一键领赏
r = await post('/api/game/daily/claim', null, auth);
d = await r.json();
check('一键领赏成功', r.status === 200 && d.reward?.bank > 0 && d.state.daily.claimed, `赏=${d.reward?.bank}灵石+${d.reward?.materials}灵材`);
r = await post('/api/game/daily/claim', null, auth);
check('重复领赏被拒(400)', r.status === 400);

// 6. 办差力涨后能接更高档差事
r = await post('/api/game/quest/select', { tier: 1 }, auth);
d = await r.json();
check('办差力达标接更高档', r.status === 200 && d.state.questTier === 1);

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
