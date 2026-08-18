// 挂机引擎：纯函数，服务端权威推进。
// 惰性结算——没有后台定时器，任何读写操作先把状态从 lastTickAt 推进到当前时刻。
// M5.5 经济底层改造（GDD_v2）：薪酬/贡献双资源全自动、离线 12h 封顶、
// 自动晋升/研习/切档、首办里程碑、游刃有余、强化 20 级 + 淬炼保护、案牍牌自动里程碑。
import { BALANCE, OFFLINE_CAP_MS, RANKS, RANK_EXP, rankLevelNeed, rankMultOf, rankZabanliBase } from './config.js';
import { EMPTY_MODS, findDept } from './departments.js';
import {
  QUESTS,
  firstBonusOf,
  dailyTargets,
  dailyReward,
  todayStr,
  emptyDaily,
  daysBetween,
} from './quests.js';
import { QUEST_TITLES, titleBonuses, titleOf } from './titles.js';
import { VISITS_PER_DAY, LAMP_CLUES } from './visits.js';
import { drawDeckEvent } from './npcevents.js';
import { tickDailyEvents } from './events.js';
import { forgeHeirloom, heirloomBonusOf, HEIRLOOM_TRAITS } from './heirlooms.js';
import { pickLadderLine } from './ladderLines.js';
import {
  JIANZHENG_CANDIDATES,
  JIANZHENG_SPECIAL_TEXT,
  JIANZHENG_PREVIEW_TEXT,
  JIANZHENG_FINAL_TEXT,
  JIANZHENG_FINAL_CONTRIB,
  JIANZHENG_TITLE_ID,
  jianzhengReady,
} from './jianzheng.js';
import {
  REALM_PER_DAY,
  LADDER_FLOORS,
  ladderNeed,
  ladderFirstBonus,
  ladderSweepBonus,
  LADDER_MILESTONES,
  NIGHT_AFFIXES,
  patrolContrib,
  PATROL_SALARY_MINS,
  PATROL_DROP_RATE,
  PATROL_DROP_WEIGHTS,
  nightNeed,
  nightContrib,
  NIGHT_DROP_RATE,
  NIGHT_DROP_WEIGHTS,
  NIGHT_TITLE_AT,
  NIGHT_TITLE_ID,
  BAG_MAX,
  BAG_OVERFLOW_SELL,
} from './realm.js';
import {
  XIANJI_PER_DAY,
  XIANJI_THRESHOLD_BASE,
  XIANJI_THRESHOLD_GROWTH,
  XIANJI_NOTICES,
  LEDGER_MATS_PER_PAGE,
  LEDGER_PAGES,
  HUANMIE_MAX,
  HUANMIE_PER_DAY,
  HUANMIE_PER_WALL,
  HUANMIE_PER_LEDGER,
} from './xianji.js';
import {
  emptyGear,
  gearTotalPower,
  gearPower,
  enhanceCost,
  enhanceFailRate,
  MAX_ENHANCE,
  FORGE_PITY_MAX,
  forgeItem,
  FORGE_COST,
  sellValue,
  realmDrop,
} from './gear.js';

export function defaultState(now) {
  return {
    v: 1,
    // ---------- 两线资源（GDD_v2 §3） ----------
    bank: 0, // 薪酬（灵石）余额：身份线，逐秒自动入账
    contribution: 0, // 贡献余额：能力线，差事办结入账，锻造/强化消耗
    contributionTotal: 0, // 累计贡献入账（仙籍折算的原料，GDD_v2 §12）
    totalEarned: 0, // 累计薪酬（结算卷轴用）
    xinli: BALANCE.xinliMax,
    burnout: false, // 职业倦怠（心力自动节律，GDD_v2 §8）
    rank: 0, // 职级天梯索引（编外天花板 = 知事）
    rankLvl: 1, // 职内等级 1~10（M5.6：经验挂机积累，点击晋升）
    rankExp: 0, // 当前累积职级经验（无上限、可结转，不点零损失）
    gongfaLvl: 0, // 《摸鱼心法》等级（通用槽）
    dept: null, // 所属部门 id（M3：开局选任，不可更换）
    deptGongfaLvl: 0, // 部门专属功法等级（部门槽）
    gear: emptyGear(), // 法器四槽
    // ---------- 案牍山 ----------
    questTier: 0, // 当前挂办差事档位
    questLocked: null, // 手动锁定档位（null = 自动挂最高能接的档）
    questProgress: 0, // 当前差事已累积分钟数（含游刃有余加速）
    questBest: -1, // 曾办结的最高档位（未办结为 -1）
    questCount: 0, // 累计办结次数
    questFirsts: [], // 已达成首办里程碑的档位
    titles: [], // 称号 id 列表（GDD_v2 §11，轻量词条制）
    titleWorn: null, // M6：佩戴称号 id（仅展示徽章，属性仍全部持有生效）
    forgePity: 0, // 连续未出灵品及以上的锻造次数（满 10 保底）
    // ---------- M5.7 串门子 ----------
    visits: { date: todayStr(now), left: VISITS_PER_DAY }, // 每日串门次数（跨天重置，不点不亏）
    lastVisitId: null, // 上一条读过的轶事（旧字段留档兼容，M6.1 起改走洗牌袋）
    decks: {}, // M6.1 洗牌袋散排：每房一袋 {cards, last}，跨天不清空，按轮重装
    clues: [], // 暗线线索 id（静默记录，M7 回收）
    // ---------- M6.5 外差秘境与凌霄阶 ----------
    realm: {
      date: todayStr(now), // 跨天重置（随案牍牌同一套 ensureDaily）
      patrolLeft: REALM_PER_DAY, // 例巡今日余次
      nightLeft: REALM_PER_DAY, // 夜值悬案今日余次
      nightAffix: null, // 今日词缀 id（每日一抽，洗牌袋）
      affixBag: null, // 词缀洗牌袋 {cards}
      solvedTotal: 0, // 悬案累计破局（授「悬案克星」用）
    },
    ladder: { cleared: 0, sweptDate: null }, // 凌霄阶：已通层数 + 最近扫荡日
    bag: [], // 法器背包（秘境掉落；上限 BAG_MAX，手动选装/折卖，不点不亏）
    // ---------- M6.8 事件系统与邸报 ----------
    evDay: null, // 当日事件调度 {date, cap, cards, nextAt}（tickDailyEvents 自带日期守卫）
    evReadTs: 0, // 邸报已读水位（events 里 ts 大于它即未读红点；展开列表时 events/ack 推平）
    pendingSpecial: null, // 事件专区待办（M7 大事件复用位，本期恒 null）
    daily: emptyDaily(now), // 每日案牍牌（自动里程碑）
    // ---------- M5 主线 ----------
    xianjiStage: 0, // 仙籍撞墙次数（画饼告示阶段）
    huanmie: 0, // 幻灭值（不直接展示，UI 只显示心事阶段）
    ledger: 0, // 旧账册已收页数
    fork: null, // 岔路事件：null | 'pending' | 'chose_stay'（leave 分支 M7 转正：直接转生）
    tongtou: 0, // 通透值（分支 A 觉醒后积累）
    wallNotice: null, // 待展示的撞墙告示（前端阅后回执清除）
    // ---------- M7 转生二周目 ----------
    loop: 1, // 周目数（转生 +1）
    seniority: 0, // 资历：转生次数；经验 +10%/层、5 层封顶，不碰产出
    heirlooms: [], // 传家神器收藏 {id, trait, name, value, forgedLoop}（每转铸一件）
    heirloomWorn: null, // 传家槽当前佩戴神器 id（单装，可换戴）
    stats: { quest: 0, enhance: 0, patrol: 0, night: 0, visit: 0 }, // 本周目玩法统计（转生时先读后清零）
    legacyBoon: false, // 辞官路线「前世余荫」一次性标记（选任新房时发 100 经验）
    // ---------- M6.8 预留：衙门邸报事件日志（最多 20 条） ----------
    events: [],
    createdAt: now,
    lastTickAt: now,
  };
}

// 邸报日志（M6.8 事件系统的地基）：新事件置顶，只留最近 20 条
export function pushEvent(state, ev) {
  if (!Array.isArray(state.events)) state.events = [];
  state.events.unshift({ ts: Date.now(), ...ev });
  if (state.events.length > 20) state.events.length = 20;
}

// 跨天：幻灭涨格 + 昨日案牍牌达标自动发赏（GDD_v2 §9），然后重挂牌
export function ensureDaily(state, ts) {
  if (!state.daily) {
    state.daily = emptyDaily(ts);
  }
  // M6.5：秘境次数与悬案词缀自带日期守卫，且当日新开档也要首抽，
  // 必须排在「同日不动」的早退之前（不打不亏，次数不攒不补）
  if (!state.realm || state.realm.date !== todayStr(ts)) {
    const solvedTotal = state.realm?.solvedTotal ?? 0;
    const affixBag = state.realm?.affixBag ?? null;
    state.realm = {
      date: todayStr(ts),
      patrolLeft: REALM_PER_DAY,
      nightLeft: REALM_PER_DAY,
      nightAffix: null,
      affixBag,
      solvedTotal,
    };
    state.realm.nightAffix = drawNightAffix(state.realm);
  } else if (!state.realm.nightAffix) {
    // 当日开的新档（defaultState 不抽签）：首次心跳补抽并落库，展示与实际同一枚
    state.realm.nightAffix = drawNightAffix(state.realm);
  }
  const days = daysBetween(state.daily.date, todayStr(ts));
  if (days <= 0) return;
  if (!state.fork) {
    state.huanmie = Math.min(HUANMIE_MAX, state.huanmie + days * HUANMIE_PER_DAY);
  }
  // M5.7：串门次数随案牍牌同一套跨天重置
  if (!state.visits || state.visits.date !== todayStr(ts)) {
    state.visits = { date: todayStr(ts), left: VISITS_PER_DAY };
  }
  // 昨日三项达标且没手动领过 → 跨天自动入账（不点不亏，点了只是提前拿）
  const d = state.daily;
  const t = dailyTargets(state.questBest);
  if (!d.claimed && d.quest >= t.quest && d.contrib >= t.contrib && d.onlineMin >= t.onlineMin) {
    const r = dailyReward(state.questBest);
    state.bank += r.salary;
    addContribution(state, r.contribution);
    d.claimed = true;
    pushEvent(state, {
      type: 'reward',
      text: `案牍牌赏钱已自动入账：薪酬 +${r.salary}，贡献 +${r.contribution}`,
    });
  }
  state.daily = emptyDaily(ts);
}

// 办差力 = 职级锚点插值 + 双槽功法级数×5（封顶 50）+ 法器办差力（差事门槛的唯一依据）
// M5.6：职内等级平滑插值；M6.1：职级部分改走 RANK_Z_BASE 锚点（知事满裸 300）；
// 功法贡献封顶 gongfaZCap=50，毕业裸体稳在 350，功法不拉高标尺
export function zabanliOf(state) {
  return Math.round(
    rankZabanliBase(state.rank, state.rankLvl) +
      Math.min(BALANCE.gongfaZCap, (state.gongfaLvl + state.deptGongfaLvl) * 5) +
      gearTotalPower(state.gear)
  );
}

// 当前部门功法生效的修正系数；未选部门或等级为 0 时全为 0
export function deptMods(state) {
  const dept = state.dept ? findDept(state.dept) : null;
  if (!dept || !state.deptGongfaLvl) return EMPTY_MODS;
  const m = dept.gongfa.mods;
  const lvl = state.deptGongfaLvl;
  return {
    salaryBonus: (m.salaryBonus ?? 0) * lvl,
    drainMult: (m.drainMult ?? 0) * lvl,
    drainCut: Math.min(0.8, (m.drainCut ?? 0) * lvl), // 保底 20% 消耗
    offlineBonus: (m.offlineBonus ?? 0) * lvl,
    costCut: Math.min(0.8, (m.costCut ?? 0) * lvl),
    promoteFeeCut: Math.min(0.8, (m.promoteFeeCut ?? 0) * lvl),
    questSpeedBonus: (m.questSpeedBonus ?? 0) * lvl,
    contribBonus: (m.contribBonus ?? 0) * lvl,
    voyageBonus: (m.voyageBonus ?? 0) * lvl, // M4+ 远航玩法生效
    kaochengBonus: (m.kaochengBonus ?? 0) * lvl, // 考成系统生效
  };
}

// 薪酬速率（灵石/分）= 基础 × 职级 × 功法 × 部门俸禄 × 称号词条 × 通透
export function rateOf(state) {
  const mods = deptMods(state);
  const titleBonus = titleBonuses(state.titles).salary; // M6.5：词条池累加（旧口径等价）
  return (
    BALANCE.salaryPerMin *
    rankMultOf(state.rank, state.rankLvl) *
    (1 + BALANCE.gongfaBonusPerLvl * state.gongfaLvl) *
    (1 + mods.salaryBonus) *
    (1 + titleBonus) *
    (1 + Math.min(0.2, state.tongtou * 0.01)) * // 分支 A：通透值 +1%/点，封顶 +20%
    (1 + heirloomBonusOf(state, 'salary')) // M7 传家神器：均衡款薪酬加成（不进办差力）
  );
}

// 游刃有余（GDD_v2 §6.3）：办差力每超档 1% 提速 0.5%，封顶 +50%；
// 签押房《乡音诀》的办结速度加成叠加其上，总提速封顶 +150%
export function speedBonusOf(state) {
  const q = QUESTS[state.questTier];
  if (!q) return 0;
  const over = Math.max(0, zabanliOf(state) / q.req - 1);
  const ease = Math.min(0.5, over * 0.5);
  return Math.min(1.5, ease + deptMods(state).questSpeedBonus);
}

// 贡献入账（余额+累计+当日进度三处同记）
function addContribution(state, amount) {
  if (amount <= 0) return;
  state.contribution += amount;
  state.contributionTotal += amount;
  if (state.daily) state.daily.contrib += amount;
}

// M7 本周目玩法统计 +1（旧档可能缺 stats 字段，就地补齐）
function bumpStat(state, key) {
  if (!state.stats) state.stats = { quest: 0, enhance: 0, patrol: 0, night: 0, visit: 0 };
  state.stats[key] = (state.stats[key] ?? 0) + 1;
}

function earn(state, minutes, mult) {
  if (minutes <= 0) return;
  const gained = rateOf(state) * mult * minutes;
  state.bank += gained; // 薪酬直接入余额，没有篮子（GDD_v2 §3.1）
  state.totalEarned += gained;
}

// 职级经验入账（M5.6）：未到顶格才累积；同时记入本次 advance 的增量供结算卷轴展示
// M7 资历：每转经验 +10%、5 层封顶（唯一挂点在这，产出侧不乘资历——红线）
function gainRankExp(state, amount) {
  if (amount <= 0) return;
  const topped = state.rank >= RANKS.length - 1 && (state.rankLvl ?? 1) >= 10;
  if (topped) return;
  const seniorityMult = 1 + 0.1 * Math.min(state.seniority ?? 0, 5);
  const gained = amount * seniorityMult;
  state.rankExp = (state.rankExp ?? 0) + gained;
  state.rankExpGain = (state.rankExpGain ?? 0) + gained;
}

// 推进一个时间段。rateMult：在线=1，离线=离线倍率（含部门功法加成）。
// 心力节律全自动（GDD_v2 §8）：正常耗心力产出，耗尽进倦怠，倦怠自动回血复工。
function advanceSegment(state, ms, rateMult) {
  if (ms <= 0) return;
  const minutes = ms / 60000;
  const speed = 1 + speedBonusOf(state);
  if (state.burnout) {
    earn(state, minutes, rateMult * BALANCE.burnoutProdMult);
    state.questProgress += minutes * rateMult * BALANCE.burnoutProdMult * speed;
    gainRankExp(state, minutes * rateMult * BALANCE.burnoutProdMult);
    state.xinli = Math.min(BALANCE.xinliMax, state.xinli + BALANCE.burnoutRecoverPerMin * minutes);
    if (state.xinli >= BALANCE.xinliMax) state.burnout = false; // 回满复工
    return;
  }
  const mods = deptMods(state);
  const wordCut = Math.min(0.8, titleBonuses(state.titles).xinliDrain); // M6.5：词条「心力消耗减免」
  const drainPerMin =
    BALANCE.xinliDrainPerMin * (1 + mods.drainMult) * (1 - mods.drainCut) * (1 - wordCut);
  const drainTotal = drainPerMin * minutes;
  if (state.xinli > drainTotal) {
    earn(state, minutes, rateMult);
    state.questProgress += minutes * rateMult * speed;
    gainRankExp(state, minutes * rateMult);
    state.xinli -= drainTotal;
  } else {
    // 半途耗尽：前段正常产出，后段倦怠产出
    const minsUntilEmpty = state.xinli / drainPerMin;
    earn(state, minsUntilEmpty, rateMult);
    earn(state, minutes - minsUntilEmpty, rateMult * BALANCE.burnoutProdMult);
    state.questProgress +=
      minsUntilEmpty * rateMult * speed +
      (minutes - minsUntilEmpty) * rateMult * BALANCE.burnoutProdMult * speed;
    gainRankExp(state, minsUntilEmpty * rateMult + (minutes - minsUntilEmpty) * rateMult * BALANCE.burnoutProdMult);
    state.xinli = 0;
    state.burnout = true;
  }
}

// 办差力允许的最高档位（自动切档用）
function bestTierFor(state) {
  const z = zabanliOf(state);
  let best = 0;
  for (let i = 0; i < QUESTS.length; i++) {
    if (z >= QUESTS[i].req) best = i;
  }
  return best;
}

// 差事办结：进度攒满自动结算，可连续办结；办结后自动切到能接的最高档。
// 首办里程碑：大额贡献 + 称号 + 邸报记录（GDD_v2 §6.2）
// M5：每办结 40 次掉落一页旧账册（上限 8 页）
function settleQuests(state) {
  const mods = deptMods(state);
  const titleBonus = titleBonuses(state.titles).contrib; // M6.5：词条池累加（旧口径等价）
  for (let guard = 0; guard < 20000; guard++) {
    const q = QUESTS[state.questTier];
    if (!q || state.questProgress < q.mins) break;
    const questBonus = heirloomBonusOf(state, 'quest'); // M7 神器「案牍深」：差事结算收益
    state.questProgress -= q.mins;
    state.bank += Math.floor(q.salary * (1 + questBonus));
    addContribution(state, Math.floor(q.contrib * (1 + mods.contribBonus + titleBonus + questBonus)));
    gainRankExp(state, q.mins * RANK_EXP.questExpRatio); // M5.6：办结加送经验（耗时 20%）
    state.questCount += 1;
    bumpStat(state, 'quest');
    if (state.daily) state.daily.quest += 1;
    if (state.questTier > state.questBest) state.questBest = state.questTier;
    // 首办里程碑
    if (!state.questFirsts.includes(state.questTier)) {
      state.questFirsts.push(state.questTier);
      const title = QUEST_TITLES[state.questTier];
      if (title) {
        state.titles.push(title.id);
        addContribution(state, firstBonusOf(state.questTier));
        pushEvent(state, {
          type: 'milestone',
          text: `「${q.name}」首次办结，授号「${title.name}」——${title.flavor}`,
        });
      }
    }
    // 旧账册掉落：残页散在案牍山的公文堆里
    if (
      state.ledger < LEDGER_PAGES.length &&
      state.questCount >= (state.ledger + 1) * LEDGER_MATS_PER_PAGE
    ) {
      state.ledger += 1;
      if (!state.fork) {
        state.huanmie = Math.min(HUANMIE_MAX, state.huanmie + HUANMIE_PER_LEDGER);
      } else if (state.fork === 'chose_stay') {
        state.tongtou += 1; // 觉醒后读到真相，只剩一声笑
      }
    }
    // 自动切档（GDD_v2 §4.1）：办结即换挡，不浪费半点进度；手动锁定除外
    if (state.questLocked === null) {
      const best = bestTierFor(state);
      if (best > state.questTier) {
        state.questTier = best;
        state.questProgress = 0;
      }
    }
  }
}

// 成长消费已全部改为手动（用户决议 2026-08-14）：autoSpend 已移除，
// 旧档遗留的 auto 字段不再被任何逻辑读取，存档不作废。

// ---------- M5.7 串门子：每日限次拜访他房，听轶事、收回礼，佐料不碰产出 ----------
// M6.1 改洗牌袋散排（一轮内绝不重复）+ NPC 交互事件：约半数回礼、半数惩罚。
// 回礼标尺：灵石 = 当前薪酬速率×8 分钟（向下取整），或固定 30 贡献。
// 惩罚标尺（用户决议：温和，最重 = 六小时收益减半的等量尺度）：
//   small=8 分钟 / mid=30 分钟 / big=180 分钟 薪酬等量，一次性结算，不做持续减益；
//   只扣薪酬余额（不扣 totalEarned/贡献），保底 0。
export const PENALTY_MINS = { small: 8, mid: 30, big: 180 };

export function doVisit(state, deptId, rng = Math.random) {
  if (!state.dept) return { ok: false, error: '尚未入房当差，串不得门' };
  const dept = findDept(deptId);
  if (!dept) return { ok: false, error: '衙门名册上没有这一房' };
  if (deptId === state.dept) return { ok: false, error: '这是你本房，不必串门' };
  if (!state.visits || state.visits.date !== todayStr(Date.now())) {
    state.visits = { date: todayStr(Date.now()), left: VISITS_PER_DAY };
  }
  if (state.visits.left <= 0) return { ok: false, error: '今日脚力用完了，明日请早' };
  if (!state.decks) state.decks = {}; // 旧档兼容：缺字段时现补
  const ev = drawDeckEvent(state.decks, deptId, rng);
  if (!ev) return { ok: false, error: '这一房今日闭门谢客' };
  state.visits.left -= 1;
  bumpStat(state, 'visit');
  state.lastVisitId = ev.id; // 旧字段留档兼容，不再参与抽签
  let gift = null;
  let loss = null;
  const visitBonus = 1 + heirloomBonusOf(state, 'visit'); // M7 神器「串门广」：回礼加成（不放大破财）
  if (ev.gift === 'bank') {
    const amount = Math.max(1, Math.floor(rateOf(state) * 8 * visitBonus));
    state.bank += amount;
    state.totalEarned += amount;
    gift = { bank: amount };
  } else if (ev.gift === 'contrib') {
    const amount = Math.floor(30 * visitBonus);
    addContribution(state, amount);
    gift = { contrib: amount };
  } else if (ev.penalty) {
    const amount = Math.min(state.bank, Math.floor(rateOf(state) * PENALTY_MINS[ev.penalty]));
    if (amount > 0) state.bank -= amount;
    loss = { bank: amount };
  }
  if (ev.clue && !state.clues.includes(ev.id)) state.clues.push(ev.id); // 暗线静默记录，不显山露水
  pushEvent(state, { type: 'visit', text: `串门「${dept.name}」，听了段轶闻${gift ? '，还带回一份回礼' : ''}${loss ? '，破了点小财' : ''}` });
  // 返回时剥掉 clue 标记：暗线只埋不揭
  return {
    ok: true,
    event: { id: ev.id, dept: ev.dept, text: ev.text, gift: ev.gift ?? null, penalty: ev.penalty ?? null, npcId: ev.npcId ?? null },
    gift,
    loss,
  };
}

// ---------- M6.5 外差秘境与凌霄阶（GDD_v2 §10）：一键结算、不打不亏、失败零惩罚 ----------

// 授号（幂等）：已有不重发，邸报留痕
function grantTitle(state, id) {
  const t = titleOf(id);
  if (!t || (state.titles ?? []).includes(id)) return false;
  state.titles.push(id);
  pushEvent(state, { type: 'milestone', text: `授号「${t.name}」——${t.flavor}` });
  return true;
}

// 悬案词缀每日一抽：4 条洗牌袋，一轮内不重复
function drawNightAffix(realm, rng = Math.random) {
  if (!realm.affixBag || !Array.isArray(realm.affixBag.cards) || realm.affixBag.cards.length === 0) {
    const cards = NIGHT_AFFIXES.map((a) => a.id);
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    realm.affixBag = { cards };
  }
  return realm.affixBag.cards.pop();
}

// 旧档兼容：缺 realm/ladder/bag 时现补（路由层 merge defaultState 已兜底，此处双保险）
function ensureRealmFields(state) {
  if (!state.realm) {
    state.realm = {
      date: todayStr(Date.now()),
      patrolLeft: REALM_PER_DAY,
      nightLeft: REALM_PER_DAY,
      nightAffix: null,
      affixBag: null,
      solvedTotal: 0,
    };
    state.realm.nightAffix = drawNightAffix(state.realm);
  }
  if (!state.ladder) state.ladder = { cleared: 0, sweptDate: null };
  if (!Array.isArray(state.bag)) state.bag = [];
}

function affixOf(state) {
  return NIGHT_AFFIXES.find((a) => a.id === state.realm?.nightAffix) ?? NIGHT_AFFIXES[NIGHT_AFFIXES.length - 1];
}

// 掉落入背包：满员自动折卖 BAG_OVERFLOW_SELL 贡献（邸报一句"当了"）
function bagReceive(state, item) {
  if (state.bag.length >= BAG_MAX) {
    addContribution(state, BAG_OVERFLOW_SELL);
    pushEvent(state, { type: 'realm', text: `背包已满，「${item.name}」径直当了 ${BAG_OVERFLOW_SELL} 贡献。` });
    return { sold: true, value: BAG_OVERFLOW_SELL };
  }
  state.bag.push(item);
  return { sold: false, item };
}

// 例巡（小秘境）：必成功，一键即成；贡献随通档加深 + 薪酬 5 分钟等量 + 12% 掉法器
export function doPatrol(state, rng = Math.random) {
  ensureRealmFields(state);
  if (state.realm.date !== todayStr(Date.now())) {
    return { ok: false, error: '例巡牌子还没换今日的名录，稍候' };
  }
  if (state.realm.patrolLeft <= 0) return { ok: false, error: '今日例巡已毕，明日请早' };
  state.realm.patrolLeft -= 1;
  bumpStat(state, 'patrol');
  const gain = (1 + titleBonuses(state.titles).realmGain) * (1 + heirloomBonusOf(state, 'realm')); // M7 神器「秘境勤」
  const contrib = Math.floor(patrolContrib(state.questBest) * gain);
  const salary = Math.floor(rateOf(state) * PATROL_SALARY_MINS * gain);
  addContribution(state, contrib);
  state.bank += salary;
  state.totalEarned += salary;
  let drop = null;
  if (rng() < PATROL_DROP_RATE) drop = bagReceive(state, realmDrop(PATROL_DROP_WEIGHTS, rng));
  pushEvent(state, {
    type: 'realm',
    text: `例巡一圈归来，贡献 +${contrib}，薪酬 +${salary}${drop && !drop.sold ? '，还捡了件法器' : ''}`,
  });
  return { ok: true, contrib, salary, drop };
}

// 夜值悬案（大秘境）：办差力达标则破局；失败零惩罚——无奖励、不倒扣，只留一句邸报
export function doNight(state, rng = Math.random) {
  ensureRealmFields(state);
  if (state.realm.date !== todayStr(Date.now())) {
    return { ok: false, error: '夜值的名册还没换，稍候' };
  }
  if (state.realm.nightLeft <= 0) return { ok: false, error: '今夜灯油用尽，明日再值' };
  state.realm.nightLeft -= 1;
  const affix = affixOf(state);
  const need = nightNeed(state.questBest, affix);
  if (zabanliOf(state) < need) {
    pushEvent(state, { type: 'realm', text: `悬案棘手（词缀「${affix.name}」），今夜没能破局——无伤大雅，明日再试。` });
    return { ok: true, win: false, need, affix: { id: affix.id, name: affix.name } };
  }
  const gain = (1 + titleBonuses(state.titles).realmGain) * (1 + heirloomBonusOf(state, 'realm')) * affix.gainMult; // M7 神器「秘境勤」
  const contrib = Math.floor(nightContrib(state.questBest) * gain);
  addContribution(state, contrib);
  state.realm.solvedTotal += 1;
  bumpStat(state, 'night');
  if (state.realm.solvedTotal >= NIGHT_TITLE_AT) grantTitle(state, NIGHT_TITLE_ID);
  let drop = null;
  if (rng() < NIGHT_DROP_RATE) drop = bagReceive(state, realmDrop(NIGHT_DROP_WEIGHTS, rng));
  pushEvent(state, {
    type: 'realm',
    text: `夜值破局（词缀「${affix.name}」），贡献 +${contrib}${drop && !drop.sold ? '，案底还压着件法器' : ''}`,
  });
  return { ok: true, win: true, need, affix: { id: affix.id, name: affix.name }, contrib, drop };
}

// 凌霄阶登阶：maxSteps 限量（登一层/连闯十层）或 Infinity 一键冲阵到办差力不济；
// 确定性判定，无 RNG 无挫败。M7.6：逐层发文案，≤10 层全量下发，
// 冲阵只精选（首层 + 跨过的里程碑层 + 末两层），响应体不膨胀
export function climbLadder(state, maxSteps = Infinity, rng = Math.random) {
  ensureRealmFields(state);
  const z = zabanliOf(state);
  const nextNeed = ladderNeed(state.ladder.cleared + 1);
  if (z < nextNeed) {
    return { ok: false, error: `办差力不济（下一层需 ${nextNeed}），阶前且缓行` };
  }
  const startFloor = state.ladder.cleared;
  let climbed = 0;
  let contrib = 0;
  const lines = [];
  while (
    state.ladder.cleared < LADDER_FLOORS &&
    z >= ladderNeed(state.ladder.cleared + 1) &&
    climbed < maxSteps
  ) {
    state.ladder.cleared += 1;
    const bonus = ladderFirstBonus(state.ladder.cleared);
    addContribution(state, bonus);
    contrib += bonus;
    climbed += 1;
    lines.push({ floor: state.ladder.cleared, text: pickLadderLine(state.ladder.cleared, rng) });
  }
  for (const m of LADDER_MILESTONES) {
    if (state.ladder.cleared >= m.floor) grantTitle(state, m.titleId);
  }
  pushEvent(state, {
    type: 'realm',
    text:
      state.ladder.cleared >= LADDER_FLOORS
        ? `凌霄阶一千层尽数踏遍，贡献 +${contrib}——绝顶的风，不过如此。`
        : `凌霄阶连闯 ${climbed} 层，至第 ${state.ladder.cleared} 层，贡献 +${contrib}`,
  });
  let outLines = lines;
  if (lines.length > 10) {
    const keep = new Set([lines[0].floor, lines[lines.length - 2].floor, lines[lines.length - 1].floor]);
    for (const m of LADDER_MILESTONES) {
      if (m.floor > startFloor && m.floor <= state.ladder.cleared) keep.add(m.floor);
    }
    outLines = lines.filter((l) => keep.has(l.floor));
  }
  return { ok: true, climbed, cleared: state.ladder.cleared, contrib, lines: outLines };
}

// 凌霄阶每日扫荡：已通层数 × 0.5 贡献，一日一次，不扫不亏
export function sweepLadder(state) {
  ensureRealmFields(state);
  if (state.ladder.cleared <= 0) return { ok: false, error: '尚未登阶，无层可扫' };
  if (state.ladder.sweptDate === todayStr(Date.now())) return { ok: false, error: '今日已扫过一遍，明日请早' };
  const bonus = ladderSweepBonus(state.ladder.cleared);
  addContribution(state, bonus);
  state.ladder.sweptDate = todayStr(Date.now());
  pushEvent(state, { type: 'realm', text: `凌霄阶旧路重扫一遍，贡献 +${bonus}` });
  return { ok: true, bonus, cleared: state.ladder.cleared };
}

// 背包装备：选中入对应槽，槽内旧件回背包（不自动回收——花销去向玩家做主）
export function equipBagItem(state, idx) {
  ensureRealmFields(state);
  const item = state.bag[idx];
  if (!item) return { ok: false, error: '背包里没有这件' };
  if (!(item.slot in state.gear)) return { ok: false, error: '没有这个法器槽位' };
  const old = state.gear[item.slot];
  state.gear[item.slot] = item;
  state.bag.splice(idx, 1);
  if (old) state.bag.push(old); // 刚取出一件，必有空位
  return { ok: true, equipped: item, returned: old ?? null };
}

// 背包折卖：底值一半 + 强化成长 1/级（与锻造投入同源不贬值）
export function sellBagItem(state, idx) {
  ensureRealmFields(state);
  const item = state.bag[idx];
  if (!item) return { ok: false, error: '背包里没有这件' };
  const value = sellValue(item);
  state.bag.splice(idx, 1);
  addContribution(state, Math.max(1, value));
  return { ok: true, value: Math.max(1, value), sold: item };
}

// ---------- M5 仙籍大饼：进度、门槛与撞墙 ----------

// 仙籍进度（惰性折算）：服役每整日 +8，累计贡献每 50 点 +1（GDD_v2 §12）
export function xianjiProgress(state, ts) {
  const days = Math.floor(Math.max(0, ts - state.createdAt) / 86400000);
  return Math.floor(days * XIANJI_PER_DAY + (state.contributionTotal ?? 0) * BALANCE.xianjiPerContrib);
}

// 芝诺龟门槛：每撞一次墙，门槛 ×1.35
export function xianjiThreshold(stage) {
  return Math.floor(XIANJI_THRESHOLD_BASE * Math.pow(XIANJI_THRESHOLD_GROWTH, stage));
}

// 撞墙检查：进度达标即画饼——告示换新、幻灭充能（觉醒后改为通透）
function checkXianjiWall(state, ts) {
  while (state.xianjiStage < XIANJI_NOTICES.length && xianjiProgress(state, ts) >= xianjiThreshold(state.xianjiStage)) {
    state.xianjiStage += 1;
    state.wallNotice = XIANJI_NOTICES[state.xianjiStage - 1];
    if (!state.fork) {
      state.huanmie = Math.min(HUANMIE_MAX, state.huanmie + HUANMIE_PER_WALL);
    } else if (state.fork === 'chose_stay') {
      state.tongtou += 1; // 画饼由压力变笑点
    }
  }
  // 幻灭注满 → 岔路事件必然降临
  if (!state.fork && state.huanmie >= HUANMIE_MAX) {
    state.fork = 'pending';
  }
}

// 从 state.lastTickAt 推进到 toTs。
// 时间段拆成「离线段（较早，封顶 12h）+ 在线段（最近 30 秒 grace）」（GDD_v2 §3.3）。
export function advance(state, toTs) {
  const dt = Math.max(0, toTs - state.lastTickAt);
  state.rankExpGain = 0; // 本次推进的经验增量（结算卷轴展示用）
  const onlineMs = Math.min(dt, BALANCE.onlineGraceMs);
  const offlineMs = Math.min(dt - onlineMs, OFFLINE_CAP_MS); // 超出 12h 的部分丢弃
  const offlineRate = Math.min(1, BALANCE.offlineRate + deptMods(state).offlineBonus);
  advanceSegment(state, offlineMs, offlineRate);
  advanceSegment(state, onlineMs, 1);
  // 在线心跳分钟数进案牍牌（前端 10 秒轮询 = 心跳）
  if (state.daily) state.daily.onlineMin += onlineMs / 60000;
  state.lastTickAt = toTs;
  settleQuests(state);
  checkXianjiWall(state, toTs);
  // M6.8 日常事件：只吃在线段（离线不触发），到点发一条，轻奖无罚
  if (onlineMs > 0) tickDailyEvents(state, toTs, rateOf(state));
  // M7.5 监正争夺战：二周目 + 办差力进榜前五，惰性开议（不点不亏不过期）
  tickJianzheng(state);
  return state;
}

// 手动锁定差事档位（策略选项，GDD_v2 §4.2）；锁定后不再自动升档
export function selectQuestTier(state, tier) {
  const q = QUESTS[tier];
  if (!q) return { ok: false, error: '案牍山上没有这档差事' };
  if (zabanliOf(state) < q.req) {
    return { ok: false, error: `办差力不济（需 ${q.req}），这差事接不下` };
  }
  state.questTier = tier;
  state.questLocked = tier;
  state.questProgress = 0;
  return { ok: true };
}

// 解除锁定，恢复自动挂最高档
export function releaseQuestLock(state) {
  state.questLocked = null;
  return { ok: true };
}

// 晋升（M5.6）：职内升级吃经验；Lv10 跨职吃打点费（经验已在升级路上攒足）；
// 知事 Lv10 为编外顶格。经验可存可结转，不点零损失。
export function doPromote(state) {
  const lvl = state.rankLvl ?? 1;
  if (lvl < 10) {
    const need = rankLevelNeed(state.rank, lvl);
    if ((state.rankExp ?? 0) < need) return { ok: false, error: '经验未足，再挂一会儿' };
    state.rankExp -= need;
    state.rankLvl = lvl + 1;
    return { ok: true };
  }
  const next = RANKS[state.rank + 1];
  if (!next) return { ok: false, error: '编外顶格：知事十级已是杂役的尽头' };
  const fee = Math.floor(next.fee * (1 - deptMods(state).promoteFeeCut));
  if (state.bank < fee) return { ok: false, error: '薪酬不够，打点不起' };
  state.bank -= fee;
  state.rank += 1;
  state.rankLvl = 1;
  return { ok: true };
}

// 功法研习费：指数曲线；机巧阁《格物篇》打折（两槽通用）
export function gongfaCost(state) {
  const base = BALANCE.gongfaBaseCost * Math.pow(BALANCE.gongfaGrowth, state.gongfaLvl);
  return Math.floor(base * (1 - deptMods(state).costCut));
}

export function doUpgradeGongfa(state) {
  if ((state.gongfaLvl ?? 0) >= BALANCE.gongfaMax) return { ok: false, error: '功法已臻化境，再无心得可参' };
  const cost = gongfaCost(state);
  if (state.bank < cost) return { ok: false, error: '薪酬不够，买不起心得' };
  state.bank -= cost;
  state.gongfaLvl += 1;
  return { ok: true };
}

// ---------- M3 部门与部门功法 ----------

// 选任部门：一生一次，选定不悔（转生才能换）
// M7 辞官转生号（legacyBoon）：新房选任成功一次性发 100 经验「前世余荫」，邸报记一条
export function chooseDept(state, deptId) {
  if (state.dept) return { ok: false, error: '出身已定，改换门庭须待转生' };
  if (!findDept(deptId)) return { ok: false, error: '衙门里没有这个房头' };
  state.dept = deptId;
  let boon = false;
  if (state.legacyBoon) {
    state.legacyBoon = false;
    gainRankExp(state, 100);
    pushEvent(state, { type: 'milestone', text: '前世余荫：不知为何，这间衙门的门道你一看就懂（+100 经验）' });
    boon = true;
  }
  return { ok: true, boon };
}

// 部门功法研习费：与通用槽同曲线，同样吃《格物篇》折扣
export function deptGongfaCost(state) {
  const base = BALANCE.gongfaBaseCost * Math.pow(BALANCE.gongfaGrowth, state.deptGongfaLvl);
  return Math.floor(base * (1 - deptMods(state).costCut));
}

export function doUpgradeDeptGongfa(state) {
  if (!state.dept) return { ok: false, error: '尚未选任部门，无本门心法可习' };
  if ((state.deptGongfaLvl ?? 0) >= BALANCE.gongfaMax) return { ok: false, error: '本门心法已臻化境，再无心得可参' };
  const cost = deptGongfaCost(state);
  if (state.bank < cost) return { ok: false, error: '薪酬不够，买不起本门心得' };
  state.bank -= cost;
  state.deptGongfaLvl += 1;
  return { ok: true };
}

// ---------- M5.5 机巧阁：锻造（保底）与强化（20 级 + 淬炼保护） ----------

// 锻造：吃贡献，指定槽位出一件随机品质法器；连 10 锻未出灵品 → 保底
export function doForge(state, slot, rand) {
  if (!(slot in state.gear)) return { ok: false, error: '没有这个法器槽位' };
  if (state.contribution < FORGE_COST.contribution) {
    return { ok: false, error: `贡献不够（需 ${FORGE_COST.contribution}）` };
  }
  state.contribution -= FORGE_COST.contribution;
  const guaranteed = state.forgePity >= FORGE_PITY_MAX;
  const item = forgeItem(slot, rand, guaranteed);
  state.gear[slot] = item;
  state.forgePity = item.rarity >= 2 ? 0 : state.forgePity + 1;
  if (state.daily) state.daily.forge += 1;
  return { ok: true, item, guaranteed };
}

// 强化：吃贡献，上限 +20。失败只掉 1 级（挫败感红线）；
// +16 起每次失败积 1 层淬炼，每层 +10% 成功率，成功清零（GDD_v2 §7.3）
export function doEnhance(state, slot, rand = Math.random()) {
  const item = state.gear[slot];
  if (!item) return { ok: false, error: '此槽尚无法器，先去锻造' };
  if (item.lvl >= MAX_ENHANCE) return { ok: false, error: '已至 +20 顶格，无需再炼' };
  const cost = enhanceCost(item);
  const costCut = heirloomBonusOf(state, 'enhance'); // M7 神器「锻造勤」：强化费用减免
  const need = Math.max(1, Math.floor(cost.contribution * (1 - costCut)));
  if (state.contribution < need) {
    return { ok: false, error: `贡献不够（需 ${need}）` };
  }
  state.contribution -= need;
  bumpStat(state, 'enhance');
  const from = item.lvl;
  const temper = item.temper ?? 0;
  const failRate = Math.max(0, enhanceFailRate(from) - temper * 0.1);
  if (rand < failRate) {
    item.lvl = Math.max(1, from - 1); // 只掉 1 级，绝不清级回档
    if (from >= 16) item.temper = temper + 1; // 淬炼积层
    return { ok: true, success: false, power: gearPower(item), temper: item.temper };
  }
  item.lvl = from + 1;
  item.temper = 0;
  return { ok: true, success: true, power: gearPower(item), temper: 0 };
}

// ---------- 每日案牍牌（自动里程碑 + 一键领赏，GDD_v2 §9） ----------

// 一键领赏：三项达标且当日未领（跨天未领会被 ensureDaily 自动入账）
export function claimDaily(state) {
  const d = state.daily;
  if (!d) return { ok: false, error: '案牍牌还没挂出来' };
  if (d.claimed) return { ok: false, error: '今日赏已领过，明日请早' };
  const t = dailyTargets(state.questBest);
  const met = d.quest >= t.quest && d.contrib >= t.contrib && d.onlineMin >= t.onlineMin;
  if (!met) return { ok: false, error: '差事未办齐，赏钱领不得' };
  const reward = dailyReward(state.questBest);
  state.bank += reward.salary;
  addContribution(state, reward.contribution);
  d.claimed = true;
  return { ok: true, reward };
}

// ---------- M5 岔路事件与分支 A ----------

// ---------- M7 转生二周目 ----------

// 转生结算（GDD_v2 §19/§20）：先读本周目数据铸神器，再按清单重置/保留。
// route：'stay' = 留任转生（dept 不变，本门功法 Lv2 起步）；'leave' = 辞官转生
// （dept 归 null 回选任屏 + 前世余荫标记）。保留：账册/称号/仙籍冻结态/通透/神器收藏。
export function rebirth(state, route, ts = Date.now()) {
  if (route !== 'stay' && route !== 'leave') return { ok: false, error: '交接文书上没有这条路' };
  if (route === 'stay' && state.fork !== 'chose_stay') {
    return { ok: false, error: '交接文书还没备好' };
  }
  // 1. 铸神器（重置前读旧数据）：X = min(8, 3+转生前资历)
  const seniorityBefore = state.seniority ?? 0;
  const loopBefore = state.loop ?? 1;
  const heirloom = forgeHeirloom(state.stats ?? {}, seniorityBefore, loopBefore);
  if (!Array.isArray(state.heirlooms)) state.heirlooms = [];
  state.heirlooms.push(heirloom);

  // 2. 重置：两线资源 / 职级三件套 / 功法 / 法器 / 差事四件 / 每日 / 外差 / 凌霄阶 / 串门 / 事件杂项
  state.bank = 0;
  state.contribution = 0;
  state.contributionTotal = 0;
  state.totalEarned = 0;
  state.xinli = BALANCE.xinliMax;
  state.burnout = false;
  state.rank = 0;
  state.rankLvl = 1;
  state.rankExp = 0;
  state.rankExpGain = 0;
  state.gongfaLvl = 0;
  state.gear = emptyGear();
  state.bag = [];
  state.forgePity = 0;
  state.questTier = 0;
  state.questLocked = null;
  state.questProgress = 0;
  state.questBest = -1;
  state.questCount = 0;
  state.questFirsts = [];
  state.visits = { date: todayStr(ts), left: VISITS_PER_DAY };
  state.decks = {};
  state.realm = {
    date: todayStr(ts),
    patrolLeft: REALM_PER_DAY,
    nightLeft: REALM_PER_DAY,
    nightAffix: null,
    affixBag: null,
    solvedTotal: 0,
  };
  state.ladder = { cleared: 0, sweptDate: null };
  state.daily = emptyDaily(ts);
  state.evDay = null;
  state.evReadTs = 0;
  state.pendingSpecial = null;
  state.huanmie = 0;
  state.fork = null;
  state.wallNotice = null;
  state.stats = { quest: 0, enhance: 0, patrol: 0, night: 0, visit: 0 };

  // 3. 保留（显式不动）：ledger / titles / titleWorn / xianjiStage / tongtou /
  //    heirlooms / heirloomWorn / clues / createdAt

  // 4. 路线差异
  if (route === 'stay') {
    state.deptGongfaLvl = 2; // 本门功法 Lv2 起步
  } else {
    state.dept = null; // 回选任屏，重走失忆梗
    state.deptGongfaLvl = 0;
    state.legacyBoon = true; // 前世余荫：选任新房一次性 +100 经验
  }

  // 5. 周目与资历递增
  state.seniority = seniorityBefore + 1;
  state.loop = loopBefore + 1;

  // 6. 邸报：一条转生 milestone（旧日志清空，新周目从头记）
  state.events = [];
  pushEvent(state, {
    type: 'milestone',
    text: `你办了交接，重新走进衙门（${state.loop}周目）。行囊里多了一件${heirloom.name}（${HEIRLOOM_TRAITS[heirloom.trait].name} · +${heirloom.value}%）`,
  });
  state.lastTickAt = ts;
  return { ok: true, heirloom, loop: state.loop };
}

// 传家槽佩戴/卸下：id 为 null 卸下；非收藏内报 400
export function wearHeirloom(state, id) {
  if (id === null || id === undefined) {
    state.heirloomWorn = null;
    return { ok: true };
  }
  if (!(state.heirlooms ?? []).some((h) => h.id === id)) {
    return { ok: false, error: '传家库里没有这件神器' };
  }
  state.heirloomWorn = id;
  return { ok: true };
}

// 岔路抉择：stay = 觉醒留任（分支 A，存档不废叠加新层）；leave = 辞官转生（M7 转正）
export function chooseFork(state, choice, ts = Date.now()) {
  if (state.fork !== 'pending') return { ok: false, error: '岔路未至，不必急着选' };
  if (choice === 'stay') {
    state.fork = 'chose_stay';
    return { ok: true };
  }
  if (choice === 'leave') {
    state.fork = 'chose_leave'; // 履历记一笔，转生后归 null
    return rebirth(state, 'leave', ts);
  }
  return { ok: false, error: '没有这个选法' };
}

// 撞墙告示阅后回执（前端弹窗关闭时调用）
export function ackWall(state) {
  state.wallNotice = null;
}

// 仙籍面板数据（服务端权威）：进度/门槛/是否已摊牌冻结
export function xianjiInfo(state, ts) {
  const frozen = state.xianjiStage >= XIANJI_NOTICES.length;
  return {
    progress: xianjiProgress(state, ts),
    threshold: frozen ? null : xianjiThreshold(state.xianjiStage),
    stage: state.xianjiStage,
    frozen,
  };
}

// ---------- M7.5 监正争夺战 ----------

// 惰性开议：条件满足且未开过议时，挂 pendingSpecial 金标告示 + 邸报金标预告。
// 只触发一次（jianzheng 建好后不再动），不点不亏不过期。
function tickJianzheng(state) {
  if (!jianzhengReady(state, zabanliOf(state))) return;
  state.jianzheng = { wins: {}, done: false, finishedAt: null };
  state.pendingSpecial = JIANZHENG_SPECIAL_TEXT;
  pushEvent(state, { type: 'milestone', text: JIANZHENG_PREVIEW_TEXT });
}

// 三场对局叙事战：办差力 ≥ 对手即胜；败零惩罚可再战；已胜不必再比。
// 三场全胜 → 讽刺留白结局：授「监正争夺者」称号 + 轻奖贡献，告示摘除。
export function fightJianzheng(state, candidateId) {
  const j = state.jianzheng;
  if (!j) return { ok: false, error: '监正之争尚未开议' };
  if (j.done) return { ok: false, error: '此案已结，不必再议' };
  const c = JIANZHENG_CANDIDATES.find((x) => x.id === candidateId);
  if (!c) return { ok: false, error: '堂上无此对手' };
  if (j.wins[c.id]) return { ok: false, error: '这一场你已赢过，不必再比' };
  const win = zabanliOf(state) >= c.z;
  if (win) j.wins[c.id] = true;
  let finale = null;
  if (win && JIANZHENG_CANDIDATES.every((x) => j.wins[x.id])) {
    j.done = true;
    j.finishedAt = Date.now();
    state.pendingSpecial = null; // 告示摘除，风平浪静依旧
    if (!(state.titles ?? []).includes(JIANZHENG_TITLE_ID)) state.titles.push(JIANZHENG_TITLE_ID);
    addContribution(state, JIANZHENG_FINAL_CONTRIB);
    pushEvent(state, { type: 'milestone', text: `${JIANZHENG_FINAL_TEXT}（授号「监正争夺者」，贡献 +${JIANZHENG_FINAL_CONTRIB}）` });
    finale = JIANZHENG_FINAL_TEXT;
  }
  return { ok: true, win, text: win ? c.winText : c.loseText, finale };
}

// ---------- M9.5 博士支线回收「灯下」 ----------

export const LAMP_TITLE_ID = 'dengxia_tongxing';

// 走近那盏灯：串门集齐四条暗线（LAMP_CLUES）方可回收；授「灯下同行」纯展示称号，
// 零回礼零数值——暗线只埋不揭，答案留白。幂等：收过不重授。旧档无 lampDone 即未收，零迁移。
export function collectLamp(state) {
  const clues = state.clues ?? [];
  if (!LAMP_CLUES.every((id) => clues.includes(id))) {
    return { ok: false, error: '灯还远着——你听来的闲话还没拼成一条路' };
  }
  if (state.lampDone) return { ok: true, already: true };
  state.lampDone = true;
  grantTitle(state, LAMP_TITLE_ID);
  return { ok: true, already: false };
}
