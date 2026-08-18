// 仙籍大饼（GDD §6.1）：表面进度条 + 芝诺龟门槛 + 画饼告示。
// 讽刺藏在数学里：门槛永远比成长快半步，达标即改规则。
// 一周终局节奏（M5.6 调参）：挂机党约第 2 天首次撞墙，一周内撞 4~5 次，
// 剩下的画饼留给终局后——撞墙即幻灭充能。

// 仙籍进度折算：服役每整日 +16，累计贡献每 50 点 +1（惰性折算，无需逐日记录）
export const XIANJI_PER_DAY = 16;
export const XIANJI_PER_QUESTS = 1 / 20;
// 门槛曲线：每次"达标"后门槛 ×1.35 并换一套说辞（芝诺龟）
export const XIANJI_THRESHOLD_BASE = 40;
export const XIANJI_THRESHOLD_GROWTH = 1.35;
export const XIANJI_CAP_STAGE = 9; // 第 10 次画饼后彻底摊牌：无限期冻结

// 每次撞墙时上官的新告示（按 stage 递进，语气温和、内容缺德）
export const XIANJI_NOTICES = [
  '上官拍你肩膀："好好干，下次仙籍遴选优先推荐你。"',
  '榜文有变："本届遴选加试悟性，需堂上诸公亲授。"——堂上诸公从不现身。',
  '吏房传话："本届名额缩减，望诸位体恤衙门难处。"',
  '天庭有谕："编制冻结，静候谕旨，勿信谣传。"',
  '上官设宴画饼："下一届，一定有你。我拿这杯茶作保。"',
  '新规张贴："遴选增设资历复核，往届年资另行计算。"——你的年资恰好不算。',
  '榜文又改："本届遴选改为举荐制，举荐人需监正亲任。"——监正之位虚悬。',
  '上官语重心长："年轻人，眼光放长远，编制是虚的，本事是实的。"',
  '吏房来函："遴选材料遗失，请重新提交近三年考成。"',
  '告示角落一行小字，墨迹很淡："仙籍遴选，无限期冻结。"',
];

// 旧账册（GDD §6.2）：历任编外杂役的命运残页，拼起来即真相。
// 每页掉落需办结差事 25 次（一周内集齐）；收集即幻灭大额充能。最后一页留给烛影先生。
export const LEDGER_MATS_PER_PAGE = 25;
export const LEDGER_PAGES = [
  { id: 1, text: '庚辰年入衙，考成连年上上。丙戌年，问仙籍，上官曰"再等一届"。己丑年，辞。' },
  { id: 2, text: '某年，有杂役掌案牍山事十年，经手仙籍文书三百卷，皆他人之名。' },
  { id: 3, text: '辛卯年，遴选在即，吏房夜半改簿。晨起，榜上无名者七人，皆称"材料有瑕"。' },
  { id: 4, text: '老杂役酒后言："我入衙那年，也是说下一届有我的。"言罢大笑，笑声很轻。' },
  { id: 5, text: '账册夹页有朱笔小字：举荐名录一纸，其名尽墨涂，唯题头"外派仙吏"四字未涂。' },
  { id: 6, text: '某岁寒冬，衙门裁汰编外十一人。临行各赠灵茶一包，上书四字：前程似锦。' },
  { id: 7, text: '有杂役攒得打点灵石无数，终至知事顶格。是夜大醉，题壁："顶格处，仍无座。"' },
  { id: 8, text: '末页字迹清瘦，墨色已陈："我算过，这条路不通。我仍留下——留下的理由，不写在这。"落款：烛影。' },
];

// 幻灭值（GDD §6.3，双轨合一）：挂机党每现实日自动涨格，约 6 天注满（一周终局，M5.6）；
// 肝帝快车道：撞仙籍墙、收旧账册、目睹画饼（Branch A 后反向变通透）——大额充能。
export const HUANMIE_MAX = 100;
export const HUANMIE_PER_DAY = HUANMIE_MAX / 6;
export const HUANMIE_PER_WALL = 15;
export const HUANMIE_PER_LEDGER = 10;

// 心事图标（UI 只显示模糊阶段，不显示数字）
export const XINSHI_STAGES = [
  { at: 0, text: '心里很静' },
  { at: 20, text: '偶有郁结' },
  { at: 40, text: '心口发闷' },
  { at: 60, text: '弦断了两根' },
  { at: 80, text: '弦快断完了' },
];

export function xinshiStage(huanmie) {
  let cur = XINSHI_STAGES[0];
  for (const s of XINSHI_STAGES) {
    if (huanmie >= s.at) cur = s;
  }
  return cur.text;
}
