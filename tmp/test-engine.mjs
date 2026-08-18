// M5.5 引擎全量回归：两线资源/离线封顶/全自动/首办里程碑/游刃有余/
// 强化20级+淬炼/锻造保底/案牍牌自动里程碑/三房功法修正/邸报地基
import * as engine from '../server/src/game/engine.js';
import { BALANCE, OFFLINE_CAP_MS, RANKS, RANK_EXP, rankLevelNeed, rankMultOf, RANK_Z_BASE } from '../server/src/game/config.js';
import { QUESTS, dailyTargets, dailyReward, firstBonusOf, emptyDaily, todayStr } from '../server/src/game/quests.js';
import { enhanceCost, enhanceFailRate, MAX_ENHANCE, FORGE_COST, gearPower, gearTotalPower } from '../server/src/game/gear.js';
import { QUEST_TITLES, TITLE_BONUS_PER, titleBonuses, EXTRA_TITLES, ALL_TITLES, TITLE_WORDS } from '../server/src/game/titles.js';
import { HUANMIE_PER_DAY } from '../server/src/game/xianji.js';
import { COLLEAGUES, NPCS, LEGENDS, npcZabanli } from '../server/src/game/npcs.js';
import { NPC_EVENTS, visitPoolOf, drawDeckEvent } from '../server/src/game/npcevents.js';
import {
  REALM_PER_DAY,
  LADDER_FLOORS,
  ladderNeed,
  ladderFirstBonus,
  ladderSweepBonus,
  NIGHT_AFFIXES,
  patrolContrib,
  nightContrib,
  BAG_MAX,
  BAG_OVERFLOW_SELL,
} from '../server/src/game/realm.js';
import { ladderFloorOfZ } from '../server/src/game/realm.js';
import { judgeTrait, heirloomValue, heirloomBonusOf, HEIRLOOM_TRAITS } from '../server/src/game/heirlooms.js';
import { LADDER_LINES, LADDER_MILESTONE_LINES, pickLadderLine } from '../server/src/game/ladderLines.js';
import { VISITS_PER_DAY, LAMP_CLUES } from '../server/src/game/visits.js';
import { DAILY_EVENTS, EV_COMMON_COUNT, EV_DEPT_COUNT, EV_NPC_COUNT, EV_TOTAL_COUNT, EV_NEED_CHECKS, initEvDay, tickDailyEvents } from '../server/src/game/events.js';
import { DEPARTMENTS } from '../server/src/game/departments.js';
import {
  JIANZHENG_CANDIDATES,
  JIANZHENG_SPECIAL_TEXT,
  JIANZHENG_TITLE_ID,
  JIANZHENG_FINAL_CONTRIB,
  jianzhengBoardRank,
} from '../server/src/game/jianzheng.js';

let pass = 0;
let fail = 0;
const failures = [];
function ok(cond, name) {
  if (cond) pass++;
  else {
    fail++;
    failures.push(name);
    console.log('FAIL:', name);
  }
}
function eq(got, want, name) {
  const good =
    typeof want === 'number' && typeof got === 'number'
      ? Math.abs(got - want) < 1e-6
      : Object.is(got, want);
  if (!good) console.log(`  got=${got} want=${want}`);
  ok(good, name);
}

const NOW = Date.now();
const TICK = 30 * 1000; // 在线 grace 内的单次心跳
const fresh = () => engine.defaultState(NOW);
const tick = (s, ms = TICK) => engine.advance(s, s.lastTickAt + ms);

// ---------- A. 初始档形态 ----------
{
  const s = fresh();
  eq(s.bank, 0, 'A1 初始薪酬为 0');
  eq(s.contribution, 0, 'A2 初始贡献为 0');
  eq(s.contributionTotal, 0, 'A3 初始累计贡献为 0');
  ok(s.auto === undefined, 'A4 新档无 auto 开关字段（成长消费全手动）');
  eq(s.rankLvl, 1, 'A4b 官职初始 Lv1');
  eq(s.rankExp, 0, 'A4c 初始职级经验为 0');
  ok(Array.isArray(s.events) && s.events.length === 0, 'A5 邸报日志初始为空');
  eq(s.questLocked, null, 'A6 差事默认不锁档');
  eq(s.questBest, -1, 'A7 未办结任何差事');
  eq(s.forgePity, 0, 'A8 锻造保底计数为 0');
  eq(s.titleWorn, null, 'A9 初始未佩戴称号（回退最新获得）');
  ok(s.decks && typeof s.decks === 'object' && Object.keys(s.decks).length === 0, 'A10 洗牌袋 decks 初始为空');
}

// ---------- B. 邸报日志 pushEvent ----------
{
  const s = fresh();
  for (let i = 0; i < 25; i++) engine.pushEvent(s, { type: 't', text: `e${i}` });
  eq(s.events.length, 20, 'B1 邸报只留 20 条');
  eq(s.events[0].text, 'e24', 'B2 新事件置顶');
  ok(typeof s.events[0].ts === 'number', 'B3 事件带时间戳');
}

// ---------- C. 薪酬逐秒入账（无篮子） ----------
{
  const s = fresh();
  tick(s);
  eq(s.bank, BALANCE.salaryPerMin * 0.5, 'C1 在线 30 秒薪酬直接入余额');
  eq(s.totalEarned, s.bank, 'C2 累计薪酬同步');
  eq(s.daily.onlineMin, 0.5, 'C3 心跳分钟进案牍牌');
}

// ---------- D. 办差力与游刃有余 ----------
{
  const s = fresh();
  eq(engine.zabanliOf(s), 10, 'D1 帮闲基础办差力 10');
  s.gongfaLvl = 2;
  eq(engine.zabanliOf(s), 20, 'D2 功法每级 +5 办差力');
  eq(engine.speedBonusOf(s), 0.5, 'D3 战力 2 倍门槛 → 提速封顶 50%');
  s.dept = 'qianyafang';
  s.deptGongfaLvl = 2;
  eq(engine.speedBonusOf(s), 0.6, 'D4 签押房乡音诀叠加办结速度');
  s.deptGongfaLvl = 30;
  eq(engine.speedBonusOf(s), 1.5, 'D5 总提速封顶 150%');
  const p = fresh();
  p.gongfaLvl = 2;
  tick(p);
  eq(p.questProgress, 0.5 * 1.5, 'D6 差事进度按 1+提速 累积');
  // M6.1 数值重定：倍率表只驱动产出，办差力走锚点插值
  eq(RANKS.map((r) => r.mult).join(','), '1,1.5,2.2,3.2,4.6,7,15', 'D7 职级倍率新表（仅驱动产出）');
  eq(RANK_Z_BASE.join(','), '10,35,55,80,115,175,300', 'D8 办差力锚点新表');
  const gz = fresh();
  gz.rank = 6;
  gz.rankLvl = 10;
  eq(engine.zabanliOf(gz), 300, 'D9 知事满裸值 300');
  gz.gongfaLvl = 10;
  gz.dept = 'qianyafang';
  gz.deptGongfaLvl = 10;
  eq(engine.zabanliOf(gz), 350, 'D10 毕业裸体 350（职级 300 + 功法贡献封顶 50）');
  ok(engine.zabanliOf(gz) < QUESTS[9].req, 'D11 裸体摸不到顶档，须装备补差');
}

// ---------- E. 差事办结：两线结算 + 首办里程碑 ----------
{
  const s = fresh();
  for (let i = 0; i < 6; i++) tick(s); // 6×30 秒 = 3 分钟，办结「洒扫庭除」
  eq(s.questCount, 1, 'E1 办结 1 件');
  eq(s.bank, BALANCE.salaryPerMin * 3 + QUESTS[0].salary, 'E2 工位薪酬 + 差事薪酬分账入账');
  eq(s.contribution, QUESTS[0].contrib + firstBonusOf(0), 'E3 贡献 = 常规 + 首办 20 倍');
  eq(s.contributionTotal, s.contribution, 'E4 累计贡献同步（仙籍原料）');
  ok(s.questFirsts.includes(0), 'E5 首办里程碑记录');
  eq(s.titles[0], QUEST_TITLES[0].id, 'E6 首办授号');
  eq(s.questBest, 0, 'E7 最高通档更新');
  eq(s.events[0].type, 'milestone', 'E8 首办进邸报');
  ok(s.events[0].text.includes('洒扫童子'), 'E9 邸报文案含称号');
  eq(s.daily.quest, 1, 'E10 案牍牌办结计数');
  eq(s.daily.contrib, s.contribution, 'E11 案牍牌贡献计数');
  // 二次办结不再发首办
  s.questProgress = QUESTS[0].mins;
  s.bank = 0;
  engine.advance(s, s.lastTickAt); // dt=0 也会结算
  eq(s.contribution, firstBonusOf(0) + QUESTS[0].contrib * 2, 'E12 重复办结只拿常规贡献');
  eq(s.titles.length, 1, 'E13 称号不重发');
}

// ---------- F. 称号词条（M6.5 多元词条池，旧口径等价） ----------
{
  const s = fresh();
  s.titles = ['saotong_tongzi'];
  eq(engine.rateOf(s), BALANCE.salaryPerMin * (1 + TITLE_BONUS_PER), 'F1 案牍山称号薪酬 +1%');
  s.titles = QUEST_TITLES.slice(0, 5).map((t) => t.id);
  eq(engine.rateOf(s), BALANCE.salaryPerMin * 1.05, 'F2 五枚称号薪酬 +5%（线性叠加）');
  s.titles = QUEST_TITLES.map((t) => t.id);
  eq(engine.rateOf(s), BALANCE.salaryPerMin * 1.1, 'F2b 十枚全集薪酬 +10%');
  s.titles = ['no_such_title'];
  eq(engine.rateOf(s), BALANCE.salaryPerMin, 'F3 未知称号 id 不给词条');
  // 等价性：十枚案牍山称号 = 旧 TITLE_BONUS_PER×10 口径
  const b = titleBonuses(QUEST_TITLES.map((t) => t.id));
  eq(b.salary, 10 * TITLE_BONUS_PER, 'F4 词条池与旧口径等价（salary）');
  eq(b.contrib, 10 * TITLE_BONUS_PER, 'F4b 词条池与旧口径等价（contrib）');
  eq(titleBonuses(['baijie_xingzhe']).salary, 0.01, 'F5 百阶行者词条 薪酬+1%');
  eq(titleBonuses(['banshan_tingfeng']).realmGain, 0.02, 'F6 半山听风词条 秘境收益+2%');
  eq(titleBonuses(['lingxiao_jueding']).xinliDrain, 0.05, 'F7 凌霄绝顶词条 心力消耗−5%');
  eq(titleBonuses(['xuanan_kexing']).contrib, 0.01, 'F8 悬案克星词条 贡献+1%');
  eq(titleBonuses(['jianzheng_zhengduo']).salary, 0.01, 'F8b 监正争夺者词条 薪酬+1%');
  ok(EXTRA_TITLES.length === 6 && ALL_TITLES.length === 16, 'F9 称号名册 10+6=16 枚');
  ok(Object.keys(TITLE_WORDS).length === 15 && !TITLE_WORDS.dengxia_tongxing, 'F10 词条配置 15 枚（灯下同行纯展示无词条）');
}

// ---------- G. 自动切档与手动锁档 ----------
{
  const s = fresh();
  s.gongfaLvl = 3; // 办差力 25，够接档 1
  s.questProgress = QUESTS[0].mins;
  engine.advance(s, s.lastTickAt);
  eq(s.questTier, 1, 'G1 办结后自动切最高档');
  eq(s.questProgress, 0, 'G2 升档不吞进度（刚好整除）');

  const l = fresh();
  l.questLocked = 0;
  l.gongfaLvl = 3;
  l.questProgress = QUESTS[0].mins + 0.25;
  engine.advance(l, l.lastTickAt);
  eq(l.questTier, 0, 'G3 锁定后不自动升档');
  eq(l.questProgress, 0.25, 'G4 锁定档进度余数保留');

  const r = fresh();
  const bad = engine.selectQuestTier(r, 1);
  ok(!bad.ok, 'G5 办差力不足接不下高档');
  r.gongfaLvl = 3;
  const good = engine.selectQuestTier(r, 1);
  ok(good.ok && r.questLocked === 1 && r.questTier === 1, 'G6 手动锁档生效');
  engine.releaseQuestLock(r);
  eq(r.questLocked, null, 'G7 解锁恢复自动');
}

// ---------- H. 成长消费全手动（autoSpend 已移除） ----------
{
  // 旧档遗留 auto=true 也不再自动消费
  const s = fresh();
  s.auto = { promote: true, gongfa: true, deptGongfa: true };
  s.rankExp = 1000;
  s.bank = 100000;
  s.dept = 'qianyafang';
  engine.advance(s, s.lastTickAt);
  eq(s.rankLvl, 1, 'H1 旧档 auto 残留不自动晋升');
  eq(s.rankExp, 1000, 'H2 经验不被自动消费');
  eq(s.gongfaLvl, 0, 'H3 功法不自动研习');
  eq(s.deptGongfaLvl, 0, 'H4 部门功法不自动研习');
  eq(s.bank, 100000, 'H5 余额分文不动');

  // 手动通路照常可用
  const m = fresh();
  m.rankExp = 20;
  ok(engine.doPromote(m).ok && m.rankLvl === 2 && m.rankExp === 5, 'H6 手动晋升仍生效');
  const g = fresh();
  g.bank = 150;
  ok(engine.doUpgradeGongfa(g).ok && g.gongfaLvl === 1 && g.bank === 0, 'H7 手动研习仍生效');
  const d = fresh();
  d.dept = 'qianyafang';
  d.bank = 150;
  ok(engine.doUpgradeDeptGongfa(d).ok && d.deptGongfaLvl === 1 && d.bank === 0, 'H8 手动部门研习仍生效');

  // M6.1 功法双槽各自封顶 Lv10
  const gm = fresh();
  gm.bank = 1e9;
  gm.gongfaLvl = BALANCE.gongfaMax;
  const rg = engine.doUpgradeGongfa(gm);
  ok(!rg.ok && /化境/.test(rg.error) && gm.bank === 1e9, 'H9 功法 Lv10 封顶拒绝研习且不扣费');
  const gd = fresh();
  gd.dept = 'qianyafang';
  gd.bank = 1e9;
  gd.deptGongfaLvl = BALANCE.gongfaMax;
  ok(!engine.doUpgradeDeptGongfa(gd).ok, 'H10 部门功法同样 Lv10 封顶');
}

// ---------- I. 心力节律：倦怠 → 自动回血 → 复工 ----------
{
  const s = fresh();
  s.questTier = 9; // 避免办结干扰
  engine.advance(s, s.lastTickAt + 10 * 3600 * 1000);
  eq(s.xinli, BALANCE.burnoutRecoverPerMin * 0.5, 'I1 长时间挂机心力耗尽（末 30 秒在线已微量回血）');
  ok(s.burnout, 'I2 进入职业倦怠');

  engine.advance(s, s.lastTickAt + 10 * 3600 * 1000);
  ok(!s.burnout && s.xinli > 99, 'I3 倦怠期心力自动回满复工');
  ok(!s.burnout, 'I4 回满自动复工');

  const before = s.bank;
  tick(s);
  eq(s.bank - before, BALANCE.salaryPerMin * 0.5, 'I5 复工后恢复全额产出');

  const x = fresh();
  x.dept = 'xingmingfang';
  x.deptGongfaLvl = 5; // drainCut 封顶 80%
  x.questTier = 9;
  engine.advance(x, x.lastTickAt + 10 * 3600 * 1000);
  ok(!x.burnout && x.xinli > 0, 'I6 刑名房慎行录 10 小时不倦怠');
}

// ---------- J. 离线结算：0.6 倍 + 12h 封顶 ----------
{
  const mk = () => {
    const s = fresh();
    s.questTier = 9; // 600 分钟，12h 离线办不完，排除结算干扰
    return s;
  };
  const a = mk();
  const b = mk();
  engine.advance(a, a.lastTickAt + 13 * 3600 * 1000);
  engine.advance(b, b.lastTickAt + 20 * 3600 * 1000);
  eq(b.bank, a.bank, 'J1 超过 12h 的离线时长不再多产');

  // 精确期望：前段正常 0.6 倍，心力耗尽后 0.6×0.3，封顶 720 分钟 + 30 秒在线倦怠
  const emptyAt = BALANCE.xinliMax / BALANCE.xinliDrainPerMin;
  const capMin = OFFLINE_CAP_MS / 60000;
  const expected =
    BALANCE.salaryPerMin * 0.6 * emptyAt +
    BALANCE.salaryPerMin * 0.6 * BALANCE.burnoutProdMult * (capMin - emptyAt) +
    BALANCE.salaryPerMin * BALANCE.burnoutProdMult * 0.5;
  eq(a.bank, expected, 'J2 封顶 12h 产出精确（含倦怠分段）');

  const c = mk();
  engine.advance(c, c.lastTickAt + 6 * 3600 * 1000);
  const exp6 = BALANCE.salaryPerMin * 0.6 * 359.5 + BALANCE.salaryPerMin * 0.5;
  eq(c.bank, exp6, 'J3 未触顶离线按实际时长结算（未倦怠，在线全额）');
  eq(c.daily.onlineMin, 0.5, 'J4 离线不刷当值时长');

  const y = fresh();
  y.questTier = 9; // 避免办结干扰薪酬断言
  y.dept = 'caoyunsi';
  y.deptGongfaLvl = 1; // 离线倍率 0.8
  engine.advance(y, y.lastTickAt + 3600 * 1000);
  eq(y.bank, BALANCE.salaryPerMin * 0.8 * 59.5 + BALANCE.salaryPerMin * 0.5, 'J5 漕运司离线倍率加成');
}

// ---------- K. 强化：20 级/失败率表/淬炼保护 ----------
{
  eq(enhanceCost({ lvl: 1 }).contribution, 12, 'K1 强化成本 1 级 = 12');
  eq(enhanceCost({ lvl: 10 }).contribution, Math.floor(12 * Math.pow(10, 1.6)), 'K2 强化成本曲线 12×n^1.6');

  const rates = [];
  for (let lvl = 0; lvl <= 19; lvl++) rates.push(enhanceFailRate(lvl));
  const want = [
    ...Array(10).fill(0.1), // +0→+1 … +9→+10
    ...Array(6).fill(0.2), // +10→+11 … +15→+16
    0.3, 0.4, 0.5, 0.6,
  ];
  ok(rates.every((r, i) => Math.abs(r - want[i]) < 1e-9), 'K3 失败率表逐档精确');

  const mkItem = (lvl, temper = 0) => ({ name: '试', slot: 'hand', rarity: 2, lvl, temper });
  const s = fresh();
  s.gear.hand = mkItem(5);
  s.contribution = 100000;
  const f = engine.doEnhance(s, 'hand', 0.05); // 0.05 < 10% → 失败
  ok(!f.success && s.gear.hand.lvl === 4, 'K4 失败只掉 1 级');
  eq(s.gear.hand.temper, 0, 'K5 低段失败不积淬炼');

  s.gear.hand = mkItem(5);
  const g = engine.doEnhance(s, 'hand', 0.5);
  ok(g.success && s.gear.hand.lvl === 6, 'K6 成功 +1 级');

  s.gear.hand = mkItem(16);
  const h = engine.doEnhance(s, 'hand', 0.1); // 0.1 < 30% → 失败
  ok(!h.success && s.gear.hand.lvl === 15 && s.gear.hand.temper === 1, 'K7 +16 起失败积淬炼 1 层');

  s.gear.hand = mkItem(16, 10); // 失败率 0.3 - 1.0 → 0
  const i = engine.doEnhance(s, 'hand', 0.0);
  ok(i.success && s.gear.hand.temper === 0, 'K8 淬炼叠满必成，成功后清零');

  s.gear.hand = mkItem(16, 2);
  engine.doEnhance(s, 'hand', 0.9); // 成功
  eq(s.gear.hand.temper, 0, 'K9 成功清零淬炼层数');

  s.gear.hand = mkItem(MAX_ENHANCE);
  ok(!engine.doEnhance(s, 'hand', 0.9).ok, 'K10 +20 顶格拒绝强化');

  s.gear.hand = mkItem(3);
  s.contribution = 0;
  ok(!engine.doEnhance(s, 'hand', 0.9).ok, 'K11 贡献不足拒绝强化');

  s.contribution = 1000;
  const c0 = s.contribution;
  engine.doEnhance(s, 'hand', 0.05);
  eq(s.contribution, c0 - enhanceCost({ lvl: 3 }).contribution, 'K12 失败也扣强化费');

  // M6.1 装备回收：底值 2/4/7/12，成长 1/级，顶配四件 124
  eq(gearPower({ rarity: 1, lvl: 20 }), 21, 'K13 凡品顶 power 21');
  eq(gearPower({ rarity: 2, lvl: 20 }), 23, 'K14 灵品顶 power 23');
  eq(gearPower({ rarity: 4, lvl: 20 }), 31, 'K15 巧品顶 power 31');
  const fullGear = {
    hand: { rarity: 4, lvl: 20 },
    shield: { rarity: 4, lvl: 20 },
    soul: { rarity: 4, lvl: 20 },
    craft: { rarity: 4, lvl: 20 },
  };
  eq(gearTotalPower(fullGear), 124, 'K16 巧品满配四件 124（装备定位纯加速件）');
}

// ---------- L. 锻造：吃贡献 + 10 锻保底 ----------
{
  const s = fresh();
  s.contribution = 100;
  ok(!engine.doForge(s, 'hand').ok, 'L1 贡献不足拒绝锻造');
  eq(FORGE_COST.contribution, 150, 'L2 锻造费 150 贡献');

  s.contribution = 200;
  const r = engine.doForge(s, 'hand', 0.99);
  ok(r.ok && s.gear.hand && s.contribution === 50, 'L3 锻造扣费并装备');
  eq(s.daily.forge, 1, 'L4 锻造进案牍牌');

  s.forgePity = 10;
  s.contribution = 150;
  const p = engine.doForge(s, 'shield', 0.4); // rand=0.4 本是凡品
  ok(p.guaranteed && s.gear.shield.rarity >= 2, 'L5 保底强制灵品以上');
  eq(s.forgePity, 0, 'L6 保底后清零');

  s.contribution = 150;
  s.forgePity = 5;
  engine.doForge(s, 'soul', 0.6); // 灵品
  eq(s.forgePity, 0, 'L7 出灵品即清零保底');

  s.contribution = 150;
  s.forgePity = 3;
  engine.doForge(s, 'craft', 0.4); // 凡品
  eq(s.forgePity, 4, 'L8 凡品累积保底');
}

// ---------- M. 案牍牌：自动里程碑，不点不亏 ----------
{
  eq(dailyTargets(-1).contrib, 0, 'M1 未通档贡献目标为 0（新人不卡贡献）');
  eq(dailyTargets(0).contrib, 150, 'M1b 通档 0 → 贡献目标 150');
  eq(dailyTargets(4).contrib, 750, 'M2 通档 4 → 贡献目标 750');
  eq(dailyReward(0).salary, 80, 'M3 赏钱公式（薪酬）');
  eq(dailyReward(0).contribution, 130, 'M4 赏钱公式（贡献）');

  const s = fresh();
  ok(!engine.claimDaily(s).ok, 'M5 未达标领赏被拒');

  const t = dailyTargets(s.questBest);
  s.daily.quest = t.quest;
  s.daily.contrib = t.contrib;
  s.daily.onlineMin = t.onlineMin;
  const rw = dailyReward(s.questBest);
  const r = engine.claimDaily(s);
  ok(r.ok && s.bank === rw.salary && s.contribution === rw.contribution, 'M6 达标一键领赏入账');
  ok(!engine.claimDaily(s).ok, 'M7 当日不可重复领');

  // 跨天自动发赏：昨日达标未领 → 自动入账 + 邸报
  const a = fresh();
  const yest = emptyDaily(NOW - 86400000);
  yest.quest = t.quest;
  yest.contrib = Math.max(t.contrib, 1);
  yest.onlineMin = t.onlineMin;
  a.daily = yest;
  engine.ensureDaily(a, NOW);
  ok(a.bank === rw.salary && a.contribution === rw.contribution, 'M8 跨天自动发赏（不点不亏）');
  eq(a.events[0].type, 'reward', 'M9 自动发赏进邸报');
  eq(a.daily.date, todayStr(NOW), 'M10 案牍牌重挂为今日');
  eq(a.daily.quest, 0, 'M11 重挂后计数清零');

  // 未达标跨天：不发赏
  const b = fresh();
  const y2 = emptyDaily(NOW - 86400000);
  y2.quest = 1;
  b.daily = y2;
  engine.ensureDaily(b, NOW);
  ok(b.bank === 0 && b.contribution === 0 && b.events.length === 0, 'M12 未达标跨天不发赏');

  // 跨天幻灭涨格
  const c = fresh();
  c.daily = emptyDaily(NOW - 2 * 86400000);
  engine.ensureDaily(c, NOW);
  eq(c.huanmie, 2 * HUANMIE_PER_DAY, 'M13 跨天幻灭涨格');
}

// ---------- N. 三房功法修正（制香坊/察案院/签押房） ----------
{
  const z = fresh();
  z.dept = 'zhixiangfang';
  z.deptGongfaLvl = 2;
  eq(engine.rateOf(z), BALANCE.salaryPerMin * 1.3, 'N1 制香坊调香手札：薪酬每级 +15%');

  const c = fresh();
  c.dept = 'chaanyuan';
  c.deptGongfaLvl = 10; // 贡献 +150%
  c.questProgress = QUESTS[0].mins;
  engine.advance(c, c.lastTickAt);
  eq(
    c.contribution,
    Math.floor(QUESTS[0].contrib * (1 + 0.15 * 10)) + firstBonusOf(0),
    'N2 察案院表面功：贡献结算加成（另含首办里程碑）'
  );
}

// ---------- O. 仙籍折算（贡献为原料） ----------
{
  const s = fresh();
  s.createdAt = NOW - 2 * 86400000;
  s.contributionTotal = 250;
  eq(engine.xianjiProgress(s, NOW), 2 * 16 + 250 * BALANCE.xianjiPerContrib, 'O1 仙籍进度 = 服役日×16 + 累计贡献/50');
}

// ---------- Q. 官职十级制：经验积累/插值倍率/手动晋升 ----------
{
  // 经验表：每职总经验 × 级内权重 / 130
  eq(rankLevelNeed(0, 1), 15, 'Q1 帮闲 Lv1→2 需 15 经验');
  eq(rankLevelNeed(1, 1), 17, 'Q2 书吏 Lv1→2 需 17 经验');
  eq(rankLevelNeed(6, 9), 152, 'Q3 知事 Lv9→10 需 152 经验');
  eq(rankLevelNeed(0, 10), null, 'Q4 Lv10 无职内需求（跨职吃打点）');

  // 倍率平滑插值：cur + (nxt-cur)*(lvl-1)/9（M6.1 新表，仅驱动产出）
  eq(rankMultOf(0, 1), 1, 'Q5 帮闲 Lv1 倍率 1');
  eq(rankMultOf(0, 10), 1.5, 'Q6 帮闲 Lv10 插值到书吏倍率');
  ok(Math.abs(rankMultOf(0, 5) - (1 + (0.5 * 4) / 9)) < 1e-9, 'Q7 职内倍率平滑插值');
  eq(rankMultOf(6, 10), 15, 'Q8 知事顶格倍率不再增长');

  // 经验积累与产出同权重：在线 1/分、离线 0.6、倦怠 0.3
  const s = fresh();
  tick(s);
  eq(s.rankExp, 0.5, 'Q9 在线 30 秒 = 0.5 经验');
  eq(s.rankExpGain, 0.5, 'Q10 rankExpGain 记录本次推进增量');

  const o = fresh();
  o.questTier = 9; // 避免办结干扰
  engine.advance(o, o.lastTickAt + 2 * 3600 * 1000);
  eq(o.rankExp, 119.5 * 0.6 + 0.5, 'Q11 离线经验 0.6 倍（末 30 秒在线全额）');

  const b = fresh();
  b.burnout = true;
  b.xinli = 0;
  tick(b);
  eq(b.rankExp, 0.5 * BALANCE.burnoutProdMult, 'Q12 倦怠期经验 0.3 倍');

  // 办结加送耗时 20%
  const q = fresh();
  for (let i = 0; i < 6; i++) tick(q); // 3 分钟办结「洒扫庭除」
  eq(q.rankExp, 3 + QUESTS[0].mins * RANK_EXP.questExpRatio, 'Q13 挂机经验 + 办结加送 20%');

  // 顶格后经验不再累积
  const t = fresh();
  t.rank = RANKS.length - 1;
  t.rankLvl = 10;
  tick(t);
  eq(t.rankExp, 0, 'Q14 顶格后经验不再累积');
  eq(t.rankExpGain, 0, 'Q15 顶格后增量为 0');

  // 手动晋升三态：职内吃经验 / Lv10 吃打点费 / 顶格拒绝
  const p1 = fresh();
  p1.rankExp = 14;
  const r1 = engine.doPromote(p1);
  ok(!r1.ok && /经验未足/.test(r1.error), 'Q16 职内晋升经验不足被拒');
  p1.rankExp = 20;
  const r2 = engine.doPromote(p1);
  ok(r2.ok && p1.rankLvl === 2 && p1.rankExp === 5, 'Q17 职内晋升扣经验升 1 级');
  p1.rankLvl = 10;
  p1.bank = 0;
  const r3 = engine.doPromote(p1);
  ok(!r3.ok && /打点不起/.test(r3.error), 'Q18 跨职无钱被拒');
  p1.bank = RANKS[1].fee;
  const r4 = engine.doPromote(p1);
  ok(r4.ok && p1.rank === 1 && p1.rankLvl === 1 && p1.bank === 0, 'Q19 跨职晋升扣打点费回 Lv1');
  const p2 = fresh();
  p2.rank = RANKS.length - 1;
  p2.rankLvl = 10;
  const r5 = engine.doPromote(p2);
  ok(!r5.ok && /顶格/.test(r5.error), 'Q20 顶格拒绝晋升');
}

// ---------- P. 旧接口已移除 ----------
{
  ok(engine.doCollect === undefined, 'P1 收菜已砍');
  ok(engine.doMoyu === undefined, 'P2 摸鱼已砍');
}

// ---------- S. M6.1 差事门槛表：10→440，顶档 14h ----------
{
  eq(QUESTS.map((q) => q.req).join(','), '10,25,50,80,120,170,230,300,370,440', 'S1 门槛表 10→440');
  eq(QUESTS.map((q) => q.mins).join(','), '3,6,12,25,50,90,180,360,600,840', 'S2 耗时表 3→840 分（顶档 14h）');
  // 毕业裸体通前八档；毕业 + 巧品满配可通顶档
  const naked = fresh();
  naked.rank = 6;
  naked.rankLvl = 10;
  naked.gongfaLvl = 10;
  naked.dept = 'qianyafang';
  naked.deptGongfaLvl = 10;
  ok(engine.zabanliOf(naked) >= QUESTS[7].req, 'S3 毕业裸体 350 通到档 7（req 300）');
  naked.gear = {
    hand: { rarity: 4, lvl: 20 },
    shield: { rarity: 4, lvl: 20 },
    soul: { rarity: 4, lvl: 20 },
    craft: { rarity: 4, lvl: 20 },
  };
  ok(engine.zabanliOf(naked) >= QUESTS[9].req, 'S4 毕业+装备 474 通顶档（一周目十档全通保住）');
}

// ---------- V. M5.7/M6.1 串门子：洗牌袋散排、回礼、惩罚、暗线静默 ----------
{
  const v0 = fresh();
  ok(
    v0.visits && v0.visits.left === 3 && Array.isArray(v0.clues) && v0.clues.length === 0,
    'V1 新档串门 3 次 + 暗线线索为空'
  );
  const v1 = fresh();
  v1.dept = 'qianyafang';
  const rOwn = engine.doVisit(v1, 'qianyafang');
  ok(!rOwn.ok && /本房/.test(rOwn.error), 'V2 本房串门被拒');
  const rBad = engine.doVisit(v1, 'nowhere');
  ok(!rBad.ok && /名册/.test(rBad.error), 'V3 不存在的房被拒');

  // 预填 decks 定向抽牌：回礼两形态
  const v2 = fresh();
  v2.dept = 'qianyafang';
  v2.visits.left = 99;
  const bank0 = v2.bank;
  const giftAmt = Math.max(1, Math.floor(engine.rateOf(v2) * 8));
  v2.decks.hufang = { cards: ['hf1'], last: null };
  const r1 = engine.doVisit(v2, 'hufang');
  ok(
    r1.ok && r1.event.id === 'hf1' && v2.visits.left === 98 && v2.bank === bank0 + giftAmt,
    'V4 串门成功扣次数，灵石回礼 = 8 分钟薪酬'
  );
  v2.decks.hufang = { cards: ['hf3'], last: null };
  const contrib0 = v2.contribution;
  const r2 = engine.doVisit(v2, 'hufang');
  ok(r2.ok && r2.event.id === 'hf3' && v2.contribution === contrib0 + 30, 'V5 贡献回礼固定 30');
  ok(v2.lastVisitId === 'hf3', 'V6 旧 lastVisitId 字段留档兼容');

  // 惩罚三档：只扣薪酬余额，不扣 totalEarned，返回实扣 loss
  const rate2 = engine.rateOf(v2);
  for (const [id, grade, npcId] of [
    ['ne17', 'small', 'npc17'],
    ['ne15', 'mid', 'npc15'],
    ['ne12', 'big', 'npc12'],
  ]) {
    v2.bank = 100000;
    v2.decks.hufang = { cards: [id], last: null };
    const earned0 = v2.totalEarned;
    const rp = engine.doVisit(v2, 'hufang');
    const want = Math.floor(rate2 * engine.PENALTY_MINS[grade]);
    ok(
      rp.ok && rp.event.penalty === grade && rp.event.npcId === npcId && rp.gift === null,
      `V7 ${grade} 惩罚事件带 npcId 且无回礼`
    );
    ok(v2.bank === 100000 - want && rp.loss && rp.loss.bank === want, `V8 ${grade} 扣款 = ${engine.PENALTY_MINS[grade]} 分钟薪酬`);
    ok(v2.totalEarned === earned0, `V9 ${grade} 惩罚不扣累计薪酬`);
  }
  eq(engine.PENALTY_MINS.big, 180, 'V10 big 档 = 六小时收益减半的等量尺度');

  // 余额保护：扣不穿底
  const poor = fresh();
  poor.dept = 'qianyafang';
  poor.bank = 5;
  poor.decks.hufang = { cards: ['ne12'], last: null };
  const rp2 = engine.doVisit(poor, 'hufang');
  ok(rp2.ok && poor.bank === 0 && rp2.loss.bank === 5, 'V11 余额保护：最多扣到 0');

  // 次数耗尽与跨天重置
  const vLim = fresh();
  vLim.dept = 'qianyafang';
  for (let i = 0; i < 3; i++) ok(engine.doVisit(vLim, 'hufang').ok, `V12 第 ${i + 1} 次串门成功`);
  const rOut = engine.doVisit(vLim, 'hufang');
  ok(!rOut.ok && /脚力/.test(rOut.error), 'V13 次数耗尽被拒');
  vLim.visits.date = todayStr(Date.now() - 86400000); // 伪造成昨天
  const rNext = engine.doVisit(vLim, 'hufang');
  ok(rNext.ok && vLim.visits.left === 2 && vLim.visits.date === todayStr(Date.now()), 'V14 跨天次数重置为 3 再扣一');

  // 暗线：预填 bs1，静默记录且不回传 clue 标记；重复抽不重记
  const v3 = fresh();
  v3.dept = 'qianyafang';
  v3.decks.zhixiangfang = { cards: ['bs1'], last: null };
  const r5 = engine.doVisit(v3, 'zhixiangfang');
  ok(
    r5.ok && r5.event.id === 'bs1' && r5.event.clue === undefined && v3.clues.includes('bs1'),
    'V15 暗线线索静默记录，返回不携带 clue 标记'
  );
  v3.decks.zhixiangfang = { cards: ['bs1'], last: null };
  engine.doVisit(v3, 'zhixiangfang');
  ok(v3.clues.filter((c) => c === 'bs1').length === 1, 'V16 暗线线索不重复记入');
}

// ---------- W. M6.1 洗牌袋散排：一轮不重复、跨轮不连续重复 ----------
{
  eq(NPC_EVENTS.length, 58, 'W1 NPC 交互事件 58 条（每人一条）');
  ok(NPC_EVENTS.every((e) => e.npcId && e.dept && e.text), 'W2 每条带 npcId/dept/文案');
  ok(new Set(NPC_EVENTS.map((e) => e.npcId)).size === 58, 'W3 与 58 位同僚一一对应不重复');
  const gifts = NPC_EVENTS.filter((e) => e.gift).length;
  const pens = NPC_EVENTS.filter((e) => e.penalty);
  eq(gifts, 31, 'W4 回礼 31 条');
  eq(pens.length, 27, 'W5 惩罚 27 条');
  eq(pens.filter((e) => e.penalty === 'small').length, 12, 'W6 小惩罚 12 条');
  eq(pens.filter((e) => e.penalty === 'mid').length, 12, 'W7 中惩罚 12 条');
  eq(pens.filter((e) => e.penalty === 'big').length, 3, 'W8 大惩罚 3 条');
  // 池 = 轶事（含博士暗线）+ 该房 NPC 事件
  eq(visitPoolOf('qianyafang').length, 15, 'W9 签押房池 4 轶事 + 11 NPC');
  eq(visitPoolOf('zhixiangfang').length, 7, 'W10 制香坊池 4 轶事 + 1 暗线 + 2 NPC');

  // 一轮内绝不重复，一轮穷尽全池
  const decks = {};
  const pool = visitPoolOf('hufang');
  const ids = [];
  for (let i = 0; i < pool.length; i++) ids.push(drawDeckEvent(decks, 'hufang').id);
  ok(new Set(ids).size === pool.length, 'W11 一轮内绝不重复');
  ok(pool.every((e) => ids.includes(e.id)), 'W12 一轮穷尽全池');
  // 跨轮重装：首张不与上轮末张连续重复
  for (let round = 0; round < 5; round++) {
    const prevLast = ids[ids.length - 1];
    ids.length = 0;
    for (let i = 0; i < pool.length; i++) ids.push(drawDeckEvent(decks, 'hufang').id);
    ok(ids[0] !== prevLast, `W13 第 ${round + 2} 轮首张不接上轮末张`);
    ok(new Set(ids).size === pool.length, `W14 第 ${round + 2} 轮仍不重复`);
  }
  ok(decks.hufang && decks.hufang.last === ids[ids.length - 1], 'W15 袋状态 last 可持久化');
  // rng 可注入：固定序列可复现
  const d1 = {};
  const d2 = {};
  const seq = () => {
    let i = 0;
    return () => (i = (i * 9301 + 49297) % 233280) / 233280;
  };
  const a = drawDeckEvent(d1, 'hufang', seq());
  const b = drawDeckEvent(d2, 'hufang', seq());
  ok(a.id === b.id, 'W16 注入同序列 rng 结果可复现');
}

// ---------- N. M6 NPC 名册（镜像原型部门表） ----------
{
  eq(NPCS.length, 58, 'N1 名册 58 位同僚（64 人−领导栏 6 人）');
  const byDept = {};
  for (const n of NPCS) byDept[n.dept] = (byDept[n.dept] ?? 0) + 1;
  eq(Object.keys(byDept).length, 10, 'N2 十房全覆盖');
  eq(byDept.qianyafang, 11, 'N3 签押房 11 人');
  eq(byDept.hufang, 10, 'N4 户房 10 人');
  eq(byDept.caoyunsi, 8, 'N5 漕运司 8 人');
  eq(byDept.xingmingfang, 6, 'N6 刑名房 6 人');
  eq(byDept.chouyumsi, 5, 'N7 筹云司 5 人');
  eq(byDept.guangwensi, 5, 'N8 广闻司 5 人');
  eq(byDept.lifang, 4, 'N9 吏房 4 人');
  eq(byDept.jiqiaoge, 4, 'N10 机巧阁 4 人');
  eq(byDept.chaanyuan, 3, 'N11 察案院 3 人');
  eq(byDept.zhixiangfang, 2, 'N12 制香坊 2 人');
  ok(new Set(NPCS.map((n) => n.name)).size === 58, 'N13 化名无重名');
  ok(
    NPCS.every((n) => n.rank >= 0 && n.rank <= 6 && n.rankLvl >= 1 && n.rankLvl <= 10),
    'N14 职序职内级在合法区间'
  );
  const zs = NPCS.map(npcZabanli);
  eq(Math.min(...zs), 60, 'N15 办差力下限 60（帮闲）');
  eq(Math.max(...zs), 420, 'N16 办差力上限 420（总监）');
  // 职务层级单调：总监 > 副总监 > 高级经理 > 高级副经理 > 经理 > 资深 > 专员 > 帮闲
  const pick = (pos) => npcZabanli(NPCS.find((n) => COLLEAGUES.find((c) => c[0] === n.name)[2] === pos));
  ok(
    pick('zongjian') > pick('fuzongjian') && pick('fuzongjian') > pick('gaojing') &&
    pick('gaojing') > pick('gaofu') && pick('gaofu') > pick('jingli') &&
    pick('jingli') > pick('zishen') && pick('zishen') > pick('zhuanyuan') &&
    pick('zhuanyuan') > pick('bangxian'),
    'N17 职务层级办差力严格递减'
  );
  // M6.1 档位直定：z 即办差力，不再由职级公式推算
  eq(pick('zongjian'), 420, 'N18 总监 420（毕业 474 稳超，一周目天花板之下）');
  eq(pick('bangxian'), 60, 'N19 帮闲 60（新号 10 仰望，上榜有动力）');
  ok(NPCS.every((n) => npcZabanli(n) === n.z), 'N20 npcZabanli 直接返回档位 z');
  // 传说三位：二周目目标，高于一切 NPC 与一周目毕业
  eq(LEGENDS.length, 3, 'N21 传说前辈 3 位');
  eq([...LEGENDS.map((l) => l.z)].sort((a, b) => a - b).join(','), '480,490,500', 'N22 传说档位 480/490/500');
  ok(LEGENDS.every((l) => l.z > Math.max(...zs) && l.z > 474), 'N23 传说高过总监与一周目毕业满配');
  ok(LEGENDS.every((l) => l.flavor && l.dept), 'N24 传说带 flavor 与挂籍房');
}

// ---------- X. M6.5 外差秘境：例巡与夜值悬案 ----------
{
  const s = fresh();
  s.dept = 'qianyafang';
  // X1 例巡必成功，奖励标尺
  const r = engine.doPatrol(s, () => 0.99); // rng 0.99 ≥ 0.12 → 不掉宝
  ok(r.ok, 'X1 例巡必成功');
  eq(r.contrib, patrolContrib(-1), 'X1b 贡献 = 20+6×questBest（-1 按 0）');
  eq(r.salary, Math.floor(engine.rateOf(s) * 5), 'X1c 薪酬 = rate×5 分钟');
  eq(s.realm.patrolLeft, REALM_PER_DAY - 1, 'X1d 次数消耗一次');
  eq(r.drop, null, 'X1e rng 0.99 不掉宝');
  // X2 rng 0 必掉落，凡品掌中器入背包
  const r2 = engine.doPatrol(s, () => 0);
  ok(r2.drop && !r2.drop.sold && r2.drop.item.rarity === 1 && r2.drop.item.slot === 'hand', 'X2 rng 0 必掉凡品掌中器');
  eq(s.bag.length, 1, 'X2b 掉落进背包');
  // X3 第 4 次拒绝
  engine.doPatrol(s, () => 0.99);
  const r4 = engine.doPatrol(s, () => 0.99);
  ok(!r4.ok && /明日请早/.test(r4.error), 'X3 例巡第 4 次被拒');
}
{
  const s = fresh();
  s.dept = 'qianyafang';
  s.realm.nightAffix = 'fengping';
  // X4 办差力不足失败零惩罚
  const bankBefore = s.bank;
  const contribBefore = s.contribution;
  const r = engine.doNight(s, () => 0);
  ok(r.ok && r.win === false, 'X4 新号 z=10 夜值不破局（门槛 12）');
  eq(r.need, 12, 'X4b 门槛 = 档1 req 10 × 1.15');
  eq(s.contribution, contribBefore, 'X4c 失败无贡献');
  eq(s.bank, bankBefore, 'X4d 失败不扣薪酬（零惩罚）');
  eq(s.realm.nightLeft, REALM_PER_DAY - 1, 'X4e 尝试次数消耗');
  // X5 破局 + 词缀收益系数
  s.realm.nightAffix = 'cuiban';
  s.rank = 6; s.rankLvl = 10; // z=300
  const r2 = engine.doNight(s, () => 0.99);
  ok(r2.win === true, 'X5 知事满 300 稳破局');
  eq(r2.contrib, Math.floor(nightContrib(s.questBest) * 1.25), 'X5b 上官催办奖励 ×1.25');
  // X6 累计 30 次破局授「悬案克星」
  s.realm.solvedTotal = 29;
  engine.doNight(s, () => 0.99); // 第 3 次（最后一次）
  ok(s.titles.includes('xuanan_kexing'), 'X6 累计 30 破局授悬案克星');
  const r7 = engine.doNight(s, () => 0.99);
  ok(!r7.ok && /灯油/.test(r7.error), 'X7 夜值第 4 次被拒');
}
{
  // X8 词缀洗牌袋：一轮 4 天不重复，第 5 天重装
  const s = fresh();
  const seen = [];
  for (let d = 2; d <= 6; d++) {
    s.daily.date = `2026-8-${d - 1}`;
    engine.ensureDaily(s, new Date(2026, 7, d, 12).getTime());
    seen.push(s.realm.nightAffix);
  }
  ok(new Set(seen.slice(0, 4)).size === 4, 'X8 词缀一轮内四天不重复');
  ok(NIGHT_AFFIXES.some((a) => a.id === seen[4]), 'X8b 第 5 天仍是合法词缀（重装新轮）');
  ok(seen.every((id) => NIGHT_AFFIXES.some((a) => a.id === id)), 'X8c 词缀全部出自名册');
}

// ---------- Y. M6.5 凌霄阶：门槛曲线/一键冲阵/扫荡/里程碑称号 ----------
{
  eq(ladderNeed(1), 10, 'Y1 第 1 层门槛 10');
  eq(ladderNeed(100), 30, 'Y1b 第 100 层门槛 30');
  eq(ladderNeed(500), 186, 'Y1c 第 500 层门槛 186');
  eq(ladderNeed(LADDER_FLOORS), 460, 'Y1d 第 1000 层门槛 460');
  let mono = true;
  for (let n = 1; n < LADDER_FLOORS; n++) if (ladderNeed(n + 1) < ladderNeed(n)) mono = false;
  ok(mono, 'Y2 门槛曲线单调不减');
  // Y3 新号冲阵：z=10 → 1~7 层
  const s = fresh();
  const r = engine.climbLadder(s);
  ok(r.ok && r.climbed === 7 && r.cleared === 7, 'Y3 新号 z=10 一气冲 7 层');
  let want = 0;
  for (let n = 1; n <= 7; n++) want += ladderFirstBonus(n);
  eq(r.contrib, want, 'Y3b 首通贡献逐层结算');
  eq(s.contribution, want, 'Y3c 贡献已入账');
  // Y4 再冲被门槛挡住
  const r2 = engine.climbLadder(s);
  ok(!r2.ok && /办差力不济/.test(r2.error), 'Y4 办差力不足冲阵被拒');
  // Y5 扫荡与同日拒绝
  const r3 = engine.sweepLadder(s);
  eq(r3.bonus, ladderSweepBonus(7), 'Y5 扫荡 = 已通 7 层 ×0.5');
  const r4 = engine.sweepLadder(s);
  ok(!r4.ok && /已扫过/.test(r4.error), 'Y5b 同日重复扫荡被拒');
  // Y6 满配 474 一次通 1000 层 + 三枚里程碑称号
  const s2 = fresh();
  s2.rank = 6; s2.rankLvl = 10; s2.gongfaLvl = 10; s2.deptGongfaLvl = 10;
  s2.gear = {
    hand: { name: '巧', slot: 'hand', rarity: 4, lvl: 20, temper: 0 },
    shield: { name: '巧', slot: 'shield', rarity: 4, lvl: 20, temper: 0 },
    soul: { name: '巧', slot: 'soul', rarity: 4, lvl: 20, temper: 0 },
    craft: { name: '巧', slot: 'craft', rarity: 4, lvl: 20, temper: 0 },
  };
  eq(engine.zabanliOf(s2), 474, 'Y6 满配办差力 474');
  const r5 = engine.climbLadder(s2);
  eq(r5.cleared, 1000, 'Y6b 满配一次通千层');
  ok(
    ['baijie_xingzhe', 'banshan_tingfeng', 'lingxiao_jueding'].every((id) => s2.titles.includes(id)),
    'Y6c 里程碑三称号授齐'
  );
  // Y7 毕业裸体 350 停在曲线中段（≈812 层）
  const s3 = fresh();
  s3.rank = 6; s3.rankLvl = 10; s3.gongfaLvl = 10; s3.deptGongfaLvl = 10;
  const r6 = engine.climbLadder(s3);
  ok(
    r6.cleared > 700 && r6.cleared < 900 && ladderNeed(r6.cleared + 1) > 350 && ladderNeed(r6.cleared) <= 350,
    'Y7 毕业裸体 350 止于门槛 350 处',
  );
  // Y8 无层可扫拒绝
  const s4 = fresh();
  ok(!engine.sweepLadder(s4).ok, 'Y8 未登阶无层可扫');
}

// ---------- Z. M6.5 背包：装备/折卖/满员自动折卖 ----------
{
  const mk = (slot, rarity, lvl) => ({ name: '试件', slot, rarity, lvl, temper: 0 });
  const s = fresh();
  // Z1 装备进对应槽
  s.bag = [mk('hand', 2, 5)];
  const r = engine.equipBagItem(s, 0);
  ok(r.ok && s.gear.hand.rarity === 2 && s.gear.hand.lvl === 5 && s.bag.length === 0, 'Z1 背包件装入对应槽');
  // Z2 旧件回背包
  s.bag = [mk('hand', 3, 1)];
  const r2 = engine.equipBagItem(s, 0);
  ok(r2.ok && s.gear.hand.rarity === 3 && s.bag.length === 1 && s.bag[0].rarity === 2, 'Z2 槽内旧件回背包');
  // Z3 折卖口径：底值一半 + 成长 1/级（灵品底 4 → 2 + (5-1) = 6）
  const cb = s.contribution;
  const r3 = engine.sellBagItem(s, 0);
  eq(r3.value, 6, 'Z3 折卖值 = 底值一半 + 成长×级');
  eq(s.contribution, cb + 6, 'Z3b 折卖贡献入账');
  // Z4 非法下标拒绝
  ok(!engine.equipBagItem(s, 5).ok && !engine.sellBagItem(s, 5).ok, 'Z4 背包无此件被拒');
  // Z5 背包满员：新掉落自动折卖 40 贡献
  const s2 = fresh();
  s2.dept = 'qianyafang';
  for (let i = 0; i < BAG_MAX; i++) s2.bag.push(mk('hand', 1, 1));
  const cb2 = s2.contribution;
  const r5 = engine.doPatrol(s2, () => 0); // 必掉落
  ok(r5.drop && r5.drop.sold === true, 'Z5 满员掉落自动折卖');
  eq(s2.contribution, cb2 + patrolContrib(-1) + BAG_OVERFLOW_SELL, 'Z5b 例巡贡献 20 + 自动折卖 40 入账');
  eq(s2.bag.length, BAG_MAX, 'Z5c 背包保持满员不溢出');
  // Z6 凌霄绝顶词条：心力消耗 −5% 生效（同段时长对比）
  const a = fresh();
  const b = fresh();
  b.titles = ['lingxiao_jueding'];
  engine.advance(a, a.lastTickAt + 600000);
  engine.advance(b, b.lastTickAt + 600000);
  ok(b.xinli > a.xinli, 'Z6 凌霄绝顶词条减缓心力消耗');
}

// ---------- AB. 百官录·凌霄阶榜：办差力折算层数（NPC 镜像口径） ----------
{
  eq(ladderFloorOfZ(9), 0, 'AB1 不足第 1 层门槛记 0 层');
  eq(ladderFloorOfZ(460), 1000, 'AB2 460 办差力恰登绝顶 1000 层');
  ok(ladderFloorOfZ(459) < 1000, 'AB3 差一点 460 登不了绝顶');
  ok(
    ladderFloorOfZ(ladderNeed(500)) >= 500 && ladderFloorOfZ(ladderNeed(500) - 1) < 500,
    'AB4 门槛边界层数精确（第 500 层）',
  );
  let mono = true;
  for (let z = 10; z < 460; z += 37) if (ladderFloorOfZ(z + 30) < ladderFloorOfZ(z)) mono = false;
  ok(mono, 'AB5 折算层数随办差力单调不减');
}

// ---------- AA. M6.8 事件系统：库结构/轻奖无罚/每日调度/洗牌袋/跨天/入账 ----------
{
  // AA1 库结构：122 条 = 通用 32 + 十房各 7 + M9.8 具名 20，gift 仅 contrib(5~15)/bank(mins=1) 两形态
  eq(DAILY_EVENTS.length, EV_TOTAL_COUNT, 'AA1 事件库共 122 条');
  eq(new Set(DAILY_EVENTS.map((e) => e.id)).size, EV_TOTAL_COUNT, 'AA1b id 全部唯一');
  eq(DAILY_EVENTS.filter((e) => e.dept === null).length, EV_COMMON_COUNT, 'AA1c 通用 32 条');
  for (const d of DEPARTMENTS) {
    eq(
      DAILY_EVENTS.filter((e) => e.dept === d.id && !e.npcId).length,
      EV_DEPT_COUNT,
      `AA1d ${d.id} 专属 7 条`,
    );
  }
  ok(DAILY_EVENTS.every((e) => typeof e.text === 'string' && e.text.length > 0), 'AA1e 文案全非空');
  ok(
    DAILY_EVENTS.every(
      (e) =>
        !e.gift ||
        (e.gift.type === 'contrib' && Number.isInteger(e.gift.n) && e.gift.n >= 5 && e.gift.n <= 15) ||
        (e.gift.type === 'bank' && e.gift.mins === 1),
    ),
    'AA1f gift 只有 contrib(5~15)/bank(mins=1) 两形态',
  );
  const gifted = DAILY_EVENTS.filter((e) => e.gift).length;
  ok(gifted >= 45 && gifted <= 52, `AA1g 带轻奖约四成（实际 ${gifted}/${EV_TOTAL_COUNT}）`);
}
{
  // AA1b 零惩罚红线：发满一日全程 bank/贡献只增不减
  const s = fresh();
  s.dept = 'qianyafang';
  let prevBank = s.bank;
  let prevContrib = s.contribution;
  let mono = true;
  for (let i = 0; i < 400; i++) {
    engine.advance(s, s.lastTickAt + TICK);
    if (s.bank < prevBank || s.contribution < prevContrib) mono = false;
    prevBank = s.bank;
    prevContrib = s.contribution;
  }
  ok(mono, 'AA1b 全天心跳薪酬与贡献只增不减（零惩罚）');
}
{
  // AA1c 初始档带 M6.8 三字段
  const s = fresh();
  eq(s.evDay, null, 'AA1c 初始 evDay 为 null');
  eq(s.evReadTs, 0, 'AA1c2 初始已读水位 0');
  eq(s.pendingSpecial, null, 'AA1c3 初始事件专区为空');
}
{
  // AA2 心跳模拟一整天：发满 cap 即停，洗牌袋只耗对应张数
  const s = fresh();
  s.dept = 'qianyafang';
  for (let i = 0; i < 400; i++) engine.advance(s, s.lastTickAt + TICK); // 200 分钟
  const cap0 = s.evDay.cap + s.events.filter((e) => e.type === 'daily' || e.type === 'gift').length;
  ok(cap0 >= 2 && cap0 <= 4, `AA2 当日 cap 在 2~4（实际 ${cap0}）`);
  // 只数 daily/gift：engine.pushEvent 用真实时钟，首办里程碑事件会混入
  const fired = s.events.filter((e) => e.type === 'daily' || e.type === 'gift').length;
  eq(fired, cap0, 'AA2b 发满 cap 即停');
  eq(s.evDay.cap, 0, 'AA2c 发满后 cap 归零');
  eq(s.evDay.used.length, fired, 'AA2d used 与发出条数一致（加权副本防重）');
  eq(new Set(s.evDay.used).size, fired, 'AA2d2 当日发出的事件 id 不重复');
  ok(s.events.length <= 20, 'AA2e 邸报留 20 条上限');
  eq(s.evDay.date, todayStr(s.lastTickAt), 'AA2f 当日袋日期不变');
}
{
  // AA2b 加权洗牌袋：一周目 hufang = 通用合规 29 + 本房 7，weight:2 入两份副本
  const s = fresh();
  s.dept = 'hufang';
  let seed = 0.42;
  const rng = () => ((seed = (seed * 9301 + 49297) % 233280), seed / 233280);
  initEvDay(s, NOW, rng);
  eq(new Set(s.evDay.cards).size, 38, 'AA2b 袋内唯一 id 38 个（通用合规 29 + 本房 7 + 具名 2）');
  ok(s.evDay.cards.length > 38, 'AA2b2 weight:2 条目带双副本，袋张数大于唯一数', `袋 ${s.evDay.cards.length} 张`);
  ok(
    s.evDay.cards.every((id) => {
      const ev = DAILY_EVENTS.find((e) => e.id === id);
      return ev && (ev.dept === null || ev.dept === 'hufang');
    }),
    'AA2b3 袋内全是通用或本房专属',
  );
  ok(s.evDay.cap >= 2 && s.evDay.cap <= 4, 'AA2b4 cap 2~4');
}
{
  // AA2c 跨天重置：advance 跨日 + tickDailyEvents 日期守卫各自重装
  const s = fresh();
  s.dept = 'qianyafang';
  engine.advance(s, s.lastTickAt + TICK);
  const d1 = s.evDay.date;
  engine.advance(s, s.lastTickAt + 26 * 3600 * 1000);
  ok(s.evDay.date !== d1 && s.evDay.date === todayStr(s.lastTickAt), 'AA2c 跨天 advance 自动重装当日袋');
  ok(s.evDay.cards.length > 0 && s.evDay.used.length === 0, 'AA2c2 重装后袋满且 used 清空');
  const s2 = fresh();
  s2.dept = 'qianyafang';
  tickDailyEvents(s2, NOW, 2);
  const d2 = s2.evDay.date;
  tickDailyEvents(s2, NOW + 26 * 3600 * 1000, 2);
  ok(s2.evDay.date !== d2, 'AA2c3 tickDailyEvents 日期守卫自含跨天重置');
}
{
  // AA3 gift 定向入账：contrib 与 bank 各验一条
  const s = fresh();
  s.evDay = { date: todayStr(s.lastTickAt), cap: 1, cards: ['g_laojie'], nextAt: s.lastTickAt };
  const c0 = s.contribution;
  const ct0 = s.contributionTotal;
  engine.advance(s, s.lastTickAt + 60000);
  eq(s.contribution, c0 + 6, 'AA3 contrib gift 贡献 +6 入账');
  eq(s.contributionTotal, ct0 + 6, 'AA3b 累计贡献同步');
  ok(s.events[0].type === 'gift' && /贡献 \+6/.test(s.events[0].text), 'AA3c 邸报一条 gift 带贡献尾注');

  const s2 = fresh();
  s2.evDay = { date: todayStr(s2.lastTickAt), cap: 1, cards: ['g_chayi'], nextAt: s2.lastTickAt };
  const ctrl = fresh(); // 对照档：同 60 秒自然结算，不含 gift
  engine.advance(ctrl, ctrl.lastTickAt + 60000);
  const b0 = s2.bank;
  engine.advance(s2, s2.lastTickAt + 60000);
  const want = Math.floor(engine.rateOf(ctrl)); // bank mins=1 → 一分钟当前薪酬
  eq(s2.bank - b0 - ctrl.bank, want, 'AA3d bank gift 按当前 rateOf 折算入账（剔除自然结算）');
  ok(want >= 1, 'AA3e 新号一分钟薪酬至少 1');
  ok(s2.events[0].type === 'gift' && /薪酬 \+/.test(s2.events[0].text), 'AA3f 邸报一条 gift 带薪酬尾注');
}
{
  // AA3b 离线回归不补发：积压过期只发一条，下一间隔照常排
  const s = fresh();
  s.dept = 'qianyafang';
  s.evDay = { date: todayStr(s.lastTickAt), cap: 4, cards: ['g_laojie'], nextAt: s.lastTickAt - 2 * 3600 * 1000 };
  engine.advance(s, s.lastTickAt + 3 * 3600 * 1000); // 3 小时空档
  const fired = s.events.filter((e) => e.type === 'daily' || e.type === 'gift').length;
  eq(fired, 1, 'AA3b 离线积压只补一条（不补发连珠炮）');
  ok(s.evDay.nextAt > s.lastTickAt, 'AA3b2 发完即排下一间隔');
}

// ---------- AC M7 转生二周目 ----------
{
  // AC1 守卫：fork 非 chose_stay，留任转生被拒
  const s = fresh();
  s.dept = 'qianyafang';
  ok(!engine.rebirth(s, 'stay').ok, 'AC1 fork=null 留任转生被拒');
  s.fork = 'pending';
  ok(!engine.rebirth(s, 'stay').ok, 'AC1b fork=pending 留任转生被拒');
  s.fork = 'chose_stay';
  ok(!engine.rebirth(s, 'nowhere').ok, 'AC1c 未知路线被拒');
}
{
  // AC2 留任转生：重置/保留清单逐项断言
  const s = fresh();
  s.dept = 'qianyafang';
  s.fork = 'chose_stay';
  s.bank = 1000; s.contribution = 500; s.contributionTotal = 800; s.totalEarned = 2000;
  s.rank = 3; s.rankLvl = 5; s.rankExp = 123; s.gongfaLvl = 4; s.deptGongfaLvl = 3;
  s.forgePity = 5;
  s.bag = [{ name: '灵品·试件', slot: 'hand', rarity: 2, lvl: 1 }];
  s.gear = { ...s.gear, hand: { name: '灵品·旧笔', slot: 'hand', rarity: 2, lvl: 4 } };
  s.questTier = 4; s.questLocked = 4; s.questProgress = 12; s.questBest = 4; s.questCount = 77; s.questFirsts = [0, 1, 2];
  s.titles = ['saotong_tongzi']; s.titleWorn = 'saotong_tongzi';
  s.ledger = 3; s.tongtou = 7; s.xianjiStage = 2; s.huanmie = 10; s.wallNotice = '某告示';
  s.ladder = { cleared: 55, sweptDate: null };
  s.stats = { quest: 900, enhance: 0, patrol: 0, night: 0, visit: 0 };
  const created = s.createdAt;
  const res = engine.rebirth(s, 'stay', NOW);
  ok(res.ok === true, 'AC2 留任转生成功');
  eq(res.loop, 2, 'AC2b 返回 loop=2');
  ok(s.bank === 0 && s.contribution === 0 && s.contributionTotal === 0 && s.totalEarned === 0, 'AC2c 两线资源清零');
  ok(s.rank === 0 && s.rankLvl === 1 && s.rankExp === 0, 'AC2d 职级三件套清零');
  ok(s.gongfaLvl === 0 && s.forgePity === 0, 'AC2e 功法与保底清零');
  ok(Object.values(s.gear).every((g) => g === null), 'AC2f 法器全槽清零');
  ok(s.bag.length === 0, 'AC2g 背包清零');
  ok(s.questTier === 0 && s.questLocked === null && s.questProgress === 0 && s.questBest === -1 && s.questCount === 0 && s.questFirsts.length === 0, 'AC2h 差事四件清零');
  ok(s.huanmie === 0 && s.fork === null && s.wallNotice === null && s.evDay === null && s.pendingSpecial === null, 'AC2i 幻灭/岔路/告示/事件调度清零');
  ok(Object.values(s.stats).every((v) => v === 0), 'AC2j stats 清零');
  ok(s.ladder.cleared === 0 && s.visits.left === VISITS_PER_DAY && s.xinli === BALANCE.xinliMax && !s.burnout, 'AC2k 凌霄/串门/心力重置');
  eq(s.ledger, 3, 'AC2l 账册保留');
  ok(s.titles.length === 1 && s.titleWorn === 'saotong_tongzi', 'AC2m 称号履历保留');
  eq(s.tongtou, 7, 'AC2n 通透保留');
  eq(s.xianjiStage, 2, 'AC2o 仙籍冻结态保留');
  eq(s.createdAt, created, 'AC2p createdAt 保留');
  eq(s.deptGongfaLvl, 2, 'AC2q stay：本门功法 Lv2 起步');
  eq(s.dept, 'qianyafang', 'AC2r stay：dept 不变');
  eq(s.loop, 2, 'AC2s loop +1');
  eq(s.seniority, 1, 'AC2t seniority +1');
  ok(s.heirlooms.length === 1 && s.heirlooms[0].trait === 'andu_deep' && s.heirlooms[0].value === 3 && s.heirlooms[0].forgedLoop === 1, 'AC2u 铸神器：quest 偏科 → 案牍深 +3%', JSON.stringify(s.heirlooms[0]));
  ok(s.events.length === 1 && s.events[0].type === 'milestone' && s.events[0].text.includes(s.heirlooms[0].name) && s.events[0].text.includes(HEIRLOOM_TRAITS.andu_deep.name), 'AC2v 邸报转生里程碑（含神器名与特征名）');
}
{
  // AC3 辞官转生（fork leave 转正）：dept 归 null + 前世余荫一次性
  const s = fresh();
  s.dept = 'qianyafang';
  s.fork = 'pending';
  s.bank = 500;
  const res = engine.chooseFork(s, 'leave', NOW);
  ok(res.ok === true && res.heirloom, 'AC3 fork leave 转生成功');
  ok(s.dept === null && s.deptGongfaLvl === 0, 'AC3b dept 归 null 回选任屏');
  ok(s.legacyBoon === true, 'AC3c 前世余荫标记置位');
  ok(s.fork === null, 'AC3d 转生完 fork 归 null（履历已记）');
  eq(s.loop, 2, 'AC3e loop +1');
  eq(s.seniority, 1, 'AC3f seniority +1');
  eq(s.bank, 0, 'AC3g 薪酬清零');
  const r2 = engine.chooseDept(s, 'chaanyuan');
  ok(r2.ok && r2.boon === true, 'AC3h 新房选任成功带 boon');
  eq(s.rankExp, 110, 'AC3i 前世余荫 +100 经验（资历 1 层 ×1.1 → 110）');
  ok(s.legacyBoon === false, 'AC3j 标记消耗');
  ok(s.events.some((e) => e.type === 'milestone' && e.text.includes('前世余荫')), 'AC3k 邸报余荫一条');
  ok(!engine.chooseDept(s, 'hufang').ok, 'AC3l 二次选任被拒');
}
{
  // AC4 资历倍率：只挂经验，不碰产出
  const mk = (sen) => {
    const s = fresh();
    s.dept = 'qianyafang';
    s.seniority = sen;
    return s;
  };
  const c0 = mk(0), c1 = mk(1), c5 = mk(5), c7 = mk(7);
  tick(c0); tick(c1); tick(c5); tick(c7);
  const base = c0.rankExpGain;
  ok(base > 0, 'AC4 基线经验 > 0');
  ok(Math.abs(c1.rankExpGain - base * 1.1) < 1e-9, 'AC4b 1 转 +10%');
  ok(Math.abs(c5.rankExpGain - base * 1.5) < 1e-9, 'AC4c 5 转 +50%');
  ok(Math.abs(c7.rankExpGain - base * 1.5) < 1e-9, 'AC4d 7 转仍 +50%（5 层封顶）');
  ok(engine.rateOf(c7) === engine.rateOf(c0), 'AC4e 薪酬速率不受资历影响（红线）');
}
{
  // AC5 神器五 trait 判定与数值曲线
  eq(judgeTrait({ quest: 900 }), 'andu_deep', 'AC5 案牍深判定');
  eq(judgeTrait({ enhance: 30 }), 'forge_keen', 'AC5b 锻造勤判定');
  eq(judgeTrait({ patrol: 20, night: 10 }), 'realm_active', 'AC5c 秘境勤判定（巡+夜合算）');
  eq(judgeTrait({ visit: 30 }), 'visit_wide', 'AC5d 串门广判定');
  eq(judgeTrait({ quest: 10, enhance: 1, patrol: 1, night: 1, visit: 1 }), 'balanced', 'AC5e 全低 → 均衡');
  eq(heirloomValue(0), 3, 'AC5f 首转 3%');
  eq(heirloomValue(5), 8, 'AC5g 5 转 8%');
  eq(heirloomValue(9), 8, 'AC5h 9 转仍 8% 封顶');
}
{
  // AC6 佩戴生效 / 卸下归零（选一 trait 打对应收益）
  const s = fresh();
  s.dept = 'qianyafang';
  s.heirlooms = [
    { id: 'heirloom_1', trait: 'balanced', name: '安神香佩', value: 5, forgedLoop: 1 },
    { id: 'heirloom_2', trait: 'forge_keen', name: '听风磨石', value: 4, forgedLoop: 2 },
  ];
  const r0 = engine.rateOf(s);
  ok(engine.wearHeirloom(s, 'heirloom_1').ok, 'AC6 佩戴成功');
  eq(heirloomBonusOf(s, 'salary'), 0.05, 'AC6b 均衡挂钩 salary 侧 +5%');
  ok(Math.abs(engine.rateOf(s) - r0 * 1.05) < 1e-9, 'AC6c 薪酬速率 +5% 生效');
  ok(!engine.wearHeirloom(s, 'heirloom_99').ok, 'AC6d 非收藏内佩戴被拒');
  ok(engine.wearHeirloom(s, null).ok && s.heirloomWorn === null, 'AC6e 卸下成功');
  eq(engine.rateOf(s), r0, 'AC6f 卸下归零');
  // 锻造勤：强化费用减免
  s.gear = { ...s.gear, hand: { name: '试剑', slot: 'hand', rarity: 1, lvl: 1 } };
  s.contribution = 100000;
  engine.wearHeirloom(s, 'heirloom_2');
  const want = Math.max(1, Math.floor(enhanceCost(s.gear.hand).contribution * (1 - 0.04)));
  const before = s.contribution;
  const re = engine.doEnhance(s, 'hand', 2);
  ok(re.ok && re.success, 'AC6g 强化成功（rand 强制）');
  eq(before - s.contribution, want, 'AC6h 锻造勤 4% 费用减免生效');
}
{
  // AC7 多转生：神器收藏递增不重复，数值随资历涨
  const s = fresh();
  s.dept = 'qianyafang';
  s.fork = 'chose_stay';
  engine.rebirth(s, 'stay', NOW);
  s.fork = 'chose_stay'; // 模拟下一周目再次觉醒留任
  engine.rebirth(s, 'stay', NOW);
  ok(s.heirlooms.length === 2 && s.heirlooms[0].id !== s.heirlooms[1].id, 'AC7 二转神器 id 不重复', JSON.stringify(s.heirlooms.map((h) => h.id)));
  eq(s.heirlooms[1].value, 4, 'AC7b 二转 value = 4%（3+转生前资历 1）');
  eq(s.loop, 3, 'AC7c 三周目');
  eq(s.seniority, 2, 'AC7d 资历 2');
}

// ---------- AD. M7.6 凌霄阶攻略感：限量登阶 + 逐层文案 + 冲阵精选 ----------
{
  const allPool = [...LADDER_LINES.shanjiao, ...LADDER_LINES.banshan, ...LADDER_LINES.lintian];
  // AD1 文案池分档与里程碑定句
  eq(pickLadderLine(100), LADDER_MILESTONE_LINES[100], 'AD1 第 100 层走定句');
  eq(pickLadderLine(500), LADDER_MILESTONE_LINES[500], 'AD1b 第 500 层走定句');
  eq(pickLadderLine(1000), LADDER_MILESTONE_LINES[1000], 'AD1c 第 1000 层走定句');
  for (const f of [1, 42, 99]) ok(LADDER_LINES.shanjiao.includes(pickLadderLine(f)), `AD1d 第 ${f} 层属山脚档`);
  for (const f of [101, 300, 499]) ok(LADDER_LINES.banshan.includes(pickLadderLine(f)), `AD1e 第 ${f} 层属半山档`);
  for (const f of [501, 777, 999]) ok(LADDER_LINES.lintian.includes(pickLadderLine(f)), `AD1f 第 ${f} 层属临天档`);
  ok(allPool.length === 36, 'AD1g 三档共 36 句', `共 ${allPool.length}`);
  ok(new Set(allPool).size === 36, 'AD1h 文案无重复');
  // AD2 登一层：新号 z=10，第 1 层门槛 10
  const s1 = fresh();
  const r1 = engine.climbLadder(s1, 1);
  ok(r1.ok && r1.climbed === 1 && r1.cleared === 1, 'AD2 登一层成功');
  ok(r1.lines.length === 1 && r1.lines[0].floor === 1 && LADDER_LINES.shanjiao.includes(r1.lines[0].text), 'AD2b 下发第 1 层山脚文案');
  eq(r1.contrib, ladderFirstBonus(1), 'AD2c 首办贡献口径不变');
  // AD3 连闯十层被办差力截断：z=10 只能上 7 层，≤10 层全量下发
  const s2 = fresh();
  const r2 = engine.climbLadder(s2, 10);
  ok(r2.ok && r2.climbed === 7 && r2.lines.length === 7, 'AD3 count=10 但止步 7 层，文案全量', `climbed=${r2.climbed} lines=${r2.lines.length}`);
  ok(r2.lines.every((l, i) => l.floor === i + 1), 'AD3b 文案层号逐层递增');
  // AD4 续登：高办差力号先登五层再登五层，层号与文案逐层接续
  const s2b = fresh();
  s2b.rank = 3; s2b.rankLvl = 10;
  const r3a = engine.climbLadder(s2b, 5);
  const r3b = engine.climbLadder(s2b, 5);
  ok(r3a.ok && r3a.cleared === 5 && r3b.ok && r3b.cleared === 10, 'AD4 两次登五层累计十层');
  ok(r3b.lines.length === 5 && r3b.lines.every((l, i) => l.floor === 6 + i), 'AD4b 续登层号接续（6~10）');
  ok(r3b.lines.every((l) => LADDER_LINES.shanjiao.includes(l.text)), 'AD4c 续登文案仍属山脚档');
  // AD5 满配冲阵千层：精选 = 首层 + 三里程碑 + 末两层（1000 与里程碑重合去重）
  const s3 = fresh();
  s3.rank = 6; s3.rankLvl = 10; s3.gongfaLvl = 10; s3.deptGongfaLvl = 10;
  s3.gear = {
    hand: { name: '巧', slot: 'hand', rarity: 4, lvl: 20, temper: 0 },
    shield: { name: '巧', slot: 'shield', rarity: 4, lvl: 20, temper: 0 },
    soul: { name: '巧', slot: 'soul', rarity: 4, lvl: 20, temper: 0 },
    craft: { name: '巧', slot: 'craft', rarity: 4, lvl: 20, temper: 0 },
  };
  const r4 = engine.climbLadder(s3);
  eq(r4.cleared, 1000, 'AD5 满配一次通千层');
  const floors = r4.lines.map((l) => l.floor);
  ok(r4.lines.length === 5, 'AD5b 冲阵精选 5 句（首层/100/500/999/1000）', JSON.stringify(floors));
  ok(floors.includes(1) && floors.includes(100) && floors.includes(500) && floors.includes(999) && floors.includes(1000), 'AD5c 关键层齐全');
  ok(r4.lines.find((l) => l.floor === 100).text === LADDER_MILESTONE_LINES[100], 'AD5d 里程碑层下发定句');
  ok(r4.lines.every((l) => l.text && l.text.length > 0), 'AD5e 每句非空');
  // AD6 办差力不济守卫不变
  const r5 = engine.climbLadder(s2, 1);
  ok(!r5.ok && /办差力不济/.test(r5.error), 'AD6 止步后登一层同样被拒');
}

// ---------- AE. 事件库扩充：102 条结构/weight/need 前置/加权袋防重 ----------
{
  // AE1 weight/need 字段口径
  ok(DAILY_EVENTS.every((e) => e.weight == null || (Number.isInteger(e.weight) && e.weight >= 1)), 'AE1 weight 均为正整数');
  ok(DAILY_EVENTS.every((e) => !e.need || e.need in EV_NEED_CHECKS), 'AE1b need 必须是已登记口径');
  ok(DAILY_EVENTS.filter((e) => e.need).every((e) => !e.gift), 'AE1c 前置事件不带礼（纯叙事）');
  ok(Object.keys(EV_NEED_CHECKS).includes('loop2'), 'AE1d loop2 口径已登记');
  ok(EV_NEED_CHECKS.loop2({ loop: 1 }) === false && EV_NEED_CHECKS.loop2({ loop: 2 }) === true, 'AE1e loop2 以 state.loop>=2 划线');
}
{
  // AE2 前置过滤：一周目袋无转生梗，二周目袋有
  const s1 = fresh();
  s1.dept = 'qianyafang';
  initEvDay(s1, NOW);
  ok(!['g_jishi', 'g_mengzhong', 'g_shugu'].some((id) => s1.evDay.cards.includes(id)), 'AE2 一周目袋不含转生梗');
  const s2 = fresh();
  s2.dept = 'qianyafang';
  s2.loop = 2;
  initEvDay(s2, NOW);
  ok(['g_jishi', 'g_mengzhong', 'g_shugu'].every((id) => s2.evDay.cards.includes(id)), 'AE2b 二周目袋收齐三条转生梗');
}
{
  // AE3 加权袋抽重防重：人为构造双副本袋，连发不重复
  const s = fresh();
  s.dept = 'qianyafang';
  s.evDay = {
    date: todayStr(s.lastTickAt),
    cap: 4,
    cards: ['g_limao', 'g_limao', 'g_limao', 'g_chayi', 'g_chayi', 'g_laojie'],
    used: [],
    nextAt: s.lastTickAt,
  };
  let ts = s.lastTickAt;
  for (let i = 0; i < 6; i++) {
    ts += 60000;
    s.evDay.nextAt = ts - 1;
    tickDailyEvents(s, ts, 2);
  }
  eq(s.evDay.used.length, 3, 'AE3 三副本袋最多发 3 条不同事件');
  eq(new Set(s.evDay.used).size, 3, 'AE3b 发出 id 无重复（抽重自动跳过）');
  eq(s.evDay.cap, 1, 'AE3c 袋空后不再耗次数');
}
{
  // AE4 旧档兼容：evDay 无 used 字段也能正常发
  const s = fresh();
  s.dept = 'qianyafang';
  s.evDay = { date: todayStr(s.lastTickAt), cap: 1, cards: ['g_laojie'], nextAt: s.lastTickAt };
  engine.advance(s, s.lastTickAt + 60000);
  ok(s.evDay.used.length === 1 && s.evDay.used[0] === 'g_laojie', 'AE4 旧袋无 used 字段自动补齐并正常发');
}

// ---------- AF. M7.5 监正争夺战：开议门槛/三场叙事战/败零惩罚/讽刺留白结局 ----------
{
  // AF1 静态 NPC 榜名次口径：1 + 严格高于你的人数
  eq(jianzhengBoardRank(501), 1, 'AF1 办差力 501 = 榜首');
  eq(jianzhengBoardRank(420), 4, 'AF1b 420 仅三传说在上 = 第 4');
  const zongjianAbove = NPCS.filter((n) => n.z > 419).length + LEGENDS.filter((l) => l.z > 419).length;
  eq(jianzhengBoardRank(419), zongjianAbove + 1, 'AF1c 419 = 知事档全压其上');
}
{
  // AF2 惰性开议：一周目不开 / 二周目榜外不开 / 二周目前五开且只开一次
  const mkMax = () => {
    const s = fresh();
    s.rank = 6; s.rankLvl = 10; s.gongfaLvl = 10; s.deptGongfaLvl = 10;
    s.gear = {
      hand: { name: '巧', slot: 'hand', rarity: 4, lvl: 20, temper: 0 },
      shield: { name: '巧', slot: 'shield', rarity: 4, lvl: 20, temper: 0 },
      soul: { name: '巧', slot: 'soul', rarity: 4, lvl: 20, temper: 0 },
      craft: { name: '巧', slot: 'craft', rarity: 4, lvl: 20, temper: 0 },
    };
    return s;
  };
  const s1 = mkMax(); s1.dept = 'qianyafang';
  engine.advance(s1, s1.lastTickAt + TICK);
  ok(!s1.jianzheng, 'AF2 一周目满配不开议');
  const s2 = fresh(); s2.dept = 'qianyafang'; s2.loop = 2;
  engine.advance(s2, s2.lastTickAt + TICK);
  ok(!s2.jianzheng, 'AF2b 二周目榜外（z=10）不开议');
  const s3 = mkMax(); s3.dept = 'qianyafang'; s3.loop = 2;
  engine.advance(s3, s3.lastTickAt + TICK);
  ok(s3.jianzheng && !s3.jianzheng.done, 'AF2c 二周目前五开议');
  eq(s3.pendingSpecial, JIANZHENG_SPECIAL_TEXT, 'AF2d 金标告示挂上');
  ok(s3.events.some((e) => e.type === 'milestone' && /择能者试/.test(e.text)), 'AF2e 邸报金标预告一条');
  const previews = s3.events.filter((e) => /择能者试/.test(e.text)).length;
  engine.advance(s3, s3.lastTickAt + TICK);
  eq(s3.events.filter((e) => /择能者试/.test(e.text)).length, previews, 'AF2f 开议只触发一次，不刷屏');
}
{
  // AF3 对局守卫与败零惩罚
  const s = fresh();
  ok(!engine.fightJianzheng(s, 'yunzhang').ok && /尚未开议/.test(engine.fightJianzheng(s, 'yunzhang').error), 'AF3 未开议对局被拒');
  const s2 = fresh();
  s2.jianzheng = { wins: {}, done: false, finishedAt: null };
  ok(!engine.fightJianzheng(s2, 'nobody').ok && /无此对手/.test(engine.fightJianzheng(s2, 'nobody').error), 'AF3b 未知对手被拒');
  const bank0 = s2.bank, contrib0 = s2.contribution;
  const r = engine.fightJianzheng(s2, 'yunzhang'); // z=10 < 420，必败
  ok(r.ok && r.win === false && !r.finale && /败不要紧/.test(r.text), 'AF3c 低办差力落败下发败文案');
  ok(s2.bank === bank0 && s2.contribution === contrib0 && !s2.jianzheng.wins.yunzhang, 'AF3d 败零惩罚：资源不动不计胜');
}
{
  // AF4 三场全胜 → 讽刺留白结局：授号 + 轻奖贡献 + 告示摘除
  const s = fresh();
  s.loop = 2;
  s.rank = 6; s.rankLvl = 10; s.gongfaLvl = 10; s.deptGongfaLvl = 10;
  s.gear = {
    hand: { name: '巧', slot: 'hand', rarity: 4, lvl: 20, temper: 0 },
    shield: { name: '巧', slot: 'shield', rarity: 4, lvl: 20, temper: 0 },
    soul: { name: '巧', slot: 'soul', rarity: 4, lvl: 20, temper: 0 },
    craft: { name: '巧', slot: 'craft', rarity: 4, lvl: 20, temper: 0 },
  };
  s.jianzheng = { wins: {}, done: false, finishedAt: null };
  s.pendingSpecial = JIANZHENG_SPECIAL_TEXT;
  const c0 = s.contribution;
  let last;
  for (const c of JIANZHENG_CANDIDATES) {
    last = engine.fightJianzheng(s, c.id);
    ok(last.ok && last.win && last.text === c.winText, `AF4 胜 ${c.name} 下发胜文案`);
  }
  ok(last.finale && /容后再议/.test(last.finale), 'AF4b 第三场全胜开留白结局');
  ok(s.jianzheng.done && s.jianzheng.finishedAt > 0, 'AF4c 结案置位');
  eq(s.pendingSpecial, null, 'AF4d 告示摘除');
  ok(s.titles.includes(JIANZHENG_TITLE_ID), 'AF4e 授「监正争夺者」称号');
  eq(s.contribution, c0 + JIANZHENG_FINAL_CONTRIB, 'AF4f 轻奖贡献入账');
  ok(s.events.some((e) => e.type === 'milestone' && /椅子还是空的/.test(e.text)), 'AF4g 邸报结局一条');
  ok(!engine.fightJianzheng(s, 'yunzhang').ok && /此案已结/.test(engine.fightJianzheng(s, 'yunzhang').error), 'AF4h 结案后对局被拒');
  const r2 = engine.fightJianzheng(s, 'yunzhang');
  ok(!r2.ok, 'AF4i 重复对局守卫');
}

// ---------- AG. M9.5 博士支线回收「灯下」：集齐判定/授号/幂等/转生保留 ----------
{
  // AG1 线索不齐：走近被拒，不落任何痕迹
  const s = fresh();
  s.clues = ['bs1', 'bs2'];
  const r = engine.collectLamp(s);
  ok(!r.ok && /还没拼成一条路/.test(r.error), 'AG1 线索不齐被拒');
  ok(!s.lampDone && !s.titles.includes(engine.LAMP_TITLE_ID), 'AG1b 被拒不落档不授号');
}
{
  // AG2 集齐四条 → 授「灯下同行」纯展示称号 + 邸报留痕，零数值
  const s = fresh();
  s.clues = [...LAMP_CLUES];
  const c0 = s.contribution;
  const b0 = s.bank;
  const r = engine.collectLamp(s);
  ok(r.ok && r.already === false, 'AG2 集齐回收成功');
  ok(s.lampDone === true && s.titles.includes(engine.LAMP_TITLE_ID), 'AG2b 置 lampDone 并授号');
  eq(s.contribution, c0, 'AG2c 零贡献回礼（暗线不功利化）');
  eq(s.bank, b0, 'AG2d 零薪酬回礼');
  ok(!TITLE_WORDS[engine.LAMP_TITLE_ID], 'AG2e 称号无词条，纯展示');
  ok(s.events.some((e) => e.type === 'milestone' && /灯下同行/.test(e.text)), 'AG2f 邸报授号留痕');
}
{
  // AG3 幂等：收过再收不重授、不刷屏
  const s = fresh();
  s.clues = [...LAMP_CLUES];
  engine.collectLamp(s);
  const n0 = s.events.length;
  const r = engine.collectLamp(s);
  ok(r.ok && r.already === true, 'AG3 重复回收返回已收');
  eq(s.titles.filter((t) => t === engine.LAMP_TITLE_ID).length, 1, 'AG3b 称号不重发');
  eq(s.events.length, n0, 'AG3c 邸报不再刷屏');
}
{
  // AG4 转生保留：线索跨周目不丢，二周目仍可走到灯下
  const s = fresh();
  s.fork = 'chose_stay';
  s.clues = [...LAMP_CLUES];
  const rb = engine.rebirth(s, 'stay', s.lastTickAt + TICK);
  ok(rb.ok !== false, 'AG4 留任转生成立');
  ok(LAMP_CLUES.every((id) => s.clues.includes(id)), 'AG4b 转生后四条线索仍在');
  ok(!s.lampDone, 'AG4c 转生不重置支线进度字段');
  const r = engine.collectLamp(s);
  ok(r.ok && r.already === false, 'AG4d 二周目仍可回收');
}

// ---------- AH. M9.8 邸报本房化：每房 2 条具名同僚观察事件 ----------
{
  const bn = DAILY_EVENTS.filter((e) => e.npcId);
  eq(bn.length, EV_NPC_COUNT, 'AH1 具名观察事件共 20 条');
  for (const d of DEPARTMENTS) {
    eq(bn.filter((e) => e.dept === d.id).length, 2, `AH1b ${d.id} 具名 2 条`);
  }
  ok(bn.every((e) => {
    const n = NPCS.find((x) => x.id === e.npcId);
    return n && n.dept === e.dept;
  }), 'AH2 npcId 全部命中名册且房一致');
  ok(bn.every((e) => !e.penalty), 'AH3 具名事件零惩罚（轻奖无罚口径不变）');
  ok(bn.every((e) => !e.gift || (e.gift.type === 'contrib' && e.gift.n >= 5 && e.gift.n <= 15) || (e.gift.type === 'bank' && e.gift.mins === 1)), 'AH3b 轻奖两形态口径一致');
  // 当日袋纳入：本房具名事件进袋（weight:2 双副本）
  const s = fresh();
  s.dept = 'qianyafang';
  initEvDay(s, NOW);
  ok(s.evDay.cards.includes('bn1') && s.evDay.cards.includes('bn2'), 'AH4 本房具名事件进当日袋');
  ok(!s.evDay.cards.includes('bn3'), 'AH4b 他房具名事件不进袋');
}

console.log(`\n引擎测试：${pass} 过 / ${fail} 挂，共 ${pass + fail} 项`);
if (failures.length) {
  console.log('挂掉的用例：');
  failures.forEach((f) => console.log(' -', f));
  process.exit(1);
}
