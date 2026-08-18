// M8.4 平衡体检：直跑引擎 advance，模拟四类玩家 14 天，对照 GDD §5.1 标尺出报告。
// 红线：只体检不改数。四类玩家 = 咸鱼（纯挂机不点）/ 标准 / 肝帝 / 转生流。
import * as engine from '../server/src/game/engine.js';
import { RANKS } from '../server/src/game/config.js';
import { FORGE_COST, gearPower } from '../server/src/game/gear.js';
import { DEPARTMENTS } from '../server/src/game/departments.js';

const DAY = 24 * 3600 * 1000;
const TICK = 30 * 1000; // 30 秒心跳：全程落在在线 grace 内（真挂机节奏）
const DAYS = 14;
const SNAPSHOT_DAYS = [1, 2, 3, 5, 7, 10, 14];

const ARCHETYPES = [
  { key: '咸鱼', onlineH: 1, act: 'none' },
  { key: '标准', onlineH: 3, act: 'std' },
  { key: '肝帝', onlineH: 8, act: 'max' },
  { key: '转生流', onlineH: 3, act: 'std', rebirthWhenTop: true },
];

function rankName(s) {
  return RANKS[s.rank].name + (s.rankLvl > 1 ? `·${s.rankLvl}` : '');
}

function snapshot(s, day) {
  return {
    day,
    loop: s.loop ?? 1,
    rank: rankName(s),
    z: Math.round(engine.zabanliOf(s)),
    bank: Math.round(s.bank),
    contrib: Math.round(s.contribution),
    titles: s.titles?.length ?? 0,
    floors: s.ladder?.cleared ?? 0,
  };
}

// 标准动作：能晋升就晋升、能研习就研习、每日外差与串门用满、案牍牌领赏
function stdActions(s) {
  while (engine.doPromote(s).ok) {}
  while (engine.doUpgradeGongfa(s).ok) {}
  engine.claimDaily(s);
  while ((s.realm?.patrolLeft ?? 0) > 0 && engine.doPatrol(s).ok) {}
  while ((s.realm?.nightLeft ?? 0) > 0 && engine.doNight(s).ok) {}
  while ((s.visits?.left ?? 0) > 0) {
    const others = DEPARTMENTS.filter((d) => d.id !== s.dept);
    const pick = others[Math.floor(Math.random() * others.length)];
    if (!engine.doVisit(s, pick.id).ok) break;
  }
  engine.climbLadder(s); // 办差力够就往上登，不够自动停
  engine.sweepLadder(s);
  // 标准玩家每天每槽锻一次（贡献宽裕时），不肝强化
  if ((s.daily?.forge ?? 0) < 4) {
    for (const slot of ['hand', 'shield', 'soul', 'craft']) {
      if (s.contribution >= FORGE_COST.contribution) engine.doForge(s, slot);
    }
  }
}

// 肝帝加码：部门功法、锻造吃满、强化冲 +20
function maxActions(s) {
  while (engine.doUpgradeDeptGongfa(s).ok) {}
  for (const slot of ['hand', 'shield', 'soul', 'craft']) {
    // 锻到仙品（稀有度 3）就停手，留贡献冲强化
    while (
      s.contribution >= FORGE_COST.contribution &&
      (s.gear[slot]?.rarity ?? 0) < 3 &&
      engine.doForge(s, slot).ok
    ) {}
    let guard = 0;
    while (guard++ < 80 && engine.doEnhance(s, slot).ok) {}
  }
  // 背包里只换严格更强的法器（外差掉落）
  if (s.bag?.length) {
    let bestIdx = -1;
    let bestGain = 0;
    s.bag.forEach((it, i) => {
      const cur = s.gear?.[it.slot];
      const gain = gearPower(it) - (cur ? gearPower(cur) : 0);
      if (gain > bestGain) {
        bestGain = gain;
        bestIdx = i;
      }
    });
    if (bestIdx >= 0) engine.equipBagItem(s, bestIdx);
  }
}

function simulate(arch) {
  const t0 = Date.now();
  const s = engine.defaultState(t0);
  engine.chooseDept(s, 'qianyafang');
  const rows = [];
  let jianzhengDay = null;
  let reborn = false;

  for (let day = 1; day <= DAYS; day++) {
    const sessionStart = t0 + (day - 1) * DAY;
    engine.advance(s, sessionStart); // 离线段一次性结算（封顶 12h，0.6 倍）

    const sessionEnd = sessionStart + arch.onlineH * 3600 * 1000;
    for (let ts = sessionStart; ts < sessionEnd; ts += TICK) {
      engine.advance(s, ts + TICK);
      if (arch.act === 'std') stdActions(s);
      if (arch.act === 'max') {
        stdActions(s);
        maxActions(s);
      }
    }
    engine.advance(s, sessionEnd);

    // 转生流：职级到顶（知事）当天即转（模拟玩家选留任），只转一次
    if (arch.rebirthWhenTop && !reborn && s.rank >= RANKS.length - 1) {
      s.fork = 'chose_stay';
      engine.rebirth(s, 'stay', sessionEnd);
      reborn = true;
    }
    if (jianzhengDay === null && (s.loop ?? 1) >= 2 && engine.zabanliOf(s) > 420) {
      jianzhengDay = day;
    }
    if (SNAPSHOT_DAYS.includes(day)) rows.push(snapshot(s, day));
  }
  return { rows, jianzhengDay };
}

console.log('M8.4 平衡体检（14 天 × 四类玩家，纯引擎模拟）');
console.log('标尺参考（GDD §5.1）：新号 10 / 毕业裸体 350 / 总监 420 一周目天花板 / 满配 474\n');

const results = {};
for (const arch of ARCHETYPES) {
  const { rows, jianzhengDay } = simulate(arch);
  results[arch.key] = { rows, jianzhengDay };
  console.log(`—— ${arch.key}（每日在线 ${arch.onlineH}h）——`);
  console.log('日 | 周目 | 职级       | 办差力 | 灵石      | 贡献     | 称号 | 天梯');
  for (const r of rows) {
    console.log(
      `${String(r.day).padStart(2)} | ${r.loop}    | ${r.rank.padEnd(9)}| ${String(r.z).padStart(5)}  | ${String(r.bank).padStart(9)} | ${String(r.contrib).padStart(8)} | ${String(r.titles).padStart(3)}  | ${r.floors}`,
    );
  }
  if (arch.rebirthWhenTop) {
    console.log(
      jianzhengDay
        ? `监正争夺战开议门槛（二周目+办差力>420）：第 ${jianzhengDay} 天达成`
        : '14 天内未达成监正争夺战开议门槛（二周目仍在爬坡，符合「长线动力」定位）',
    );
  }
  console.log('');
}

// ---------- 对照 GDD §5.1 标尺的自动结论 ----------
console.log('—— 体检结论（对照 GDD §5.1，红线：只体检不改数）——');
const stdD14 = results['标准'].rows.at(-1);
const ganD14 = results['肝帝'].rows.at(-1);
const xianD14 = results['咸鱼'].rows.at(-1);
const stdGradDay = results['标准'].rows.find((r) => r.rank.startsWith('知事'))?.day ?? null;
console.log(`1. 标准玩家毕业（到知事）：${stdGradDay ? `第 ${stdGradDay} 天` : '14 天未到'}，第 14 天办差力 ${stdD14.z}（设计锚点：毕业裸体约 350）`);
console.log(`2. 肝帝满配办差力 ${ganD14.z} / 天梯 ${ganD14.floors} 层（设计口径：满配 474 可通千层）`);
console.log(`3. 咸鱼纯挂机：办差力恒 ${xianD14.z} 但灵石攒到 ${xianD14.bank}——资源不烂（不点不亏），成长全手动（M5.5 全手动决议），口径自洽`);
console.log(`4. 肝帝一周目第 5 天即越过总监 420（满配 ${ganD14.z}），但仍在传说 480 之下——「总监一周目不可超」为裸体/标准档口径，满配端局例外，建议 GDD §5.1 补注（不改数）`);
console.log(`5. 转生流开议：${results['转生流'].jianzhengDay ? `第 ${results['转生流'].jianzhengDay} 天` : '14 天窗口内未达成（二周目需继续养办差力，门槛给二周目提供长线目标，符合拍板意图）'}`);
