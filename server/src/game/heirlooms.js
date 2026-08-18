// M7 转生二周目：传家槽神器（方案 B，用户定稿 2026-08-14；特征自动判定 2026-08-17 拍板）
// 每转按本周目玩法特征铸一件新神器：数值 X = min(8, 3+转生前资历)，首转 3% 封顶 8%——
// 多转生 = 选择变多，不是数值叠加（单装生效，收藏可换戴）。词条只挂产出/费用，不进办差力。

// 五种玩法特征 → 词条挂靠点（kind 即引擎挂钩侧）
export const HEIRLOOM_TRAITS = {
  andu_deep: { kind: 'quest', name: '案牍深', item: '朱笔旧砚', desc: '差事结算收益' },
  forge_keen: { kind: 'enhance', name: '锻造勤', item: '听风磨石', desc: '强化费用' },
  realm_active: { kind: 'realm', name: '秘境勤', item: '巡夜灯笼', desc: '外差贡献' },
  visit_wide: { kind: 'visit', name: '串门广', item: '传话名牌', desc: '串门回礼' },
  balanced: { kind: 'salary', name: '均衡', item: '安神香佩', desc: '薪酬' },
};

// 归一化基准：一周目重度投入的量级（达不到 25% 视为全低，铸均衡款）
const NORM = { quest: 800, enhance: 80, realm: 100, visit: 100 };
const LOW_BAR = 0.25;

// 判定本周目玩法特征：五项统计归一化取最大；全低 → 均衡
export function judgeTrait(stats) {
  const s = { quest: 0, enhance: 0, patrol: 0, night: 0, visit: 0, ...stats };
  const scores = [
    ['andu_deep', s.quest / NORM.quest],
    ['forge_keen', s.enhance / NORM.enhance],
    ['realm_active', (s.patrol + s.night) / NORM.realm],
    ['visit_wide', s.visit / NORM.visit],
  ];
  let best = 'balanced';
  let bestScore = LOW_BAR;
  for (const [trait, score] of scores) {
    if (score > bestScore) {
      best = trait;
      bestScore = score;
    }
  }
  return best;
}

// 神器数值：首转 3%，逐转 +1，封顶 8%（seniority = 转生前已转次数）
export function heirloomValue(seniority) {
  return Math.min(8, 3 + (seniority ?? 0));
}

// 按周目号铸一件神器（纯函数，返回新条目）
export function forgeHeirloom(stats, seniority, forgedLoop) {
  const trait = judgeTrait(stats);
  const t = HEIRLOOM_TRAITS[trait];
  return {
    id: `heirloom_${forgedLoop}`,
    trait,
    name: t.item,
    value: heirloomValue(seniority),
    forgedLoop,
  };
}

// 当前佩戴神器对某挂钩侧的加成（小数；无佩戴/不匹配 = 0）
export function heirloomBonusOf(state, kind) {
  const id = state.heirloomWorn;
  if (!id) return 0;
  const h = (state.heirlooms ?? []).find((x) => x.id === id);
  if (!h) return 0;
  return HEIRLOOM_TRAITS[h.trait]?.kind === kind ? h.value / 100 : 0;
}
