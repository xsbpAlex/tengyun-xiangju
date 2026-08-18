// 后端 API 封装：token 存 localStorage，统一挂 Bearer
const TOKEN_KEY = 'ty_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...init?.headers,
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) setToken(null);
    throw new Error((data as { error?: string })?.error ?? `请求失败(${res.status})`);
  }
  return data as T;
}

export interface AccountInfo {
  id: number;
  username: string;
  created_at: number;
}

export interface SaveEnvelope {
  payload: Record<string, unknown>;
  updatedAt: number;
}

// ---------- M1/M2 游戏状态 ----------
export interface RankInfo {
  name: string;
  fee: number;
  mult: number;
}

export interface DeptGongfa {
  name: string;
  desc: string;
  effect: string;
}

export interface DeptInfo {
  id: string;
  name: string;
  role: string;
  style: string;
  desc: string;
  gongfa: DeptGongfa;
}

// ---------- M4 案牍山·法器（M5.5：薪酬/贡献两线结算） ----------
export interface QuestInfo {
  name: string;
  req: number; // 办差力门槛
  mins: number; // 办结所需分钟（受在线/离线/倦怠倍率影响）
  salary: number;
  contrib: number;
}

export interface QuestTitle {
  id: string;
  name: string;
  flavor: string;
  words?: string; // M6.5：词条文案（如「薪酬 +1% · 贡献 +1%」），持有即生效
}

export interface GearSlotInfo {
  id: string;
  name: string;
  desc: string;
}

export interface RarityInfo {
  lvl: number;
  name: string;
  base: number;
  color: number;
}

export interface GearItem {
  name: string;
  slot: string;
  rarity: number;
  lvl: number;
  temper?: number; // 淬炼积层（+16 起失败累积，每层 +10% 成功率）
}

// ---------- M6.5 外差秘境·凌霄阶·背包 ----------
export interface NightAffixInfo {
  id: string;
  name: string;
  text: string;
}

// statePayload.realmInfo：秘境/天梯展示汇总
export interface RealmInfo {
  patrolLeft: number;
  nightLeft: number;
  solvedTotal: number; // 累计破局次数（30 次授「悬案克星」）
  affix: NightAffixInfo | null; // 今日词缀
  nightNeed: number | null; // 今夜破局门槛（含词缀）
  ladderCleared: number;
  ladderTotal: number;
  ladderNextNeed: number | null; // 下一层办差力门槛（通关为 null）
  ladderSwept: boolean; // 今日是否已扫荡
}

// 秘境掉落去向：入背包 or 满员当场折卖
export interface BagDropResult {
  sold: boolean;
  item?: GearItem;
  value?: number;
}

export interface PatrolResult {
  ok: boolean;
  contrib: number;
  salary: number;
  drop: BagDropResult | null;
}

export interface NightResult {
  ok: boolean;
  win: boolean; // false = 未破局（失败零惩罚，无奖励不倒扣）
  need: number;
  affix: { id: string; name: string };
  contrib?: number;
  drop?: BagDropResult | null;
}

export interface ClimbLine {
  floor: number;
  text: string;
}

export interface ClimbResult {
  ok: boolean;
  climbed: number;
  cleared: number;
  contrib: number;
  lines: ClimbLine[]; // M7.6：≤10 层全量；冲阵只精选（首层/里程碑/末两层）
}

// M7.5 监正争夺战：三位候选 + 单场对局结果
export interface JianzhengCandidate {
  id: string;
  name: string;
  dept: string;
  z: number;
  intro: string;
  winText: string;
  loseText: string;
}

export interface JianzhengFightResult {
  ok: boolean;
  win: boolean;
  text: string;
  finale: string | null; // 三场全胜时的留白结局文案，其余时为 null
}

export interface SweepResult {
  ok: boolean;
  bonus: number;
  cleared: number;
}

// M5.5：案牍牌改为自动里程碑（办结/贡献/在线心跳）
export interface DailyState {
  date: string;
  quest: number;
  contrib: number;
  onlineMin: number;
  forge: number;
  claimed: boolean;
}

export interface DailyTargets {
  quest: number;
  contrib: number;
  onlineMin: number;
}

// 邸报条目（M6.8 地基，M5.5 只记里程碑/奖励）
export interface EventEntry {
  ts: number;
  type: string;
  text: string;
}

// ---------- M5 仙籍大饼·岔路 ----------
export interface XianjiInfo {
  progress: number;
  threshold: number | null; // 冻结后为 null
  stage: number;
  frozen: boolean;
}

// ---------- M7 转生二周目 ----------
// 传家神器条目（每转铸一件，单装生效，收藏可换戴）
export interface Heirloom {
  id: string;
  trait: string; // 五特征 id：andu_deep/forge_keen/realm_active/visit_wide/balanced
  name: string;
  value: number; // 加成百分比数值（3~8）
  forgedLoop: number; // 铸造时的周目号
}

export interface HeirloomTraitInfo {
  kind: string; // 引擎挂钩侧
  name: string; // 特征名（如「案牍深」）
  item: string; // 神器名
  desc: string; // 词条说明（如「差事结算收益」）
}

// 本周目玩法统计（转生时先读后清零）
export interface LoopStats {
  quest: number;
  enhance: number;
  patrol: number;
  night: number;
  visit: number;
}

export interface LedgerPage {
  id: number;
  text: string;
}

// M5.7 串门子轶事（结构对齐 GDD_v2 §13.4；暗线标记不下发，只埋不揭）
// M6.1：并入 NPC 交互事件，半数回礼半数破点小财（惩罚只扣薪酬余额）
export interface VisitEvent {
  id: string;
  dept: string;
  text: string;
  gift: 'bank' | 'contrib' | null;
  penalty: 'small' | 'mid' | 'big' | null;
  npcId: string | null; // M6.1：触发事件的同僚（前端配名显示）
}
export interface VisitGift {
  bank?: number;
  contrib?: number;
}

// M6 衙门百官录：办差力单一标准排行（NPC 填榜，玩家挂佩戴称号徽章）
export interface LeaderRow {
  id: string;
  name: string;
  npc: boolean;
  dept: string;
  rankName: string;
  rankLvl: number;
  zabanli: number;
  floors: number; // 凌霄阶层数（玩家实际登阶；NPC 按门槛曲线折算）
  title: string | null;
  flavor: string | null;
  questBest: number | null;
  questCount: number | null;
  legend?: boolean; // M6.1：传说前辈位（二周目目标）
}
export interface LeaderboardData {
  rows: LeaderRow[];
  total: number;
  me: {
    rank: number;
    zabanli: number;
    floors: number;
    inTop: boolean;
    above: { name: string; zabanli: number; floors: number } | null; // M6.1 拉条：上一名（榜首为 null）
  } | null;
}

export interface GameConfig {
  salaryPerMin: number;
  offlineRate: number;
  offlineCapHours: number;
  onlineGraceMs: number;
  xinliMax: number;
  xinliDrainPerMin: number;
  burnoutProdMult: number;
  burnoutRecoverPerMin: number;
  offlineReportMinMs: number;
  gongfaBaseCost: number;
  gongfaGrowth: number;
  gongfaBonusPerLvl: number;
  gongfaMax: number; // M6.1：功法双槽各自封顶等级
  npcNames: { id: string; name: string }[]; // M6.1：同僚名册（前端配名显示）
  ranks: RankInfo[];
  rankLevelNeeds: number[][]; // M5.6：每职十级的升级经验表（每职 9 个升级门槛）
  rankExpQuestRatio: number; // 每办结一件差事加送的经验比例
  // M4 / M5.5
  quests: QuestInfo[];
  gearSlots: GearSlotInfo[];
  rarities: RarityInfo[];
  forgeCost: { contribution: number };
  maxEnhance: number;
  questTitles: QuestTitle[];
  // M6.5 外差
  allTitles: QuestTitle[]; // 全量称号名册（含秘境/天梯称号）
  titleWords: Record<string, Record<string, number>>; // 词条表：titleId → {salary/contrib/realmGain/xinliDrain}
  ladderFloors: number;
  realmPerDay: number;
  nightAffixes: NightAffixInfo[];
  // M7 转生二周目
  heirloomTraits: Record<string, HeirloomTraitInfo>; // 神器五特征词条表
  // M7.5 监正争夺战
  jianzhengCandidates: JianzhengCandidate[]; // 三位候选（含 intro/胜负文案）
  jianzhengTitleId: string;
  // M9.5 博士支线「灯下」
  lampClues: string[]; // 线索 id 全集（集齐判定）
  lampClueTexts: string[]; // 线索原文（卷轴回顾）
}

export interface GameState {
  v: number;
  bank: number;
  contribution: number;
  contributionTotal: number;
  totalEarned: number;
  xinli: number;
  burnout: boolean;
  rank: number;
  rankLvl: number; // M5.6：职内等级 1~10
  rankExp: number; // M5.6：当前累积职级经验（无上限可结转）
  gongfaLvl: number;
  dept: string | null;
  deptGongfaLvl: number;
  // M4 / M5.5
  gear: Record<string, GearItem | null>;
  bag: GearItem[]; // M6.5：秘境掉落暂存，上限 12 件，手动选装
  questTier: number;
  questLocked: number | null; // 手动锁定档位；null = 自动挂最高档
  questProgress: number;
  questBest: number;
  questCount: number;
  questFirsts: number[];
  titles: string[];
  titleWorn: string | null; // M6：佩戴称号（仅展示徽章，属性仍全量生效）
  forgePity: number;
  auto?: { promote: boolean; gongfa: boolean; deptGongfa: boolean }; // 已废：旧档遗留字段，不再读取
  // M5.7 串门子
  visits?: { date: string; left: number };
  lastVisitId: string | null;
  clues: string[];
  lampDone?: boolean; // M9.5 博士支线已回收（旧档缺省即未收）
  daily: DailyState | null;
  // M5
  xianjiStage: number;
  huanmie: number;
  ledger: number;
  fork: string | null;
  tongtou: number;
  wallNotice: string | null;
  // ---------- M7 转生二周目 ----------
  loop: number; // 周目数（转生 +1）
  seniority: number; // 资历：转生次数；经验 +10%/层、5 层封顶
  heirlooms: Heirloom[]; // 传家神器收藏
  heirloomWorn: string | null; // 传家槽当前佩戴神器 id
  stats: LoopStats; // 本周目玩法统计
  legacyBoon: boolean; // 辞官转生「前世余荫」标记
  // ---------- M6.8 事件系统与邸报 ----------
  evReadTs: number; // 邸报已读水位（events 里 ts 大于它即未读）
  pendingSpecial: string | null; // 事件专区待办（M7.5 监正争夺战开议时挂金标告示）
  jianzheng?: { wins: Record<string, boolean>; done: boolean } | null; // M7.5 争夺战进度
  events: EventEntry[];
  createdAt: number;
  lastTickAt: number;
}

// 所有返回状态的接口都附带服务端实时速率与研习费
export interface StatePayload {
  state: GameState;
  ratePerMin: number;
  zabanli: number;
  speedBonus: number; // 游刃有余当前提速（0~1.5）
  gongfaCost: number;
  deptGongfaCost: number;
  rankLevelNeed: number | null; // M5.6：职内下一级所需经验（Lv10 为 null）
  visitsLeft: number; // M5.7：今日串门剩余次数
  nextPromoteFee: number | null;
  // M5.5
  dailyTargets: DailyTargets;
  titles: QuestTitle[];
  events: EventEntry[];
  // M6.5
  realmInfo: RealmInfo;
  // M5
  xianji: XianjiInfo;
  xinshi: string; // 心事：只有模糊阶段文案，不暴露幻灭数值
  fork: string | null;
  tongtou: number;
  wallNotice: string | null;
}

export interface OfflineReport {
  awayMs: number;
  salary: number;
  contribution: number;
  quests: number;
  rankExp?: number; // M5.6：本次结算累积的职级经验
  capped: boolean; // 是否触到 12h 离线封顶
}

export const api = {
  register: (username: string, password: string) =>
    req<{ token: string; username: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  login: (username: string, password: string) =>
    req<{ token: string; username: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => req<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  me: () => req<AccountInfo>('/api/auth/me'),
  getSave: () => req<SaveEnvelope | null>('/api/save'),
  putSave: (payload: Record<string, unknown>) =>
    req<{ ok: true; updatedAt: number }>('/api/save', {
      method: 'PUT',
      body: JSON.stringify({ payload }),
    }),
  // M1 核心循环（M5.5：收菜/摸鱼已移除，全自动入账）
  gameConfig: () => req<GameConfig>('/api/game/config'),
  gameState: () =>
    req<StatePayload & { offlineReport: OfflineReport | null }>('/api/game/state'),
  // M2 宦途·修炼（成长消费全手动，用户决议 2026-08-14）
  promote: () => req<StatePayload>('/api/game/promote', { method: 'POST' }),
  upgrade: () => req<StatePayload>('/api/game/upgrade', { method: 'POST' }),
  // M5.7 串门子：每日限次拜访他房，听轶事；M6.1 半数回礼半数破点小财
  visit: (deptId: string) =>
    req<StatePayload & { visit: VisitEvent; gift: VisitGift | null; loss: VisitGift | null }>('/api/game/visit', {
      method: 'POST',
      body: JSON.stringify({ deptId }),
    }),
  // M6 衙门百官录：办差力排行 + 称号佩戴（仅展示）；by='floors' 切凌霄阶层数榜
  leaderboard: (by?: 'floors') =>
    req<LeaderboardData>(`/api/game/leaderboard${by ? `?by=${by}` : ''}`),
  wearTitle: (titleId: string | null) =>
    req<StatePayload>('/api/game/title/wear', {
      method: 'POST',
      body: JSON.stringify({ titleId }),
    }),
  // M3 部门·功法双槽
  departments: () => req<{ departments: DeptInfo[] }>('/api/game/departments'),
  chooseDept: (deptId: string) =>
    req<StatePayload>('/api/game/choose-dept', {
      method: 'POST',
      body: JSON.stringify({ deptId }),
    }),
  upgradeDept: () => req<StatePayload>('/api/game/upgrade-dept', { method: 'POST' }),
  // M4 案牍山·法器·每日案牍牌（M5.5：锁档/自动/设置）
  questSelect: (tier: number) =>
    req<StatePayload>('/api/game/quest/select', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    }),
  questAuto: () => req<StatePayload>('/api/game/quest/auto', { method: 'POST' }),
  forge: (slot: string) =>
    req<StatePayload & { item: GearItem; guaranteed: boolean }>('/api/game/forge', {
      method: 'POST',
      body: JSON.stringify({ slot }),
    }),
  enhance: (slot: string) =>
    req<StatePayload & { power: number; success: boolean; temper: number }>('/api/game/enhance', {
      method: 'POST',
      body: JSON.stringify({ slot }),
    }),
  claimDaily: () =>
    req<StatePayload & { reward: { salary: number; contribution: number } }>('/api/game/daily/claim', {
      method: 'POST',
    }),
  // M6.5 外差秘境·凌霄阶·背包（一键结算，失败零惩罚，不点不亏）
  realmPatrol: () =>
    req<StatePayload & { patrol: PatrolResult }>('/api/game/realm/patrol', { method: 'POST' }),
  realmNight: () =>
    req<StatePayload & { night: NightResult }>('/api/game/realm/night', { method: 'POST' }),
  ladderClimb: (count?: number) =>
    req<StatePayload & { climb: ClimbResult }>('/api/game/ladder/climb', {
      method: 'POST',
      body: JSON.stringify(count ? { count } : {}),
    }),
  ladderSweep: () =>
    req<StatePayload & { sweep: SweepResult }>('/api/game/ladder/sweep', { method: 'POST' }),
  jianzhengFight: (candidateId: string) =>
    req<StatePayload & { fight: JianzhengFightResult }>('/api/game/jianzheng/fight', {
      method: 'POST',
      body: JSON.stringify({ candidateId }),
    }),
  // M9.5 博士支线：走近那盏灯
  lamp: () => req<StatePayload & { already: boolean }>('/api/game/lamp', { method: 'POST' }),
  bagEquip: (idx: number) =>
    req<StatePayload & { equipped: GearItem; returned: GearItem | null }>('/api/game/bag/equip', {
      method: 'POST',
      body: JSON.stringify({ idx }),
    }),
  bagSell: (idx: number) =>
    req<StatePayload & { soldValue: number }>('/api/game/bag/sell', {
      method: 'POST',
      body: JSON.stringify({ idx }),
    }),
  // M5 仙籍大饼·旧账册·岔路
  ledger: () => req<{ pages: LedgerPage[]; total: number }>('/api/game/ledger'),
  wallAck: () => req<StatePayload>('/api/game/wall/ack', { method: 'POST' }),
  eventsAck: () => req<StatePayload>('/api/game/events/ack', { method: 'POST' }),
  forkChoose: (choice: string) =>
    req<StatePayload & { rebirth?: { ok: boolean; heirloom: Heirloom; loop: number } }>('/api/game/fork/choose', {
      method: 'POST',
      body: JSON.stringify({ choice }),
    }),
  // M7 转生二周目：留任转生（交接文书）/ 传家槽佩戴换戴
  rebirth: () =>
    req<StatePayload & { rebirth: { ok: boolean; heirloom: Heirloom; loop: number } }>('/api/game/rebirth', {
      method: 'POST',
    }),
  heirloomWear: (id: string | null) =>
    req<StatePayload>('/api/game/heirloom/wear', {
      method: 'POST',
      body: JSON.stringify({ id }),
    }),
};
