// M5.5 接口实测：两线资源 / 砍收菜摸鱼 / 新端点 / 结算卷轴字段 / 旧档迁移
const BASE = 'http://localhost:3001';
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (path, headers, body) =>
  fetch(BASE + path, { method: 'POST', headers, body: body ? JSON.stringify(body) : undefined });

const name = 'm55_' + (Date.now() % 1e9);
let r = await fetch(BASE + '/api/auth/register', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: name, password: '123456' }),
});
const { token } = await r.json();
const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

// 1. config：新字段在、旧字段删
r = await fetch(BASE + '/api/game/config', { headers: auth });
const cfg = await r.json();
check('config 200', r.status === 200);
check('config 强化上限 20', cfg.maxEnhance === 20);
check('config 离线封顶 12h', cfg.offlineCapHours === 12);
check('config 倦怠回血 0.35/分', cfg.burnoutRecoverPerMin === 0.35);
check('config 锻造费吃贡献 150', cfg.forgeCost?.contribution === 150 && cfg.forgeCost?.bank === undefined);
check('config 十称号文案', Array.isArray(cfg.questTitles) && cfg.questTitles.length === 10 && cfg.questTitles[9].name === '案牍长城·行走');
check('config 差事十档 M6.1 新门槛表', cfg.quests.length === 10 && cfg.quests[0].req === 10 && cfg.quests[9].req === 440 && cfg.quests[9].salary === 7056 && cfg.quests[9].contrib === 4704);
check('config M6.1 功法封顶与办差力贡献封顶', cfg.gongfaMax === 10 && cfg.gongfaZCap === 50);
check('config 同僚名册 58 位下发', Array.isArray(cfg.npcNames) && cfg.npcNames.length === 58 && !!cfg.npcNames[0].id && !!cfg.npcNames[0].name);
check('config 官职十级制新字段', Array.isArray(cfg.rankLevelNeeds) && cfg.rankLevelNeeds.length === 7 && cfg.rankLevelNeeds[0][0] === 15 && cfg.rankLevelNeeds[0].length === 9 && cfg.rankExpQuestRatio === 0.2);
check('config 已砍 poolCap/摸鱼', cfg.poolCap === undefined && cfg.moyuValue === undefined && cfg.moyuCooldownMs === undefined);
check('config M6.5 全量称号 16 枚 + 词条表', Array.isArray(cfg.allTitles) && cfg.allTitles.length === 16 && cfg.titleWords?.saotong_tongzi?.salary === 0.01 && cfg.titleWords?.lingxiao_jueding?.xinliDrain === 0.05);
check('config M6.5 凌霄千层/秘境日 3 次/词缀 4 条', cfg.ladderFloors === 1000 && cfg.realmPerDay === 3 && cfg.nightAffixes?.length === 4);

// 2. 初始状态：两线资源形态
r = await fetch(BASE + '/api/game/state', { headers: auth });
let d = await r.json();
check('初始两线资源为 0', d.state.bank === 0 && d.state.contribution === 0 && d.state.contributionTotal === 0);
check('篮子字段已删', d.state.pool === undefined && d.state.materials === undefined);
check('新档无 auto 开关字段（成长消费全手动）', d.state.auto === undefined);
check('新档串门形态（3 次 + 空线索）', d.visitsLeft === 3 && d.state.visits?.left === 3 && Array.isArray(d.state.clues) && d.state.clues.length === 0);
check('初始职级形态', d.state.rankLvl === 1 && d.state.rankExp === 0 && d.rankLevelNeed === 15);
check('案牍牌新结构', d.state.daily?.quest === 0 && d.state.daily?.contrib === 0 && d.state.daily?.onlineMin === 0 && d.state.daily?.claimed === false && d.state.daily?.collect === undefined);
check('state 附带速率/办差力', d.ratePerMin === cfg.salaryPerMin && d.zabanli === 10);
check('state 附带游刃有余', d.speedBonus === 0);
check('state 附带案牍牌目标', d.dailyTargets?.quest === 5 && d.dailyTargets?.contrib === 0 && d.dailyTargets?.onlineMin === 60);
check('state 附带称号与邸报', Array.isArray(d.titles) && d.titles.length === 0 && Array.isArray(d.events) && d.events.length === 0);
check('短离不弹离线报告', d.offlineReport === null);
check('M6.5 初始 realmInfo（例巡/夜值各 3 次，词缀已抽，凌霄未登阶）', d.realmInfo?.patrolLeft === 3 && d.realmInfo?.nightLeft === 3 && !!d.realmInfo?.affix && d.realmInfo?.nightNeed > 0 && d.realmInfo?.ladderCleared === 0 && d.realmInfo?.ladderTotal === 1000 && d.realmInfo?.ladderNextNeed === 10 && d.realmInfo?.ladderSwept === false, JSON.stringify(d.realmInfo));
check('M6.5 初始背包为空', Array.isArray(d.state.bag) && d.state.bag.length === 0);

// 3. 挂机 10 秒：薪酬逐秒入账（无需收菜）
await sleep(10_000);
r = await fetch(BASE + '/api/game/state', { headers: auth });
d = await r.json();
check('挂机 10 秒薪酬直接入余额', d.state.bank > 0.5 && d.state.bank < 3, `bank=${d.state.bank.toFixed(2)}`);
check('当值时长随心跳累计', d.state.daily.onlineMin > 0.1 && d.state.daily.onlineMin < 0.5, `onlineMin=${d.state.daily.onlineMin.toFixed(2)}`);

// 4. 收菜/摸鱼端点已下线
r = await post('/api/game/collect', auth);
check('收菜端点已删(404)', r.status === 404);
r = await post('/api/game/moyu', auth);
check('摸鱼端点已删(404)', r.status === 404);

// 5. 新端点：解锁自动挂档
r = await post('/api/game/quest/select', auth, { tier: 0 });
check('锁档成功', r.status === 200 && (await r.clone().json()).state.questLocked === 0);
r = await post('/api/game/quest/auto', auth);
d = await r.json();
check('恢复自动挂档', r.status === 200 && d.state.questLocked === null);

// 6. 自动开关端点已下线（成长消费全手动，用户决议 2026-08-14）
r = await post('/api/game/settings', auth, { promote: true });
check('settings 端点已删(404)', r.status === 404);

// 7. 晋升/研习手动兜底（经验/薪酬不足被拒）
r = await post('/api/game/promote', auth);
d = await r.json();
check('经验不足晋升被拒(400)', r.status === 400 && /经验未足/.test(d.error), d.error);
r = await post('/api/game/upgrade', auth);
d = await r.json();
check('没钱研习被拒(400)', r.status === 400 && Boolean(d.error), d.error);

// 8. 部门：名册 / 选任 / 功法
r = await fetch(BASE + '/api/game/departments', { headers: auth });
d = await r.json();
const qya = d.departments.find((x) => x.id === 'qianyafang');
check('部门名册 10 房', d.departments.length === 10);
check('签押房功法已改办结速度', /办结速度/.test(qya?.gongfa?.effect ?? ''));
const cya = d.departments.find((x) => x.id === 'chaanyuan');
check('察案院功法已改贡献加成', /贡献/.test(cya?.gongfa?.effect ?? ''));
r = await post('/api/game/choose-dept', auth, { deptId: 'qianyafang' });
d = await r.json();
check('选任签押房成功', r.status === 200 && d.state.dept === 'qianyafang');
r = await post('/api/game/choose-dept', auth, { deptId: 'hufang' });
d = await r.json();
check('改换门庭被拒(400)', r.status === 400 && /出身已定/.test(d.error));

// 8.5 串门子（M5.7）：每日限次、本房/不存在/超限拒绝、轶事下发不携暗线标记
r = await post('/api/game/visit', auth, { deptId: 'qianyafang' });
d = await r.json();
check('本房串门被拒(400)', r.status === 400 && /本房/.test(d.error), d.error);
r = await post('/api/game/visit', auth, { deptId: 'nowhere' });
check('不存在的房串门被拒(400)', r.status === 400);
for (let i = 0; i < 3; i++) {
  r = await post('/api/game/visit', auth, { deptId: 'hufang' });
  d = await r.json();
  check(
    `串门第 ${i + 1} 次成功下发轶事与剩余次数`,
    r.status === 200 && typeof d.visit?.text === 'string' && d.visit.clue === undefined && d.visitsLeft === 2 - i,
    `left=${d.visitsLeft}`
  );
  check(
    `串门第 ${i + 1} 次回礼/惩罚两形态完备（M6.1）`,
    'npcId' in d.visit && 'penalty' in d.visit &&
      (d.gift === null || typeof d.gift === 'object') &&
      (d.loss === null || typeof d.loss.bank === 'number'),
    `gift=${JSON.stringify(d.gift)} loss=${JSON.stringify(d.loss)}`
  );
}
r = await post('/api/game/visit', auth, { deptId: 'hufang' });
d = await r.json();
check('串门超限被拒(400)', r.status === 400 && /脚力/.test(d.error), d.error);

// 9. 差事门槛校验
r = await post('/api/game/quest/select', auth, { tier: 5 });
d = await r.json();
check('办差力不足换档被拒(400)', r.status === 400 && /办差力/.test(d.error));
r = await post('/api/game/quest/auto', auth);
check('解锁回自动', r.status === 200);

// 10. 机巧阁：锻造/强化校验（吃贡献）
r = await post('/api/game/forge', auth, { slot: 'hand' });
d = await r.json();
check('贡献不足锻造被拒(400)', r.status === 400 && /贡献/.test(d.error), d.error);
r = await post('/api/game/forge', auth, { slot: 'noslot' });
check('非法槽位锻造被拒(400)', r.status === 400);
r = await post('/api/game/enhance', auth, { slot: 'hand' });
d = await r.json();
check('空槽强化被拒(400)', r.status === 400 && /尚无法器/.test(d.error));

// 11. 案牍牌领赏校验
r = await post('/api/game/daily/claim', auth);
d = await r.json();
check('差事未办齐领赏被拒(400)', r.status === 400 && /办齐/.test(d.error));

// 12. M5 保留项：仙籍/账册/告示/岔路
r = await fetch(BASE + '/api/game/state', { headers: auth });
d = await r.json();
// 仙籍进度 = 累计贡献/50（串门回礼随机给贡献，故按折算公式断言而非写死 0）
check('仙籍面板', d.xianji?.progress === Math.floor((d.state.contributionTotal ?? 0) / 50) && d.xianji?.threshold === 40 && d.xianji?.frozen === false);
check('心事只有模糊文案', typeof d.xinshi === 'string' && d.xinshi.length > 0);
check('岔路与通透初值', d.fork === null && d.tongtou === 0 && d.wallNotice === null);
r = await fetch(BASE + '/api/game/ledger', { headers: auth });
d = await r.json();
check('新号账册为空', r.status === 200 && d.pages.length === 0 && d.total === 8);
r = await post('/api/game/wall/ack', auth);
d = await r.json();
check('告示回执正常(200)', r.status === 200 && d.wallNotice === null);
r = await post('/api/game/fork/choose', auth, { choice: 'stay' });
d = await r.json();
check('岔路未至不可选(400)', r.status === 400 && /岔路未至/.test(d.error));

// 12.5 M6.5 外差：新号（办差力 10）首登凌霄 + 空背包不可装卸
r = await post('/api/game/ladder/climb', auth);
d = await r.json();
check('新号办差力 10 首登连闯 7 层（前七层门槛皆 10）', r.status === 200 && d.climb?.climbed === 7 && d.realmInfo?.ladderCleared === 7 && d.climb?.contrib > 0, `climbed=${d.climb?.climbed} contrib=${d.climb?.contrib}`);
r = await post('/api/game/ladder/climb', auth);
d = await r.json();
check('第 8 层门槛 11 止步被拒(400)', r.status === 400 && /办差力不济/.test(d.error), d.error);
r = await post('/api/game/ladder/sweep', auth);
d = await r.json();
check('新号扫荡 7 层得 3 贡献', r.status === 200 && d.sweep?.bonus === 3, `bonus=${d.sweep?.bonus}`);
r = await post('/api/game/bag/equip', auth, { idx: 0 });
d = await r.json();
check('空背包装备被拒(400)', r.status === 400 && /没有这件/.test(d.error), d.error);
r = await post('/api/game/bag/sell', auth, { idx: 3 });
d = await r.json();
check('空背包折卖被拒(400)', r.status === 400 && /没有这件/.test(d.error), d.error);

// 13. 持久化：重登后状态仍在
r = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: name, password: '123456' }),
});
const { token: t2 } = await r.json();
r = await fetch(BASE + '/api/game/state', { headers: { Authorization: `Bearer ${t2}` } });
d = await r.json();
check('状态跨会话持久化', d.state.v === 1 && d.state.dept === 'qianyafang' && d.state.bank > 0);

// 13.5 衙门百官录（M6/M6.1）：58 同僚 + 3 传说填榜/降序/拉条/NPC 无徽章/佩戴校验/徽章上榜
// 放在终段：注入知事级办差力会改变账号强弱，避免污染前面门槛类用例
r = await fetch(BASE + '/api/game/leaderboard', { headers: auth });
d = await r.json();
check('榜单 200 且窗口 ≤15 行', r.status === 200 && d.rows.length > 0 && d.rows.length <= 15);
check('总人数 ≥ 62（58 同僚 + 3 传说 + 玩家）', d.total >= 62, `total=${d.total}`);
check('本号落位非空', d.me && d.me.rank >= 1 && typeof d.me.zabanli === 'number');
check('榜内严格降序', d.rows.every((x, i) => i === 0 || d.rows[i - 1].zabanli >= x.zabanli));
check('前 15 里 NPC 占多数（同僚填榜）', d.rows.filter((x) => x.npc).length >= 10);
check('榜首为传说前辈 500', d.rows[0].npc && d.rows[0].legend === true && d.rows[0].zabanli === 500 && d.rows[0].rankName === '传说', `top=${d.rows[0].name}/${d.rows[0].zabanli}`);
check('传说三位全在榜且包揽前三', d.rows.slice(0, 3).every((x) => x.legend === true));
check('NPC 无称号徽章', d.rows.filter((x) => x.npc).every((x) => x.title === null));
check('拉条：榜外/榜内均带上一名信息', d.me.rank === 1 ? d.me.above === null : !!d.me.above && d.me.above.zabanli >= d.me.zabanli && typeof d.me.above.name === 'string', `rank=${d.me.rank}`);
check('百官录每行带凌霄层数字段', d.rows.every((x) => typeof x.floors === 'number'));
r = await post('/api/game/title/wear', auth, { titleId: 'saotong_tongzi' });
d = await r.json();
check('未挣来的称号拒戴(400)', r.status === 400 && /还没挣来/.test(d.error), d.error);
r = await post('/api/game/title/wear', auth, { titleId: null });
d = await r.json();
check('取消佩戴允许(200)', r.status === 200 && d.state.titleWorn === null);
// 注入两枚称号 + 知事满级办差力（300+50+灵品 14 = 364：稳进 top15，永压不过总监 420），
// 并预填洗牌袋 ne12（大惩罚）与串门次数，验证惩罚 loss 实扣
{
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync('d:/niuma/server/data/game.db');
  const acct = db.prepare('SELECT id FROM accounts WHERE username = ?').get(name);
  const row = db.prepare('SELECT payload FROM saves WHERE account_id = ?').get(acct.id);
  const st = JSON.parse(row.payload);
  st.titles = ['saotong_tongzi', 'dishu_kuaishou'];
  st.rank = 6; st.rankLvl = 10; st.gongfaLvl = 10; st.deptGongfaLvl = 10;
  st.gear = { ...st.gear, hand: { name: '灵品·测试笔', slot: 'hand', rarity: 2, lvl: 11, temper: 0 } };
  st.bank = 100000;
  const nd = new Date();
  st.visits = { date: `${nd.getFullYear()}-${nd.getMonth() + 1}-${nd.getDate()}`, left: 3 };
  st.decks = { hufang: { cards: ['ne12'], last: null } };
  const ts = Date.now();
  db.prepare('UPDATE saves SET payload = ?, updated_at = ?, last_seen_at = ? WHERE account_id = ?')
    .run(JSON.stringify(st), ts, ts, acct.id);
  db.close();
}
// M6.1 惩罚实扣：定向抽中 ne12（big），loss = min(bank, rate×180)，只扣余额
r = await post('/api/game/visit', auth, { deptId: 'hufang' });
d = await r.json();
check('惩罚事件定向命中（洗牌袋可持久化）', r.status === 200 && d.visit.id === 'ne12' && d.visit.penalty === 'big' && d.visit.npcId === 'npc12' && d.gift === null);
check('惩罚 loss 实扣且余额保护', d.loss && d.loss.bank > 0 && d.state.bank <= 100000 + 200 && d.state.bank >= 100000 - d.loss.bank - 200, `loss=${d.loss?.bank} bank=${d.state.bank.toFixed(0)}`);
r = await post('/api/game/title/wear', auth, { titleId: 'saotong_tongzi' });
d = await r.json();
check('持有称号佩戴成功', r.status === 200 && d.state.titleWorn === 'saotong_tongzi');
r = await fetch(BASE + '/api/game/leaderboard', { headers: auth });
d = await r.json();
const meRow = d.rows.find((x) => x.id === `player:${name}`);
check('佩戴后徽章上榜（在 top15 内）', d.me.inTop === true && !!meRow && meRow.title === '洒扫童子', meRow?.title);
check('注入号稳进 top15 但永压不过总监', !!meRow && meRow.zabanli > 330 && meRow.zabanli < 420, `z=${meRow?.zabanli}`);
r = await post('/api/game/title/wear', auth, { titleId: null });
check('取消佩戴成功', r.status === 200);
r = await fetch(BASE + '/api/game/leaderboard', { headers: auth });
d = await r.json();
const meRow2 = d.rows.find((x) => x.id === `player:${name}`);
check('取消佩戴后徽章回退最新一枚', !!meRow2 && meRow2.title === '递书快手', meRow2?.title);

// 13.7 M6.5 注入号（办差力约 364）：冲阵/扫荡/夜值失败零惩罚/背包装卸与满员折卖
{
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync('d:/niuma/server/data/game.db');
  const acct = db.prepare('SELECT id FROM accounts WHERE username = ?').get(name);
  const row = db.prepare('SELECT payload FROM saves WHERE account_id = ?').get(acct.id);
  const st = JSON.parse(row.payload);
  const nd = new Date();
  const today = `${nd.getFullYear()}-${nd.getMonth() + 1}-${nd.getDate()}`;
  st.realm = { date: today, patrolLeft: 3, nightLeft: 3, nightAffix: 'fengping', affixBag: null, solvedTotal: 0 };
  st.ladder = { cleared: 0, sweptDate: null };
  st.bag = [];
  // 通档抬到第 8 档：夜值门槛 = round(370×1.15) = 425 > 办差力 364，失败零惩罚用例确定成立
  st.questBest = 8;
  const ts = Date.now();
  db.prepare('UPDATE saves SET payload = ?, updated_at = ?, last_seen_at = ? WHERE account_id = ?')
    .run(JSON.stringify(st), ts, ts, acct.id);
  db.close();
}
r = await post('/api/game/ladder/climb', auth);
d = await r.json();
const cleared1 = d.realmInfo?.ladderCleared ?? 0;
check('注入号一键冲阵连闯数百层', r.status === 200 && d.climb?.climbed > 200 && cleared1 === d.climb.cleared, `cleared=${cleared1} z=${d.zabanli}`);
check('冲阵里程碑授号（百阶/半山）', d.state.titles.includes('baijie_xingzhe') && d.state.titles.includes('banshan_tingfeng') && !d.state.titles.includes('lingxiao_jueding'));
check('冲阵后下一层门槛与办差力对齐', d.realmInfo.ladderNextNeed > d.zabanli && d.realmInfo.ladderSwept === false, `next=${d.realmInfo.ladderNextNeed}`);
r = await post('/api/game/ladder/climb', auth);
d = await r.json();
check('冲阵止步再冲被拒(400)', r.status === 400 && /办差力不济/.test(d.error), d.error);
r = await post('/api/game/ladder/sweep', auth);
d = await r.json();
check('扫荡按已通层折贡献', r.status === 200 && d.sweep?.bonus === Math.floor(cleared1 * 0.5) && d.realmInfo?.ladderSwept === true, `bonus=${d.sweep?.bonus}`);
r = await post('/api/game/ladder/sweep', auth);
d = await r.json();
check('同日重复扫荡被拒(400)', r.status === 400 && /已扫/.test(d.error), d.error);
// 百官录·凌霄阶 tab：层数降序（同层以办差力先后），传说绝顶 1000，玩家层数 = 实际登阶
r = await fetch(BASE + '/api/game/leaderboard?by=floors', { headers: auth });
d = await r.json();
check('凌霄阶榜层数降序（同层以办差力先后）', r.status === 200 && d.rows.every((row, i) => i === 0 || d.rows[i - 1].floors > row.floors || (d.rows[i - 1].floors === row.floors && d.rows[i - 1].zabanli >= row.zabanli)));
check('凌霄阶榜传说包揽绝顶 1000 层', d.rows.slice(0, 3).every((x) => x.legend === true && x.floors === 1000));
check('凌霄阶榜玩家层数 = 实际登阶 838', d.me.floors === 838 && d.me.rank >= 4, `floors=${d.me.floors} rank=${d.me.rank}`);
check('凌霄阶榜拉条带层数口径', d.me.rank === 1 ? d.me.above === null : typeof d.me.above?.floors === 'number' && d.me.above.floors >= d.me.floors, JSON.stringify(d.me.above));
r = await post('/api/game/realm/night', auth);
d = await r.json();
check('夜值悬案未达标失败零惩罚(200/win=false，不倒扣)', r.status === 200 && d.night?.win === false && d.night?.need > d.zabanli && d.realmInfo?.nightLeft === 2 && d.realmInfo?.solvedTotal === 0, `need=${d.night?.need} z=${d.zabanli}`);
// 满员背包：新例巡掉落径直折卖 40 贡献
{
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync('d:/niuma/server/data/game.db');
  const acct = db.prepare('SELECT id FROM accounts WHERE username = ?').get(name);
  const row = db.prepare('SELECT payload FROM saves WHERE account_id = ?').get(acct.id);
  const st = JSON.parse(row.payload);
  st.bag = Array.from({ length: 12 }, (_, i) => ({ name: `凡品·压包${i}`, slot: 'hand', rarity: 1, lvl: 1, temper: 0 }));
  const ts = Date.now();
  db.prepare('UPDATE saves SET payload = ?, updated_at = ?, last_seen_at = ? WHERE account_id = ?')
    .run(JSON.stringify(st), ts, ts, acct.id);
  db.close();
}
r = await post('/api/game/realm/patrol', auth);
d = await r.json();
check('例巡一键结算贡献薪酬入账', r.status === 200 && d.patrol?.contrib >= 20 && d.patrol?.salary >= 0, `contrib=${d.patrol?.contrib} salary=${d.patrol?.salary}`);
check('满员掉落径直折卖 40 贡献（邸报一句当了）', !d.patrol.drop || (d.patrol.drop.sold === true && d.patrol.drop.value === 40 && d.state.bag.length === 12), JSON.stringify(d.patrol.drop));
// 装卸往返与折卖：注入两件测试法器
{
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync('d:/niuma/server/data/game.db');
  const acct = db.prepare('SELECT id FROM accounts WHERE username = ?').get(name);
  const row = db.prepare('SELECT payload FROM saves WHERE account_id = ?').get(acct.id);
  const st = JSON.parse(row.payload);
  st.bag = [
    { name: '灵品·试剑', slot: 'hand', rarity: 2, lvl: 5, temper: 0 },
    { name: '凡品·试盾', slot: 'shield', rarity: 1, lvl: 1, temper: 0 },
  ];
  const ts = Date.now();
  db.prepare('UPDATE saves SET payload = ?, updated_at = ?, last_seen_at = ? WHERE account_id = ?')
    .run(JSON.stringify(st), ts, ts, acct.id);
  db.close();
}
r = await post('/api/game/bag/equip', auth, { idx: 0 });
d = await r.json();
check('背包装备入槽，旧件回背包', r.status === 200 && d.equipped?.name === '灵品·试剑' && d.state.gear.hand?.name === '灵品·试剑' && d.returned?.name === '灵品·测试笔' && d.state.bag.some((x) => x.name === '灵品·测试笔'), JSON.stringify({ eq: d.equipped?.name, ret: d.returned?.name }));
r = await post('/api/game/bag/equip', auth, { idx: 99 });
d = await r.json();
check('越界 idx 装备被拒(400)', r.status === 400 && /没有这件/.test(d.error));
r = await fetch(BASE + '/api/game/state', { headers: auth });
d = await r.json();
const sellIdx = d.state.bag.findIndex((x) => x.name === '灵品·测试笔');
r = await post('/api/game/bag/sell', auth, { idx: sellIdx });
d = await r.json();
check('折卖 = 底值一半 + 强化等级（灵品+10 → 12）', r.status === 200 && d.soldValue === 12 && !d.state.bag.some((x) => x.name === '灵品·测试笔'), `sold=${d.soldValue}`);

// 14. 旧档迁移（M5 之前格式 → M5.5）：直接注入旧格式存档验证
{
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync('d:/niuma/server/data/game.db');
  const migName = 'mig55_' + (Date.now() % 1e9);
  let rr = await fetch(BASE + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: migName, password: '123456' }),
  });
  const { token: mt } = await rr.json();
  const acct = db.prepare('SELECT id FROM accounts WHERE username = ?').get(migName);
  const legacy = {
    v: 1,
    bank: 50,
    pool: 123.7, // 收菜篮余额 → 应全额入账
    materials: 5, // 灵材 → 1:4 折算贡献
    totalEarned: 200,
    xinli: 100,
    rank: 1,
    gongfaLvl: 2,
    dept: 'hufang',
    deptGongfaLvl: 1,
    gear: { hand: { name: '旧·朱笔', slot: 'hand', rarity: 2, lvl: 25 }, shield: null, soul: null, craft: null }, // 超新上限
    questTier: 2,
    questProgress: 0,
    questBest: 2,
    questCount: 30,
    daily: { date: '2026-1-1', collect: 2, moyu: 1, claimed: false }, // 旧口径案牍牌
    xianjiStage: 0, huanmie: 0, ledger: 0, fork: null, tongtou: 0, wallNotice: null,
    createdAt: Date.now() - 86400000,
    lastTickAt: Date.now(),
  };
  const ts = Date.now();
  db.prepare('INSERT INTO saves (account_id, payload, updated_at, last_seen_at) VALUES (?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET payload = excluded.payload')
    .run(acct.id, JSON.stringify(legacy), ts, ts);
  db.close();

  rr = await fetch(BASE + '/api/game/state', { headers: { Authorization: `Bearer ${mt}` } });
  d = await rr.json();
  const s = d.state;
  check('迁移：收菜篮全额入账', s.bank >= 50 + 123 && s.bank < 50 + 123 + 5, `bank=${s.bank.toFixed(1)}`);
  check('迁移：灵材 1:4 折算贡献', s.contribution === 20 && s.contributionTotal === 20, `contrib=${s.contribution}`);
  check('迁移：强化等级钳到 +20', s.gear.hand.lvl === 20);
  check('迁移：案牍牌换今日新结构', s.daily.collect === undefined && s.daily.quest === 0 && typeof s.daily.onlineMin === 'number');
  check('迁移：一次性标志', s.migrated55 === true);
  check('迁移：职级十级制补齐（rankLvl=1/rankExp≈0，无 auto 字段）', s.rankLvl === 1 && s.rankExp < 1 && s.auto === undefined, `rankExp=${s.rankExp}`);
  check('迁移：其余进度保留（存档不作废）', s.rank === 1 && s.gongfaLvl === 2 && s.dept === 'hufang' && s.questBest === 2 && s.questCount === 30);
  check('迁移 M6.5：realm/ladder/bag 默认值补齐', Array.isArray(s.bag) && s.bag.length === 0 && s.ladder?.cleared === 0 && d.realmInfo?.patrolLeft === 3 && d.realmInfo?.nightLeft === 3 && !!d.realmInfo?.affix, JSON.stringify(d.realmInfo));
  check('迁移 M6.8：邸报字段补齐（旧档零迁移）', Array.isArray(s.events) && s.evReadTs === 0 && s.pendingSpecial === null && (s.evDay === null || typeof s.evDay === 'object'), JSON.stringify({ evReadTs: s.evReadTs, pendingSpecial: s.pendingSpecial }));
}

// 15. M6.8 邸报：定向事件下发 + events/ack 已读水位
{
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync('d:/niuma/server/data/game.db');
  const acct = db.prepare('SELECT id FROM accounts WHERE username = ?').get(name);
  const row = db.prepare('SELECT payload FROM saves WHERE account_id = ?').get(acct.id);
  const st = JSON.parse(row.payload);
  const nd = new Date();
  const today = `${nd.getFullYear()}-${nd.getMonth() + 1}-${nd.getDate()}`;
  // 塞一条过期 nextAt 的袋顶 contrib 事件：下一次心跳必发
  st.evDay = { date: today, cap: 4, cards: ['g_laojie'], nextAt: 1 };
  st.evReadTs = 0;
  const ts = Date.now();
  db.prepare('UPDATE saves SET payload = ?, updated_at = ?, last_seen_at = ? WHERE account_id = ?')
    .run(JSON.stringify(st), ts, ts, acct.id);
  db.close();

  r = await fetch(BASE + '/api/game/state', { headers: auth });
  d = await r.json();
  const giftEv = d.state.events.find((e) => e.type === 'gift' && /贡献 \+6/.test(e.text));
  check('M6.8 心跳到点下发事件并入账', r.status === 200 && !!giftEv, JSON.stringify(d.state.events[0]));
  check('M6.8 未读红点口径（事件 ts > evReadTs）', !!giftEv && d.state.evReadTs < giftEv.ts);

  const before = d.state.evReadTs;
  r = await post('/api/game/events/ack', auth);
  d = await r.json();
  check('M6.8 events/ack 推平已读水位', r.status === 200 && d.state.evReadTs > before && d.state.evReadTs >= giftEv.ts, `evReadTs=${d.state.evReadTs}`);
  check('M6.8 调度字段随 state 下发', d.state.evDay?.date === today && d.state.pendingSpecial === null && d.state.evDay.cap === 3, JSON.stringify(d.state.evDay));
}

// 16. M7 转生二周目：守卫 / 留任转生 / 传家槽佩戴 / fork leave 全流程 / 大事件管线
{
  const { DatabaseSync } = await import('node:sqlite');
  const inject = async (mut) => {
    const db = new DatabaseSync('d:/niuma/server/data/game.db');
    const acct = db.prepare('SELECT id FROM accounts WHERE username = ?').get(name);
    const row = db.prepare('SELECT payload FROM saves WHERE account_id = ?').get(acct.id);
    const st = JSON.parse(row.payload);
    mut(st);
    const ts = Date.now();
    db.prepare('UPDATE saves SET payload = ?, updated_at = ?, last_seen_at = ? WHERE account_id = ?')
      .run(JSON.stringify(st), ts, ts, acct.id);
    db.close();
  };

  check('config M7 神器五特征词条表下发', cfg.heirloomTraits?.andu_deep?.name === '案牍深' && cfg.heirloomTraits?.balanced?.kind === 'salary' && Object.keys(cfg.heirloomTraits).length === 5);

  // 16.1 守卫：fork 非 chose_stay 调 rebirth 被拒
  await inject((st) => { st.fork = null; });
  r = await post('/api/game/rebirth', auth);
  d = await r.json();
  check('M7 守卫：交接文书还没备好(400)', r.status === 400 && d.error === '交接文书还没备好', d.error);

  // 16.2 留任转生：新档形态 + 邸报 milestone
  await inject((st) => {
    st.fork = 'chose_stay';
    st.bank = 88888;
    st.stats = { quest: 900, enhance: 0, patrol: 0, night: 0, visit: 0 };
  });
  r = await post('/api/game/rebirth', auth);
  d = await r.json();
  check('M7 留任转生 200 + 铸词案牍深 +3%', r.status === 200 && d.rebirth?.ok === true && d.rebirth.heirloom?.trait === 'andu_deep' && d.rebirth.heirloom?.value === 3, JSON.stringify(d.rebirth?.heirloom));
  check('M7 转生后周目与资历递增', d.state.loop === 2 && d.state.seniority === 1);
  check('M7 转生后资源清零、功法 Lv2 起步、dept 不变', d.state.bank === 0 && d.state.deptGongfaLvl === 2 && d.state.dept === 'qianyafang' && d.state.fork === null);
  check('M7 神器入收藏未佩戴', d.state.heirlooms?.length === 1 && d.state.heirloomWorn === null);
  check('M7 邸报转生 milestone', d.state.events?.length === 1 && d.state.events[0].type === 'milestone' && d.state.events[0].text.includes('交接'), d.state.events?.[0]?.text);
  check('M7 stats 转生后清零', Object.values(d.state.stats).every((v) => v === 0), JSON.stringify(d.state.stats));

  // 16.3 传家槽佩戴与越权拒绝
  r = await post('/api/game/heirloom/wear', auth, { id: 'heirloom_1' });
  d = await r.json();
  check('M7 传家槽佩戴成功', r.status === 200 && d.state.heirloomWorn === 'heirloom_1');
  r = await post('/api/game/heirloom/wear', auth, { id: 'heirloom_99' });
  check('M7 越权佩戴被拒(400)', r.status === 400);
  r = await post('/api/game/heirloom/wear', auth, { id: null });
  d = await r.json();
  check('M7 卸下成功', r.status === 200 && d.state.heirloomWorn === null);

  // 16.4 fork leave 全流程：辞官转生 → 失忆选任 → 前世余荫一次性
  await inject((st) => { st.fork = 'pending'; });
  r = await post('/api/game/fork/choose', auth, { choice: 'leave' });
  d = await r.json();
  check('M7 fork leave 转生成功（第二件神器 +4%）', r.status === 200 && d.rebirth?.heirloom?.value === 4 && d.state.dept === null && d.state.loop === 3 && d.state.seniority === 2, JSON.stringify(d.rebirth?.heirloom));
  check('M7 辞官号 legacyBoon 置位', d.state.legacyBoon === true);
  r = await post('/api/game/choose-dept', auth, { deptId: 'lifang' });
  d = await r.json();
  check('M7 选任成功发前世余荫（资历 2 → ×1.2 ≈ 120 经验）', r.status === 200 && d.state.legacyBoon === false && d.state.rankExp > 119 && d.state.rankExp < 130, `rankExp=${d.state.rankExp?.toFixed(1)}`);
  check('M7 余荫邸报一条', d.state.events?.some((e) => e.type === 'milestone' && e.text.includes('前世余荫')));

  // 16.5 大事件管线：pendingSpecial 注入后随 state 原样下发（M7.5 投放复用位）
  await inject((st) => { st.pendingSpecial = '监正争夺战即将开启'; });
  r = await fetch(BASE + '/api/game/state', { headers: auth });
  d = await r.json();
  check('M7 pendingSpecial 注入管线可用', d.state.pendingSpecial === '监正争夺战即将开启');
  await inject((st) => { st.pendingSpecial = null; }); // 清场，不留脏状态
}

// 17. M7.6 凌霄阶攻略感：限量登阶 + 逐层文案 + 冲阵精选（数值口径零改动）
{
  const { DatabaseSync } = await import('node:sqlite');
  const inject = async (mut) => {
    const db = new DatabaseSync('d:/niuma/server/data/game.db');
    const acct = db.prepare('SELECT id FROM accounts WHERE username = ?').get(name);
    const row = db.prepare('SELECT payload FROM saves WHERE account_id = ?').get(acct.id);
    const st = JSON.parse(row.payload);
    mut(st);
    const ts = Date.now();
    db.prepare('UPDATE saves SET payload = ?, updated_at = ?, last_seen_at = ? WHERE account_id = ?')
      .run(JSON.stringify(st), ts, ts, acct.id);
    db.close();
  };
  // 17.1 当前号（转生后办差力 10）登一层：下发第 1 层文案
  r = await post('/api/game/ladder/climb', auth, { count: 1 });
  d = await r.json();
  check('M7.6 登一层成功且下发文案', r.status === 200 && d.climb?.climbed === 1 && d.climb.lines?.length === 1 && d.climb.lines[0].floor === 1 && d.climb.lines[0].text.length > 0, JSON.stringify(d.climb?.lines));
  // 17.2 连闯十层被办差力截断（z=10 止于第 7 层），≤10 层文案全量
  r = await post('/api/game/ladder/climb', auth, { count: 10 });
  d = await r.json();
  check('M7.6 count=10 止步第 7 层且文案全量', r.status === 200 && d.climb?.climbed === 6 && d.climb.lines?.length === 6 && d.climb.cleared === 7, `climbed=${d.climb?.climbed} lines=${d.climb?.lines?.length}`);
  // 17.3 止步后守卫不变
  r = await post('/api/game/ladder/climb', auth, { count: 1 });
  d = await r.json();
  check('M7.6 办差力不济登一层同样被拒(400)', r.status === 400 && /办差力不济/.test(d.error), d.error);
  // 17.4 count 上限钳制：999 → 20，>10 层走精选（首层 + 末两层）
  await inject((st) => {
    st.ladder.cleared = 0;
    st.rank = 6; st.rankLvl = 10; st.gongfaLvl = 10; st.deptGongfaLvl = 10;
    st.gear = {
      hand: { name: '巧', slot: 'hand', rarity: 4, lvl: 20, temper: 0 },
      shield: { name: '巧', slot: 'shield', rarity: 4, lvl: 20, temper: 0 },
      soul: { name: '巧', slot: 'soul', rarity: 4, lvl: 20, temper: 0 },
      craft: { name: '巧', slot: 'craft', rarity: 4, lvl: 20, temper: 0 },
    };
  });
  r = await post('/api/game/ladder/climb', auth, { count: 999 });
  d = await r.json();
  const floors20 = (d.climb?.lines ?? []).map((l) => l.floor);
  check('M7.6 count 钳到 20 且 >10 层精选下发', r.status === 200 && d.climb?.climbed === 20 && floors20.join(',') === '1,19,20', `climbed=${d.climb?.climbed} floors=${floors20.join(',')}`);
  // 17.5 满配冲阵千层：战报精选 = 首层 + 三里程碑 + 末两层
  await inject((st) => { st.ladder.cleared = 0; });
  r = await post('/api/game/ladder/climb', auth);
  d = await r.json();
  const floors = (d.climb?.lines ?? []).map((l) => l.floor);
  check('M7.6 冲阵通千层', r.status === 200 && d.climb?.cleared === 1000);
  check('M7.6 冲阵战报精选 5 句（1/100/500/999/1000）', floors.join(',') === '1,100,500,999,1000', floors.join(','));
  check('M7.6 里程碑定句下发', d.climb.lines.find((l) => l.floor === 500)?.text.includes('半山听风'));
  // 清场：还给测试号一个干净天梯
  await inject((st) => { st.ladder.cleared = 0; st.ladder.sweptDate = null; });
}

// 18. M7.5 监正争夺战：开议门槛（二周目+榜前五）/三场叙事战/败零惩罚/讽刺留白结局
{
  const { DatabaseSync } = await import('node:sqlite');
  const inject = async (mut) => {
    const db = new DatabaseSync('d:/niuma/server/data/game.db');
    const acct = db.prepare('SELECT id FROM accounts WHERE username = ?').get(name);
    const row = db.prepare('SELECT payload FROM saves WHERE account_id = ?').get(acct.id);
    const st = JSON.parse(row.payload);
    mut(st);
    const ts = Date.now();
    db.prepare('UPDATE saves SET payload = ?, updated_at = ?, last_seen_at = ? WHERE account_id = ?')
      .run(JSON.stringify(st), ts, ts, acct.id);
    db.close();
  };
  const maxGear = {
    hand: { name: '巧', slot: 'hand', rarity: 4, lvl: 20, temper: 0 },
    shield: { name: '巧', slot: 'shield', rarity: 4, lvl: 20, temper: 0 },
    soul: { name: '巧', slot: 'soul', rarity: 4, lvl: 20, temper: 0 },
    craft: { name: '巧', slot: 'craft', rarity: 4, lvl: 20, temper: 0 },
  };
  check('config M7.5 候选与称号 id 下发', Array.isArray(cfg.jianzhengCandidates) && cfg.jianzhengCandidates.length === 3 && cfg.jianzhengTitleId === 'jianzheng_zhengduo');

  // 18.1 注入二周目满配号，心跳即开议：金标告示 + 邸报预告
  await inject((st) => {
    st.jianzheng = null; st.pendingSpecial = null;
    st.loop = 2;
    st.rank = 6; st.rankLvl = 10; st.gongfaLvl = 10; st.deptGongfaLvl = 10;
    st.gear = maxGear;
  });
  r = await fetch(BASE + '/api/game/state', { headers: auth });
  d = await r.json();
  check('M7.5 二周目+榜前五开议（金标告示挂上）', r.status === 200 && /择能者试之/.test(d.state.pendingSpecial ?? '') && d.state.jianzheng && d.state.jianzheng.done === false, d.state.pendingSpecial);
  check('M7.5 邸报金标预告一条', d.state.events?.some((e) => e.type === 'milestone' && /择能者试监正之位/.test(e.text)));

  // 18.2 低办差力落败：零惩罚可再战
  await inject((st) => { st.rank = 0; st.rankLvl = 1; st.gongfaLvl = 0; st.deptGongfaLvl = 0; st.gear = { hand: null, shield: null, soul: null, craft: null }; });
  r = await post('/api/game/jianzheng/fight', auth, { candidateId: 'yunzhang' });
  d = await r.json();
  check('M7.5 低办差力落败零惩罚可再战', r.status === 200 && d.fight?.win === false && !d.fight?.finale && /败不要紧/.test(d.fight?.text ?? '') && !d.state.jianzheng.wins.yunzhang);

  // 18.3 满配三场全胜：授号 + 轻奖 + 告示摘除 + 结案
  await inject((st) => { st.rank = 6; st.rankLvl = 10; st.gongfaLvl = 10; st.deptGongfaLvl = 10; st.gear = maxGear; });
  r = await post('/api/game/jianzheng/fight', auth, { candidateId: 'yunzhang' });
  d = await r.json();
  check('M7.5 首场胜（云章主事）', r.status === 200 && d.fight?.win === true && d.state.jianzheng.wins.yunzhang === true && !d.fight.finale);
  r = await post('/api/game/jianzheng/fight', auth, { candidateId: 'yunzhang' });
  d = await r.json();
  check('M7.5 已胜场次重复对局被拒(400)', r.status === 400 && /已赢过/.test(d.error), d.error);
  r = await post('/api/game/jianzheng/fight', auth, { candidateId: 'zhisuan' });
  check('M7.5 第二场胜（执算主事）', r.status === 200);
  r = await post('/api/game/jianzheng/fight', auth, { candidateId: 'chilv' });
  d = await r.json();
  check('M7.5 第三场全胜开留白结局', r.status === 200 && d.fight?.win === true && /容后再议/.test(d.fight?.finale ?? ''), d.fight?.finale);
  check('M7.5 结案：授号+告示摘除+done 置位', d.state.jianzheng.done === true && d.state.pendingSpecial === null && d.state.titles.includes(cfg.jianzhengTitleId));
  r = await post('/api/game/jianzheng/fight', auth, { candidateId: 'chilv' });
  d = await r.json();
  check('M7.5 结案后对局被拒(400)', r.status === 400 && /此案已结/.test(d.error), d.error);

  // 清场：摘掉争夺战状态，并把号压回低配（防满配滞留号污染后续跑的榜单 top15 窗口）
  await inject((st) => {
    st.jianzheng = null; st.pendingSpecial = null;
    st.rank = 0; st.rankLvl = 1; st.gongfaLvl = 0; st.deptGongfaLvl = 0;
    st.gear = { hand: null, shield: null, soul: null, craft: null };
  });
}

// 19. M9.5 博士支线回收「灯下」：/lamp 集齐判定/授号/幂等
{
  const { DatabaseSync } = await import('node:sqlite');
  const inject = async (mut) => {
    const db = new DatabaseSync('d:/niuma/server/data/game.db');
    const acct = db.prepare('SELECT id FROM accounts WHERE username = ?').get(name);
    const row = db.prepare('SELECT payload FROM saves WHERE account_id = ?').get(acct.id);
    const st = JSON.parse(row.payload);
    mut(st);
    const ts = Date.now();
    db.prepare('UPDATE saves SET payload = ?, updated_at = ?, last_seen_at = ? WHERE account_id = ?')
      .run(JSON.stringify(st), ts, ts, acct.id);
    db.close();
  };
  check('config M9.5 线索全集与原文下发', Array.isArray(cfg.lampClues) && cfg.lampClues.length === 4 && Array.isArray(cfg.lampClueTexts) && cfg.lampClueTexts.length === 4 && cfg.lampClueTexts.every((t) => t.length > 0));

  // 19.1 线索不齐被拒(400)
  await inject((st) => { st.clues = ['bs1']; st.lampDone = false; });
  r = await post('/api/game/lamp', auth, {});
  d = await r.json();
  check('M9.5 线索不齐被拒(400)', r.status === 400 && /还没拼成一条路/.test(d.error), d.error);

  // 19.2 注入四条线索 → 回收成功：授号「灯下同行」+ 邸报留痕
  await inject((st) => { st.clues = [...cfg.lampClues]; });
  r = await post('/api/game/lamp', auth, {});
  d = await r.json();
  check('M9.5 集齐回收授号「灯下同行」', r.status === 200 && d.already === false && d.state.lampDone === true && d.state.titles.includes('dengxia_tongxing'));
  check('M9.5 邸报授号留痕', d.state.events?.some((e) => e.type === 'milestone' && /灯下同行/.test(e.text)));

  // 19.3 幂等：重复回收返回 already，称号不重发
  r = await post('/api/game/lamp', auth, {});
  d = await r.json();
  check('M9.5 幂等重复回收返回 already', r.status === 200 && d.already === true && d.state.titles.filter((t) => t === 'dengxia_tongxing').length === 1);

  // 清场：摘掉支线痕迹（账号稍后统一清理，这里先还原干净态）
  await inject((st) => { st.clues = []; st.lampDone = false; st.titles = (st.titles ?? []).filter((t) => t !== 'dengxia_tongxing'); });
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
