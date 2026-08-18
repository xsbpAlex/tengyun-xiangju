// 案牍山差事档位（GDD_v2 §6）：办差力卡门槛，全自动办结、自动切档。
// 结算拆薪酬+贡献两线（总价值 6:4，GDD_v2 §3.1）；在线全额、离线 0.6 倍、倦怠减速，
// 与工位产出共用同一段时间推进，绝不需要玩家手动"战斗"。
// M6.1 数值重定：门槛重排 10→440，每档对齐职级里程碑（新号/书吏/资深/管事/副主事/
// 高级副主事/知事初/知事Lv5+灵品/毕业前/毕业+灵品追求）；时长等比拉长（顶档 14h，
// 离线 12h 窗口内节奏不变），薪酬/贡献随 mins 等比放大（时薪不变）。
// 毕业裸体 350 通九档，顶档 440 毕业+装备（474）可通。
export const QUESTS = [
  { name: '洒扫庭除', req: 10, mins: 3, salary: 6, contrib: 5 },
  { name: '递送文书', req: 25, mins: 6, salary: 15, contrib: 9 },
  { name: '整理案卷', req: 50, mins: 12, salary: 35, contrib: 23 },
  { name: '堂前值守', req: 80, mins: 25, salary: 85, contrib: 57 },
  { name: '陪同上官', req: 120, mins: 50, salary: 190, contrib: 127 },
  { name: '押运贡品', req: 170, mins: 90, salary: 369, contrib: 246 },
  { name: '跨海出差', req: 230, mins: 180, salary: 783, contrib: 522 },
  { name: '修缮灵脉', req: 300, mins: 360, salary: 1656, contrib: 1104 },
  { name: '起草奏章', req: 370, mins: 600, salary: 3411, contrib: 2275 },
  { name: '案牍长城', req: 440, mins: 840, salary: 7056, contrib: 4704 },
];

// 首办里程碑（GDD_v2 §6.2）：一次性大额贡献 = 该档常规结算的 20 倍
export function firstBonusOf(tier) {
  return (QUESTS[tier]?.contrib ?? 0) * 20;
}

// 每日案牍牌自动里程碑（GDD_v2 §9）：目标随已通最高档加深
export function dailyTargets(questBest) {
  const depth = questBest + 1;
  return { quest: 5, contrib: 150 * depth, onlineMin: 60 };
}

// 领赏奖励随已通最高档位上涨（薪酬+贡献双线）
export function dailyReward(questBest) {
  const depth = questBest + 1;
  return { salary: 60 + 20 * depth, contribution: 100 + 30 * depth };
}

export function todayStr(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// 两个 YYYY-M-D 日期串之间相差的自然日数（b - a，不为负）
export function daysBetween(aStr, bStr) {
  const p = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.max(0, Math.round((p(bStr) - p(aStr)) / 86400000));
}

export function emptyDaily(ts) {
  return { date: todayStr(ts), quest: 0, contrib: 0, onlineMin: 0, forge: 0, claimed: false };
}
