// 造快进账号 m55fly/123456：约 3 天进度的快照，供浏览器 E2E 验证各面板
const BASE = 'http://localhost:3001';
const username = 'm55fly';

let r = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password: '123456' }),
});
if (r.status !== 200) {
  r = await fetch(BASE + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: '123456' }),
  });
}
if (r.status !== 200) {
  console.log('账号创建失败', r.status, await r.text());
  process.exit(1);
}

const { DatabaseSync } = await import('node:sqlite');
const db = new DatabaseSync('d:/niuma/server/data/game.db');
const acct = db.prepare('SELECT id FROM accounts WHERE username = ?').get(username);
const now = Date.now();

const today = new Date();
const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

const save = {
  v: 1,
  migrated55: true,
  bank: 1500,
  contribution: 420,
  contributionTotal: 960,
  totalEarned: 8600,
  xinli: 82,
  burnout: false,
  rank: 2,
  gongfaLvl: 5,
  dept: 'qianyafang',
  deptGongfaLvl: 3,
  gear: {
    hand: { name: '灵品·朱笔法笔', slot: 'hand', rarity: 2, lvl: 8, temper: 0 },
    shield: { name: '凡品·铜腰牌', slot: 'shield', rarity: 1, lvl: 3, temper: 0 },
    soul: null,
    craft: null,
  },
  questTier: 3,
  questLocked: null,
  questProgress: 6.2,
  questBest: 3,
  questCount: 45,
  questFirsts: [0, 1, 2, 3],
  titles: ['saotong_tongzi', 'dishu_kuaishou', 'anjuan_laoli', 'tangqian_shulian'],
  forgePity: 4,
  auto: { promote: true, gongfa: true, deptGongfa: true },
  daily: { date: dateStr, quest: 3, contrib: 220, onlineMin: 41, forge: 1, claimed: false },
  xianjiStage: 1,
  huanmie: 6,
  ledger: 1,
  fork: null,
  tongtou: 0,
  wallNotice: null,
  events: [
    { ts: now - 3600000, type: 'milestone', text: '「堂前值守」首次办结，授号「堂前熟脸」——上官见了他点头，就算拜过年了。' },
    { ts: now - 7200000, type: 'reward', text: '案牍牌赏钱已自动入账：薪酬 +140，贡献 +220' },
  ],
  createdAt: now - 3 * 86400000,
  lastTickAt: now - 6.5 * 3600 * 1000, // 离开 6.5 小时 → 登录后弹结算卷轴
};

const ts = Date.now();
db.prepare(`INSERT INTO saves (account_id, payload, updated_at, last_seen_at) VALUES (?,?,?,?)
  ON CONFLICT(account_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`)
  .run(acct.id, JSON.stringify(save), ts, ts);
db.close();
console.log('m55fly 快进存档已写入（6.5h 离线，登录即弹结算卷轴）');
