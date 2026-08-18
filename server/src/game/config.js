// 数值配置：M5.5 经济底层改造（GDD_v2 §3/§12），调参目标见 GDD_v2 §14
export const BALANCE = {
  salaryPerMin: 6, // 基础薪酬产出：灵石/分钟
  offlineRate: 0.6, // 离线收益倍率
  offlineCapHours: 12, // 离线结算封顶（GDD_v2 §3.3：超出部分丢弃）
  onlineGraceMs: 30 * 1000, // 距上次交互 30 秒内视为在线（全额产出）
  xinliMax: 100,
  xinliDrainPerMin: 0.21, // 心力消耗/分钟（约 8 小时耗尽 → 倦怠）
  burnoutProdMult: 0.3, // 倦怠期产出倍率
  burnoutRecoverPerMin: 0.35, // 倦怠期心力自动回血/分（约 5 小时回满复工，GDD_v2 §8 呼吸节律）
  offlineReportMinMs: 5 * 60 * 1000, // 离开超过 5 分钟才弹「昨夜衙门记事」
  gongfaBaseCost: 150, // 功法首级研习费
  gongfaGrowth: 1.9, // 功法费用增长曲线
  gongfaBonusPerLvl: 0.15, // 功法每级产出加成
  gongfaMax: 10, // M6.1：功法双槽各自封顶 Lv10（产出加成仍 15%/级）
  gongfaZCap: 50, // M6.1：功法对办差力的贡献封顶（毕业裸体 300+50=350，功法不拉高标尺）
  xianjiPerContrib: 1 / 50, // 仙籍进度折算：累计贡献（GDD_v2 §12：贡献是画饼的原料）
};

export const OFFLINE_CAP_MS = BALANCE.offlineCapHours * 3600 * 1000;

// 职级天梯（GDD_v2 §11.2）。少监及以上设定上只由外派仙吏出任——
// 编外玩家止步于「知事」，这就是编外天花板，仙籍大饼的前奏。
// M5.6：每职 1~10 级，职内升级吃挂机经验，跨职打点才吃灵石；
// 费用表按一周终局重排（每笔 ≤ 约 1 天收入）。
// M6.1 数值重定：倍率拉陡只驱动产出速率；办差力另走 RANK_Z_BASE 锚点插值
// （新号 10、毕业裸体 300+功法 50=350），差事门槛表（10→440）与 NPC 档位均锚定锚点曲线。
export const RANKS = [
  { name: '帮闲', fee: 0, mult: 1 },
  { name: '书吏', fee: 200, mult: 1.5 },
  { name: '资深书吏', fee: 600, mult: 2.2 },
  { name: '管事', fee: 1500, mult: 3.2 },
  { name: '副主事', fee: 4000, mult: 4.6 },
  { name: '高级副主事', fee: 9000, mult: 7 },
  { name: '知事', fee: 18000, mult: 15 },
];

// ---------- M5.6 职级经验（挂机积累，可存可结转，不点零损失） ----------
export const RANK_EXP = {
  questExpRatio: 0.2, // 每办结一件差事，加送该差事耗时 20% 的经验
  totals: [500, 560, 630, 705, 790, 885, 990], // 每职 Lv1→Lv10 总经验（典型玩家约一周摸到知事满级）
  weights: [4, 6, 8, 10, 12, 14, 16, 18, 20, 22], // 职内十级分配权重（前密后疏，权重和=130）
};

// 职内第 lvl 级→第 lvl+1 级所需经验；Lv10 返回 null（再升须跨职打点）
export function rankLevelNeed(rankIdx, lvl) {
  if (lvl >= 10) return null;
  const total = RANK_EXP.totals[rankIdx] ?? RANK_EXP.totals[RANK_EXP.totals.length - 1];
  return Math.floor((total * RANK_EXP.weights[lvl - 1]) / 130);
}

// 职级倍率平滑插值：相邻两职之间摊成 10 小步（M6.1 起只驱动产出速率 rateOf）
export function rankMultOf(rankIdx, lvl) {
  const cur = (RANKS[rankIdx] ?? RANKS[0]).mult;
  const nxt = RANKS[rankIdx + 1]?.mult ?? cur;
  return cur + ((nxt - cur) * ((lvl ?? 1) - 1)) / 9;
}

// M6.1 办差力职级锚点（裸值天梯，用户 2026-08-14 定稿）：新号 10，升一职即上该档台阶，
// 职内十级向下一职锚点平滑插值（同 rankMultOf 形态）；知事封顶 300 裸值。
// 毕业双槽功法 +50 → 裸体 350；装备顶配另加 ~124 → 474。
export const RANK_Z_BASE = [10, 35, 55, 80, 115, 175, 300];
export function rankZabanliBase(rankIdx, lvl) {
  const cur = RANK_Z_BASE[rankIdx] ?? RANK_Z_BASE[0];
  const nxt = RANK_Z_BASE[rankIdx + 1] ?? cur;
  return cur + ((nxt - cur) * ((lvl ?? 1) - 1)) / 9;
}

// 前端展示用：每职十级的升级经验表
export const RANK_LEVEL_NEEDS = RANKS.map((_, r) =>
  Array.from({ length: 9 }, (_v, i) => rankLevelNeed(r, i + 1))
);
