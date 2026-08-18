// 法器系统（GDD_v2 §7）：四槽装备，机巧阁锻造（吃贡献），强化上限 20 级。
// 挫败感红线：失败只掉 1 级，绝不清级回档；10 锻保底出灵品；+16 起淬炼保护积层。
export const GEAR_SLOTS = [
  { id: 'hand', name: '掌中器', desc: '办公器具' },
  { id: 'shield', name: '护身', desc: '官服工牌' },
  { id: 'soul', name: '养魂器', desc: '仙奶养生' },
  { id: 'craft', name: '奇巧器', desc: '效率法宝' },
];

// M6.1 数值重定：底值回收，装备定位纯加速件（顶配四件 ≈124，不再碾压门槛标尺）
export const RARITIES = [
  { lvl: 1, name: '凡品', base: 2, color: 1 },
  { lvl: 2, name: '灵品', base: 4, color: 2 },
  { lvl: 3, name: '仙品', base: 7, color: 3 },
  { lvl: 4, name: '巧品', base: 12, color: 4 },
];

// 锻造出品质的概率权重（凡→巧）
export const FORGE_WEIGHTS = [50, 30, 15, 5];
export const FORGE_PITY_MAX = 10; // 连 10 锻未出灵品及以上 → 下一锻必出灵品以上（GDD_v2 §7.2）
export const FORGE_COST = { contribution: 150 };

export const MAX_ENHANCE = 20; // 强化上限（用户决议 2026-08-14）

// 各槽法器名池
const NAME_POOL = {
  hand: ['朱笔法笔', '灵纹键盘', '千里眼玉屏', '追风算盘'],
  shield: ['青衫吏袍', '铜腰牌', '云纹官服', '金丝工牌'],
  soul: ['仙奶咖啡盏', '宁神菊花饮', '防脱发符囊', '醒脑风油精'],
  craft: ['甘特图绢帛', '留痕宝鉴', '自动回帖纸鹤', '摸鱼哨'],
};

export function emptyGear() {
  return { hand: null, shield: null, soul: null, craft: null };
}

// 单件法器办差力 = 品质底值 + 强化等级成长（M6.1：成长 3/级 → 1/级）
export function gearPower(item) {
  if (!item) return 0;
  return RARITIES[item.rarity - 1].base + (item.lvl - 1);
}

// 四槽总办差力
export function gearTotalPower(gear) {
  return GEAR_SLOTS.reduce((sum, s) => sum + gearPower(gear[s.id]), 0);
}

// 强化消耗贡献：成本曲线 ≈ 12 × n^1.6（GDD_v2 §7.4 控费目标，实施时微调）
export function enhanceCost(item) {
  return { contribution: Math.floor(12 * Math.pow(item.lvl, 1.6)) };
}

// 失败率表（用户决议 2026-08-15）：
// +0→+1 … +9→+10 = 10%；+10→+11 … +15→+16 = 20%；
// +16→+17 = 30%；+17→+18 = 40%；+18→+19 = 50%；+19→+20 = 60%
export function enhanceFailRate(lvl) {
  if (lvl <= 9) return 0.1;
  if (lvl <= 15) return 0.2;
  const high = [0.3, 0.4, 0.5, 0.6];
  return high[lvl - 16] ?? 0.6;
}

// 锻造：掷品质、定名（服务端权威）。guaranteed = 保底强制灵品以上
export function forgeItem(slot, rand = Math.random(), guaranteed = false) {
  let acc = 0;
  let rarity = 1;
  for (let i = 0; i < FORGE_WEIGHTS.length; i++) {
    acc += FORGE_WEIGHTS[i];
    if (rand * 100 < acc) {
      rarity = i + 1;
      break;
    }
  }
  if (guaranteed && rarity < 2) rarity = 2;
  const pool = NAME_POOL[slot] ?? NAME_POOL.hand;
  const base = pool[Math.floor(Math.random() * pool.length)];
  return { name: `${RARITIES[rarity - 1].name}·${base}`, slot, rarity, lvl: 1, temper: 0 };
}

// 折卖基准（M6.5 定稿）：底值一半 + 强化成长 1/级，与锻造投入同源不贬值
export function sellValue(item) {
  if (!item) return 0;
  return Math.floor(RARITIES[item.rarity - 1].base / 2) + (item.lvl - 1);
}

// 秘境掉落（M6.5）：按权重掷品质，随机槽位定名，入背包。rng 为随机函数（可注入测试）
export function realmDrop(weights, rng = Math.random) {
  const rarityRand = rng();
  const slotRand = rng();
  let acc = 0;
  let rarity = 1;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (rarityRand * 100 < acc) {
      rarity = i + 1;
      break;
    }
  }
  const slot = GEAR_SLOTS[Math.floor(slotRand * GEAR_SLOTS.length) % GEAR_SLOTS.length].id;
  const pool = NAME_POOL[slot] ?? NAME_POOL.hand;
  const base = pool[Math.floor(slotRand * pool.length) % pool.length];
  return { name: `${RARITIES[rarity - 1].name}·${base}`, slot, rarity, lvl: 1, temper: 0 };
}
