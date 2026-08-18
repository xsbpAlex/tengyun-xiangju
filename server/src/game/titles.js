// 称号系统（GDD_v2 §11）：案牍山十档首办各授一枚称号；M6.5 增秘境/天梯称号。
// 多元词条池（M6.5 用户决议）：每枚称号固定词条，持有即生效、全量累加；
// 案牍山十称号各 {薪酬+1%, 贡献+1%}，与 M6 时代 TITLE_BONUS_PER 口径完全等价，旧档零感知。
// 词条只做产出/效用类小幅加成（单条 ≤5%），不进办差力——称号不入排序值（§18.1）。
export const TITLE_BONUS_PER = 0.01; // 案牍山称号的薪酬/贡献词条幅度（保留常量供展示与测试）

export const QUEST_TITLES = [
  { id: 'saotong_tongzi', name: '洒扫童子', flavor: '院子扫得干净，没人问过他手酸不酸。' },
  { id: 'dishu_kuaishou', name: '递书快手', flavor: '八百里加急，没一个落款是他的。' },
  { id: 'anjuan_laoli', name: '案卷老吏', flavor: '哪年的卷宗放哪一格，只有他还记得。' },
  { id: 'tangqian_shulian', name: '堂前熟脸', flavor: '上官见了他点头，就算拜过年了。' },
  { id: 'peijia_hongren', name: '陪驾红人', flavor: '陪上官走了三日，看尽了一半的官场。' },
  { id: 'caoyun_bashishi', name: '漕运老把式', flavor: '船跑了三年，漕路上认得他比认得知事还多。' },
  { id: 'chuhai_xingzhe', name: '出海行者', flavor: '风浪没打翻他，报销单差点打翻他。' },
  { id: 'lingmai_jiangshi', name: '灵脉匠师', flavor: '灵脉修好了，他的腰没修好。' },
  { id: 'yubi_daikou', name: '御笔代刀', flavor: '笔是上官的，黑眼圈是自己的。' },
  { id: 'andu_xingzou', name: '案牍长城·行走', flavor: '公文一万件，没有一件记得他来过。' },
];

// M6.5 外差称号：凌霄阶里程碑三枚 + 夜值悬案累计破局一枚
export const EXTRA_TITLES = [
  { id: 'baijie_xingzhe', name: '百阶行者', flavor: '一百阶一口气走完，膝盖还没学会抱怨。' },
  { id: 'banshan_tingfeng', name: '半山听风', flavor: '五百阶上的风，比堂下的风声顺耳些。' },
  { id: 'lingxiao_jueding', name: '凌霄绝顶', flavor: '一千阶顶往下看，衙门小得像枚印——他忽然想起，案头还有公文没拟。' },
  { id: 'xuanan_kexing', name: '悬案克星', flavor: '经手的悬案都结了。没人问他夜里熬了几盏灯。' },
  // M7.5 监正争夺战：三场全胜也坐不上那把椅子，唯争得「敢争」二字
  { id: 'jianzheng_zhengduo', name: '监正争夺者', flavor: '他争过那把空椅子。三场全胜，什么都没得到——除了看清那把椅子。' },
  // M9.5 博士支线回收：暗线只埋不揭，纯展示称号，不进 TITLE_WORDS（零数值）
  { id: 'dengxia_tongxing', name: '灯下同行', flavor: '有些事问不出答案，只是总得有人看着那盏灯。' },
];

export const ALL_TITLES = [...QUEST_TITLES, ...EXTRA_TITLES];

// 词条表：titleId → {salary?, contrib?, realmGain?, xinliDrain?}
// salary/contrib 产出加成；realmGain 秘境收益加成；xinliDrain 心力消耗减免
export const TITLE_WORDS = {};
for (const t of QUEST_TITLES) TITLE_WORDS[t.id] = { salary: TITLE_BONUS_PER, contrib: TITLE_BONUS_PER };
TITLE_WORDS.baijie_xingzhe = { salary: TITLE_BONUS_PER };
TITLE_WORDS.banshan_tingfeng = { realmGain: 0.02 };
TITLE_WORDS.lingxiao_jueding = { xinliDrain: 0.05 };
TITLE_WORDS.xuanan_kexing = { contrib: TITLE_BONUS_PER };
TITLE_WORDS.jianzheng_zhengduo = { salary: TITLE_BONUS_PER, contrib: TITLE_BONUS_PER }; // M7.5 纪念词条，幅度同案牍山口径

// 词条累加：按持有称号 id 列表汇总全部词条
export function titleBonuses(titleIds) {
  const sum = { salary: 0, contrib: 0, realmGain: 0, xinliDrain: 0 };
  for (const id of titleIds ?? []) {
    const w = TITLE_WORDS[id];
    if (!w) continue;
    sum.salary += w.salary ?? 0;
    sum.contrib += w.contrib ?? 0;
    sum.realmGain += w.realmGain ?? 0;
    sum.xinliDrain += w.xinliDrain ?? 0;
  }
  return sum;
}

// 词条展示文案（前端/履历卡用）
export function wordsTextOf(id) {
  const w = TITLE_WORDS[id];
  if (!w) return '';
  const parts = [];
  if (w.salary) parts.push(`薪酬 +${Math.round(w.salary * 100)}%`);
  if (w.contrib) parts.push(`贡献 +${Math.round(w.contrib * 100)}%`);
  if (w.realmGain) parts.push(`秘境收益 +${Math.round(w.realmGain * 100)}%`);
  if (w.xinliDrain) parts.push(`心力消耗 −${Math.round(w.xinliDrain * 100)}%`);
  return parts.join(' · ');
}

export function titleOf(id) {
  return ALL_TITLES.find((t) => t.id === id) ?? null;
}
