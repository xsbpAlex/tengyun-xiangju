// M5 主线飞轮实测：时间快进 11 天 → 撞墙画饼 → 账册集满 → 幻灭注满 → 岔路降临 → 觉醒留任
import { db, now } from '../server/src/db.js';

const BASE = 'http://localhost:3001';
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
};
const post = (path, body, headers) =>
  fetch(BASE + path, { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined });

const name = 'm5' + (Date.now() % 1e9);
let r = await post('/api/auth/register', { username: name, password: '123456' }, { 'Content-Type': 'application/json' });
const { token } = await r.json();
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

r = await post('/api/game/choose-dept', { deptId: 'qianyafang' }, auth);
check('选任部门', r.status === 200);

const acct = db.prepare('SELECT id FROM accounts WHERE username = ?').get(name);

// 1. 时间快进 11 天：回拨 createdAt 与 lastTickAt（挂机党一觉醒来，饼已经画了好几轮）
{
  const st = JSON.parse(db.prepare('SELECT payload FROM saves WHERE account_id = ?').get(acct.id).payload);
  const t = now() - 11 * 86400_000;
  st.createdAt = t;
  st.lastTickAt = t;
  db.prepare('UPDATE saves SET payload = ? WHERE account_id = ?').run(JSON.stringify(st), acct.id);
}

r = await fetch(BASE + '/api/game/state', { headers: auth });
let d = await r.json();
check('11 天挂机差事海量办结', d.state.questCount > 1000, `办结 ${d.state.questCount} 次`);
check('旧账册八页集满', d.state.ledger === 8, `ledger=${d.state.ledger}`);
check('连撞多墙画饼升级', d.state.xianjiStage >= 3, `stage=${d.state.xianjiStage}`);
check('撞墙告示待读', typeof d.wallNotice === 'string' && d.wallNotice.length > 0, d.wallNotice?.slice(0, 18));
check('仙籍进度已折算', d.xianji.progress > 80, `progress=${d.xianji.progress}`);
check('幻灭注满岔路降临', d.state.huanmie === 100 && d.fork === 'pending');
check('心事文案切到末期', typeof d.xinshi === 'string' && /弦/.test(d.xinshi), d.xinshi);

// 2. 岔路抉择：跳槽未开放（M7），觉醒留任可行
r = await post('/api/game/fork/choose', { choice: 'leave' }, auth);
d = await r.json();
check('跳槽转生留待 M7(400)', r.status === 400 && /M7/.test(d.error), d.error);
r = await post('/api/game/fork/choose', { choice: 'stay' }, auth);
d = await r.json();
check('觉醒留任（分支 A）', r.status === 200 && d.fork === 'chose_stay');

// 3. 账册内容：环境叙事，最后一页是烛影
r = await fetch(BASE + '/api/game/ledger', { headers: auth });
d = await r.json();
check('账册八页可读', d.pages.length === 8 && d.total === 8);
check('末页落款烛影', /烛影/.test(d.pages[7].text));
check('账册文案不含现实词汇', !/编制|国企|合同|社保/.test(d.pages.map((p) => p.text).join('')));

// 4. 告示回执：读完即消
r = await post('/api/game/wall/ack', null, auth);
d = await r.json();
check('告示回执后清空', r.status === 200 && d.wallNotice === null);

// 5. 觉醒后再画饼：只涨通透不涨幻灭，产出有加成
{
  const st = JSON.parse(db.prepare('SELECT payload FROM saves WHERE account_id = ?').get(acct.id).payload);
  st.createdAt = st.createdAt - 10 * 86400_000; // 服役再延 10 天 → 进度 +80 → 再撞一墙
  db.prepare('UPDATE saves SET payload = ? WHERE account_id = ?').run(JSON.stringify(st), acct.id);
}
r = await fetch(BASE + '/api/game/state', { headers: auth });
d = await r.json();
check('觉醒撞墙涨通透', d.tongtou >= 1 && d.state.huanmie === 100, `tongtou=${d.tongtou}`);
check('通透产出加成生效', d.ratePerMin > 6, `rate=${d.ratePerMin.toFixed(2)}`);
check('新告示又贴上墙', typeof d.wallNotice === 'string' && d.wallNotice.length > 0);

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
