// 外差秘境与凌霄阶（M6.5，GDD_v2 §10）：例巡/夜值悬案/天梯。
// 护栏：一键发起、服务端按办差力自动结算；不打不亏（次数不攒不补）；失败零惩罚。
import { QUESTS, todayStr } from './quests.js';

export const REALM_PER_DAY = 3; // 例巡/夜值悬案各自每日 3 次（用户确认）
export const LADDER_FLOORS = 1000; // 凌霄阶共一千层，不设每日次数上限（用户确认）

// 凌霄阶门槛曲线：第 1 层 10、第 1000 层 460——满配 474 可通关，毕业 350 ≈ 爬到 830 层
export function ladderNeed(n) {
  const k = Math.min(1, Math.max(0, (n - 1) / (LADDER_FLOORS - 1)));
  return Math.round(10 + 450 * Math.pow(k, 1.35));
}

// 每层首通：一次性贡献（1000 层合计约 12000，与一周贡献收入同量级）
export function ladderFirstBonus(n) {
  return Math.floor(2 + n * 0.02);
}

// 每日扫荡：已通层数 × 0.5 贡献（小额，不扫不亏）
export function ladderSweepBonus(cleared) {
  return Math.floor((cleared ?? 0) * 0.5);
}

// 办差力折算层数（百官录·凌霄阶 tab 的 NPC 镜像口径：满足门槛的最高层，不足第 1 层为 0）
export function ladderFloorOfZ(z) {
  let n = 0;
  while (n < LADDER_FLOORS && ladderNeed(n + 1) <= z) n++;
  return n;
}

// 天梯里程碑称号（M6.5 词条制：词条见 titles.js）
export const LADDER_MILESTONES = [
  { floor: 100, titleId: 'baijie_xingzhe' },
  { floor: 500, titleId: 'banshan_tingfeng' },
  { floor: 1000, titleId: 'lingxiao_jueding' },
];

// 夜值悬案词缀：每日一抽（洗牌袋，4 条一轮不重复）
export const NIGHT_AFFIXES = [
  { id: 'anshan', name: '案卷如山', needMult: 1.15, gainMult: 1, text: '卷宗堆得比灯台还高。' },
  { id: 'cuiban', name: '上官催办', needMult: 1.1, gainMult: 1.25, text: '朱批催了三次，赏钱也厚些。' },
  { id: 'yedeng', name: '灯下夜值', needMult: 1, gainMult: 1.15, text: '夜深灯稳，办起案来格外利索。' },
  { id: 'fengping', name: '风平浪静', needMult: 1, gainMult: 1, text: '今夜无事，正好办案。' },
];

// 展示用预抽：GET 状态不落库，也要能报出今日词缀（首次 POST 时 ensureDaily 落库定案）
export function peekNightAffix(realm) {
  if (!realm) return null;
  if (realm.nightAffix) return realm.nightAffix;
  if (realm.date !== todayStr(Date.now())) return null; // 旧档未跨天重置，不预支明日签
  const bag = Array.isArray(realm.affixBag) && realm.affixBag.length
    ? realm.affixBag
    : NIGHT_AFFIXES.map((a) => a.id);
  return bag[Math.floor(Math.random() * bag.length)];
}

// 例巡（小秘境）：必成功；贡献随通档加深，薪酬 = 当前速率×5 分钟
export function patrolContrib(questBest) {
  return 20 + 6 * Math.max(0, questBest ?? 0);
}
export const PATROL_SALARY_MINS = 5;
export const PATROL_DROP_RATE = 0.12;
export const PATROL_DROP_WEIGHTS = [50, 35, 12, 3]; // 凡/灵/仙/巧

// 夜值悬案（大秘境）：门槛 = 最高通档门槛 × 1.15 × 词缀；失败零惩罚
export const NIGHT_BASE_MULT = 1.15;
export const NIGHT_DROP_RATE = 0.25;
export const NIGHT_DROP_WEIGHTS = [5, 40, 35, 20]; // 凡/灵/仙/巧
export const NIGHT_TITLE_AT = 30; // 累计破局 30 次授「悬案克星」
export const NIGHT_TITLE_ID = 'xuanan_kexing';

export function nightNeed(questBest, affix) {
  const q = QUESTS[Math.max(0, Math.min(QUESTS.length - 1, questBest ?? 0))];
  return Math.round(q.req * NIGHT_BASE_MULT * (affix?.needMult ?? 1));
}

// 悬案破局贡献 = 例巡 3 倍（再乘词缀收益系数与词条 realmGain）
export function nightContrib(questBest) {
  return patrolContrib(questBest) * 3;
}

// 背包（M6.5 用户决议）：上限 12 件，满时新掉落自动折卖
export const BAG_MAX = 12;
export const BAG_OVERFLOW_SELL = 40; // 背包满时新掉落自动折卖的贡献
