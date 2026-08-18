// 游戏路由：状态推进 + 晋升/功法 + 部门选任 + 差事/法器/案牍牌 + 离线结算报告
import { Router } from 'express';
import { db, now } from '../db.js';
import { requireAuth } from '../auth.js';
import { BALANCE, OFFLINE_CAP_MS, RANKS, RANK_EXP, RANK_LEVEL_NEEDS, rankLevelNeed } from '../game/config.js';
import { DEPARTMENTS } from '../game/departments.js';
import { QUESTS, dailyTargets, emptyDaily, todayStr } from '../game/quests.js';
import { QUEST_TITLES, ALL_TITLES, TITLE_WORDS, titleOf, wordsTextOf } from '../game/titles.js';
import { GEAR_SLOTS, RARITIES, FORGE_COST, MAX_ENHANCE } from '../game/gear.js';
import { LEDGER_PAGES, xinshiStage } from '../game/xianji.js';
import { NPCS, LEGENDS, npcZabanli } from '../game/npcs.js';
import { LADDER_FLOORS, REALM_PER_DAY, NIGHT_AFFIXES, ladderNeed, ladderFloorOfZ, nightNeed, peekNightAffix } from '../game/realm.js';
import { HEIRLOOM_TRAITS } from '../game/heirlooms.js';
import { JIANZHENG_CANDIDATES, JIANZHENG_TITLE_ID } from '../game/jianzheng.js';
import {
  defaultState,
  advance,
  doPromote,
  doUpgradeGongfa,
  gongfaCost,
  rateOf,
  chooseDept,
  deptGongfaCost,
  doUpgradeDeptGongfa,
  deptMods,
  ensureDaily,
  zabanliOf,
  selectQuestTier,
  releaseQuestLock,
  doForge,
  doEnhance,
  claimDaily,
  chooseFork,
  rebirth,
  wearHeirloom,
  ackWall,
  xianjiInfo,
  speedBonusOf,
  doVisit,
  doPatrol,
  doNight,
  climbLadder,
  sweepLadder,
  equipBagItem,
  sellBagItem,
  fightJianzheng,
  collectLamp,
} from '../game/engine.js';
import { LAMP_CLUES, LAMP_CLUE_TEXTS } from '../game/visits.js';

const router = Router();
router.use(requireAuth);

function loadState(accountId) {
  const row = db.prepare('SELECT payload FROM saves WHERE account_id = ?').get(accountId);
  let state = null;
  if (row) {
    try {
      const parsed = JSON.parse(row.payload);
      // 旧档迁移：缺的新字段用默认值补齐（存档永不作废）
      if (parsed && parsed.v === 1) {
        state = { ...defaultState(now()), ...parsed };
        if (!state.migrated55) {
          // M5.5 经济改造迁移：收菜篮直接入账；灵材按 1:4 折算贡献；
          // 旧案牍牌（收菜/摸鱼口径）当日重挂；强化等级钳在新上限内
          state.bank += Math.floor(state.pool ?? 0);
          const mats = state.materials ?? 0;
          state.contribution += mats * 4;
          state.contributionTotal += mats * 4;
          if (state.daily && state.daily.collect !== undefined) state.daily = emptyDaily(now());
          for (const s of Object.keys(state.gear ?? {})) {
            const g = state.gear[s];
            if (g && g.lvl > MAX_ENHANCE) g.lvl = MAX_ENHANCE;
          }
          state.migrated55 = true;
        }
      }
    } catch {
      /* 坏档重建 */
    }
  }
  return state ?? defaultState(now());
}

function persistState(accountId, state) {
  const ts = now();
  db.prepare(`
    INSERT INTO saves (account_id, payload, updated_at, last_seen_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(account_id) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at,
      last_seen_at = excluded.last_seen_at
  `).run(accountId, JSON.stringify(state), ts, ts);
}

// 客户端拉取配置做本地展示插值（数值以服务端为准）
router.get('/config', (_req, res) => {
  res.json({
    ...BALANCE,
    ranks: RANKS,
    rankLevelNeeds: RANK_LEVEL_NEEDS, // M5.6：每职十级的升级经验表
    rankExpQuestRatio: RANK_EXP.questExpRatio,
    quests: QUESTS,
    gearSlots: GEAR_SLOTS,
    rarities: RARITIES,
    forgeCost: FORGE_COST,
    maxEnhance: MAX_ENHANCE,
    questTitles: QUEST_TITLES,
    npcNames: NPCS.map((n) => ({ id: n.id, name: n.name })), // M6.1：串门交互事件显示同僚名
    // ---------- M6.5 外差 ----------
    allTitles: ALL_TITLES, // 全量称号名册（含秘境/天梯称号）
    titleWords: TITLE_WORDS, // 词条表：titleId → {salary/contrib/realmGain/xinliDrain}
    ladderFloors: LADDER_FLOORS,
    realmPerDay: REALM_PER_DAY,
    nightAffixes: NIGHT_AFFIXES,
    // ---------- M7 转生二周目 ----------
    heirloomTraits: HEIRLOOM_TRAITS, // 神器五特征词条表（传家槽展示/铸词预告用）
    // ---------- M7.5 监正争夺战 ----------
    jianzhengCandidates: JIANZHENG_CANDIDATES, // 三位候选（含 intro/胜负文案），前端卷轴展示用
    jianzhengTitleId: JIANZHENG_TITLE_ID,
    // ---------- M9.5 博士支线「灯下」 ----------
    lampClues: LAMP_CLUES, // 线索 id 全集（前端判定集齐用）
    lampClueTexts: LAMP_CLUE_TEXTS, // 线索原文（卷轴回顾用）
  });
});

// 状态附带实时速率与研习费，供前端展示
function statePayload(state) {
  const next = RANKS[state.rank + 1];
  const ts = now();
  return {
    state,
    ratePerMin: rateOf(state),
    zabanli: zabanliOf(state),
    speedBonus: speedBonusOf(state), // 游刃有余当前提速
    gongfaCost: gongfaCost(state),
    deptGongfaCost: state.dept ? deptGongfaCost(state) : 0,
    // M5.6：职内下一级所需经验（Lv10 为 null，此时晋升只吃打点费）
    rankLevelNeed: rankLevelNeed(state.rank, state.rankLvl ?? 1),
    // M5.7：今日串门剩余次数
    visitsLeft: state.visits?.left ?? 0,
    // 下一级晋升打点费（已含筹云司折扣）；顶格为 null
    nextPromoteFee: next
      ? Math.floor(next.fee * (1 - deptMods(state).promoteFeeCut))
      : null,
    // ---------- M5.5 ----------
    dailyTargets: dailyTargets(state.questBest), // 案牍牌当日目标（随通档加深）
    // M6.5：称号名册附词条文案（多元词条池，持有即生效）
    titles: (state.titles ?? [])
      .map((id) => {
        const t = titleOf(id);
        return t ? { ...t, words: wordsTextOf(id) } : null;
      })
      .filter(Boolean),
    events: state.events ?? [], // 衙门邸报（M6.8 地基）
    // ---------- M6.5 外差秘境与凌霄阶 ----------
    realmInfo: (() => {
      const realm = state.realm ?? { patrolLeft: 0, nightLeft: 0, nightAffix: null, solvedTotal: 0 };
      const affix = NIGHT_AFFIXES.find((a) => a.id === peekNightAffix(realm)) ?? null;
      const cleared = state.ladder?.cleared ?? 0;
      return {
        patrolLeft: realm.patrolLeft ?? 0,
        nightLeft: realm.nightLeft ?? 0,
        solvedTotal: realm.solvedTotal ?? 0,
        affix: affix ? { id: affix.id, name: affix.name, text: affix.text } : null,
        nightNeed: affix ? nightNeed(state.questBest, affix) : null, // 今夜破局门槛
        ladderCleared: cleared,
        ladderTotal: LADDER_FLOORS,
        ladderNextNeed: cleared >= LADDER_FLOORS ? null : ladderNeed(cleared + 1),
        ladderSwept: (state.ladder?.sweptDate ?? null) === todayStr(ts),
      };
    })(),
    // ---------- M5 ----------
    xianji: xianjiInfo(state, ts), // 仙籍进度条（表面目标）
    xinshi: xinshiStage(state.huanmie ?? 0), // 心事：只显示模糊阶段文案，不暴露数字
    fork: state.fork, // 岔路事件状态
    tongtou: state.tongtou ?? 0,
    wallNotice: state.wallNotice, // 待展示的撞墙告示
  };
}

// 部门列表（选任界面用）
router.get('/departments', (_req, res) => {
  res.json({ departments: DEPARTMENTS });
});

// 选任部门：一生一次
router.post('/choose-dept', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  const result = chooseDept(state, req.body?.deptId);
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json(statePayload(state));
});

// 部门功法研习
router.post('/upgrade-dept', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  const result = doUpgradeDeptGongfa(state);
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json(statePayload(state));
});

// 取状态：先推进到当前时刻；离开够久则附带「昨夜衙门记事」（分账明细，GDD_v2 §3.3）
router.get('/state', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  ensureDaily(state, ts);
  const awayMs = ts - state.lastTickAt;
  const bankBefore = state.totalEarned;
  const contribBefore = state.contributionTotal ?? 0;
  const questBefore = state.questCount;
  advance(state, ts);

  let offlineReport = null;
  if (awayMs >= BALANCE.offlineReportMinMs) {
    const salary = Math.floor(state.totalEarned - bankBefore);
    const contribution = Math.floor((state.contributionTotal ?? 0) - contribBefore);
    const quests = state.questCount - questBefore;
    const rankExp = Math.floor(state.rankExpGain ?? 0); // M5.6：本次结算经验增量
    const capped = awayMs >= OFFLINE_CAP_MS + BALANCE.onlineGraceMs;
    offlineReport = { awayMs, salary, contribution, quests, rankExp, capped };
    db.prepare(`
      INSERT INTO offline_settlements (account_id, from_ts, to_ts, summary, settled_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.accountId, ts - awayMs, ts, JSON.stringify({ salary, contribution, quests, rankExp, capped }), ts);
  }

  persistState(req.accountId, state);
  res.json({ ...statePayload(state), offlineReport });
});

// 晋升：花薪酬打点，职级+1（默认自动，此端点留给关闭自动的玩家）
router.post('/promote', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  const result = doPromote(state);
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json(statePayload(state));
});

// 功法研习：《摸鱼心法》+1 级
router.post('/upgrade', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  const result = doUpgradeGongfa(state);
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json(statePayload(state));
});

// ---------- M4 案牍山·法器·每日案牍牌 ----------

// 换挂差事（手动锁档）：办差力达门槛才可接；锁定后不再自动升档
router.post('/quest/select', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  ensureDaily(state, ts);
  const result = selectQuestTier(state, Number(req.body?.tier));
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json(statePayload(state));
});

// 解除锁档：恢复自动挂最高能接的档
router.post('/quest/auto', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  releaseQuestLock(state);
  persistState(req.accountId, state);
  res.json(statePayload(state));
});

// 成长消费全部手动（用户决议 2026-08-14）：/settings 自动开关端点已下线

// M9.5 博士支线回收「灯下」：集齐四条暗线后走近那盏灯，授「灯下同行」纯展示称号
router.post('/lamp', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  const result = collectLamp(state);
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json({ ...statePayload(state), already: result.already });
});

// 串门子（M5.7；M6.1 洗牌袋+惩罚）：拜访他房听轶事，每日限次，半数回礼半数破点小财
router.post('/visit', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  ensureDaily(state, ts);
  const result = doVisit(state, req.body?.deptId);
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json({ ...statePayload(state), visit: result.event, gift: result.gift, loss: result.loss });
});

// 衙门百官录（M6）：办差力单一标准实时排行，NPC 填榜；不写库（周赛季已去除）
router.get('/leaderboard', (req, res) => {
  // 百官录双榜：默认办差力；?by=floors 切凌霄阶层数（同层以办差力先后）
  const byFloors = req.query.by === 'floors';
  const all = [];
  // NPC：与玩家同口径，静态不成长；层数按门槛曲线从办差力折算（镜像口径）
  for (const n of NPCS) {
    const z = npcZabanli(n);
    all.push({
      id: `npc:${n.id}`,
      name: n.name,
      npc: true,
      dept: n.dept,
      rankName: RANKS[n.rank]?.name ?? '杂役',
      rankLvl: n.rankLvl,
      zabanli: z,
      floors: ladderFloorOfZ(z),
      title: null, // NPC 无称号，徽章仅玩家可得
      flavor: n.flavor,
      questBest: null,
      questCount: null,
    });
  }
  // M6.1 传说位：一周目天花板之上的三位前辈，二周目目标
  LEGENDS.forEach((l, i) => {
    all.push({
      id: `legend:${i + 1}`,
      name: l.name,
      npc: true,
      legend: true,
      dept: l.dept,
      rankName: '传说',
      rankLvl: 0,
      zabanli: l.z,
      floors: ladderFloorOfZ(l.z),
      title: null,
      flavor: l.flavor,
      questBest: null,
      questCount: null,
    });
  });
  // 玩家：逐档现算 zabanli（纯函数无需 advance）；坏档/未入房者不上榜
  const saves = db
    .prepare('SELECT a.username AS username, s.payload AS payload FROM saves s JOIN accounts a ON a.id = s.account_id')
    .all();
  for (const row of saves) {
    try {
      const parsed = JSON.parse(row.payload);
      if (!parsed || parsed.v !== 1 || !parsed.dept) continue;
      const state = { ...defaultState(now()), ...parsed };
      const wornId = state.titleWorn ?? state.titles?.[state.titles.length - 1] ?? null;
      all.push({
        id: `player:${row.username}`,
        name: row.username,
        npc: false,
        dept: state.dept,
        rankName: RANKS[state.rank]?.name ?? '杂役',
        rankLvl: state.rankLvl ?? 1,
        zabanli: zabanliOf(state),
        floors: state.ladder?.cleared ?? 0, // 玩家用实际登阶层数
        title: titleOf(wornId)?.name ?? null,
        flavor: null,
        questBest: state.questBest ?? 0,
        questCount: state.questCount ?? 0,
      });
    } catch {
      /* 坏档不上榜 */
    }
  }
  all.sort(byFloors
    ? (a, b) => b.floors - a.floors || b.zabanli - a.zabanli
    : (a, b) => b.zabanli - a.zabanli);
  const meRow = db.prepare('SELECT username FROM accounts WHERE id = ?').get(req.accountId);
  const meIdx = meRow ? all.findIndex((r) => r.id === `player:${meRow.username}`) : -1;
  res.json({
    rows: all.slice(0, 15),
    total: all.length,
    me:
      meIdx >= 0
        ? {
            rank: meIdx + 1,
            zabanli: all[meIdx].zabanli,
            floors: all[meIdx].floors,
            inTop: meIdx < 15,
            // M6.1 拉条：上一名的名字与指标（榜首无上一名）
            above: meIdx > 0
              ? { name: all[meIdx - 1].name, zabanli: all[meIdx - 1].zabanli, floors: all[meIdx - 1].floors }
              : null,
          }
        : null,
  });
});

// 称号佩戴（M6）：仅换排行榜/履历卡上的徽章，属性仍全部持有生效
router.post('/title/wear', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  const id = req.body?.titleId ?? null;
  if (id !== null && !(state.titles ?? []).includes(id)) {
    return res.status(400).json({ error: '这枚称号还没挣来，戴不得' });
  }
  state.titleWorn = id;
  persistState(req.accountId, state);
  res.json(statePayload(state));
});

// 机巧阁锻造：吃贡献，指定槽位出一件随机品质法器（10 锻保底灵品）
router.post('/forge', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  ensureDaily(state, ts);
  const result = doForge(state, req.body?.slot);
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json({ ...statePayload(state), item: result.item });
});

// 强化法器：吃贡献，上限 +20，失败掉 1 级；+16 起淬炼保护积层
router.post('/enhance', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  const result = doEnhance(state, req.body?.slot);
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json({
    ...statePayload(state),
    power: result.power,
    success: result.success,
    temper: result.temper,
  });
});

// 每日案牍牌领赏：一键领，服务端校验三项达标
router.post('/daily/claim', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  ensureDaily(state, ts);
  const result = claimDaily(state);
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json({ ...statePayload(state), reward: result.reward });
});

// ---------- M6.5 外差秘境与凌霄阶（一键结算，不打不亏，失败零惩罚） ----------

// 例巡（小秘境）：每日 3 次，必成功；贡献+薪酬+12% 掉法器
router.post('/realm/patrol', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  ensureDaily(state, ts);
  const result = doPatrol(state);
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json({ ...statePayload(state), patrol: result });
});

// 夜值悬案（大秘境）：每日 3 次；办差力达标破局，失败零惩罚
router.post('/realm/night', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  ensureDaily(state, ts);
  const result = doNight(state);
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json({ ...statePayload(state), night: result });
});

// 凌霄阶登阶：{count} 限量登（1~20，登一层/连闯十层），不带 count 一键冲阵到办差力不济
router.post('/ladder/climb', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  ensureDaily(state, ts);
  const raw = req.body?.count;
  const maxSteps = raw == null ? Infinity : Math.max(1, Math.min(20, Math.floor(Number(raw) || 1)));
  const result = climbLadder(state, maxSteps);
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json({ ...statePayload(state), climb: result });
});

// 凌霄阶每日扫荡：已通层数 × 0.5 贡献，一日一次
router.post('/ladder/sweep', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  ensureDaily(state, ts);
  const result = sweepLadder(state);
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json({ ...statePayload(state), sweep: result });
});

// M7.5 监正争夺战：三场对局叙事战，办差力判定；败零惩罚可再战，全胜授号收卷
router.post('/jianzheng/fight', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  const result = fightJianzheng(state, req.body?.candidateId);
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json({ ...statePayload(state), fight: result });
});

// 背包装备：选中入对应槽，旧件回背包
router.post('/bag/equip', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  const result = equipBagItem(state, Number(req.body?.idx));
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json({ ...statePayload(state), equipped: result.equipped, returned: result.returned });
});

// 背包折卖：底值一半 + 强化成长 1/级，换贡献
router.post('/bag/sell', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  const result = sellBagItem(state, Number(req.body?.idx));
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json({ ...statePayload(state), soldValue: result.value });
});

// ---------- M5 仙籍大饼·旧账册·岔路 ----------

// 旧账册：只回传已收集到的残页（环境叙事，不做目录预告）
router.get('/ledger', (req, res) => {
  const state = loadState(req.accountId);
  res.json({ pages: LEDGER_PAGES.slice(0, state.ledger ?? 0), total: LEDGER_PAGES.length });
});

// 撞墙告示阅后回执：前端弹窗关闭时调用
router.post('/wall/ack', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  ackWall(state);
  persistState(req.accountId, state);
  res.json(statePayload(state));
});

// M6.8 邸报已读回执：展开列表即推平未读水位（不点不亏，红点只是提示）
router.post('/events/ack', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  state.evReadTs = ts;
  persistState(req.accountId, state);
  res.json(statePayload(state));
});

// 岔路抉择：stay = 觉醒留任（分支 A）；leave = 辞官转生（M7 转正，内部走 rebirth）
router.post('/fork/choose', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  ensureDaily(state, ts);
  advance(state, ts);
  const result = chooseFork(state, req.body?.choice, ts);
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json({ ...statePayload(state), rebirth: result.heirloom ? result : undefined });
});

// ---------- M7 转生二周目 ----------

// 留任转生（交接文书）：守卫 fork === 'chose_stay'；铸神器 + 重置/保留清单
router.post('/rebirth', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  ensureDaily(state, ts);
  advance(state, ts);
  const result = rebirth(state, 'stay', ts);
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json({ ...statePayload(state), rebirth: result });
});

// 传家槽佩戴/卸下：{id} 换戴，{id:null} 卸下；非收藏内报 400
router.post('/heirloom/wear', (req, res) => {
  const ts = now();
  const state = loadState(req.accountId);
  advance(state, ts);
  const result = wearHeirloom(state, req.body?.id ?? null);
  if (!result.ok) return res.status(400).json({ error: result.error });
  persistState(req.accountId, state);
  res.json(statePayload(state));
});

export default router;
