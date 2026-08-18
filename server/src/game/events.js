// M6.8 事件系统与状态栏（GDD_v2 §13）：日常事件库 + 每日调度。
// 用户决议（2026-08-17）：轻奖无罚——任何日常事件不倒扣，挫败感红线；
// M7 扩充（2026-08-17）：102 条（通用 32 + 每房 7 条专属），零现实词汇；
// 引入 weight（纯佐料 weight:2 更常露脸，带礼 weight:1 护经济口径）与 need 前置
// （转生梗 need:'loop2' 仅二周目进袋），结算口径不变，旧档零迁移。
// 惰性结算铁律：无定时器，心跳（advance 在线段）到点才发。
import { todayStr } from './quests.js';

// gift 口径：bank.mins = 约 N 分钟当前薪酬；contrib.n = 固定贡献。无第三种形态，更无负值。
export const DAILY_EVENTS = [
  // ---------- 通用 20 条 ----------
  { id: 'g_denghua', dept: null, text: '灯芯结了个灯花，老吏说这是要升迁的兆头。你看了看手里的活，没敢接话。' },
  { id: 'g_dianxin', dept: null, text: '隔壁案的同僚分来一块点心，说是家里捎的。甜是挺甜，就是又欠了个人情。' },
  { id: 'g_limao', dept: null, text: '阶前来了只狸猫，卧在日头里不动。全房的人借着看猫，偷偷歇了一盏茶。' },
  { id: 'g_gongwen', dept: null, text: '一道公文转了三圈又转回你案上，批注只有四个字：「再行斟酌」。' },
  { id: 'g_chayi', dept: null, text: '茶炉新换了批茶叶，泡出来比往常酽。当值的都说，今天这班熬得住。', gift: { type: 'bank', mins: 1 } },
  { id: 'g_shijian', dept: null, text: '漏刻房的香钟快了半刻，全衙门跟着早散了一回。没人说破，人人都记着。' },
  { id: 'g_bingjiao', dept: null, text: '同僚请你吃新买的冰酪，你婉拒了——这个月的灵石，得先紧着研习费。' },
  { id: 'g_laojie', dept: null, text: '扫洒的老吏把院子扫得比昨日更亮。他说：地扫干净了，心才不乱。', gift: { type: 'contrib', n: 6 } },
  { id: 'g_huifu', dept: null, text: '你替人跑了一趟腿，回来案上多了封谢帖，压着一小包茶钱。', gift: { type: 'bank', mins: 1 } },
  { id: 'g_xianghui', dept: null, text: '香炉里的灰结了个像符箓的纹样，围观的人都说吉利。你只当看了场热闹。' },
  { id: 'g_kaocheng', dept: null, text: '吏房来翻考成簿，翻到旧页停顿了一下。你屏住呼吸，他合上了。' },
  { id: 'g_shanggan', dept: null, text: '上官路过工位，随口夸了句「案上齐整」。你心里清楚，那是昨夜收拾的。', gift: { type: 'contrib', n: 8 } },
  { id: 'g_duihang', dept: null, text: '账房对账对到一半，忽然全房安静——对上了。这份安稳值一壶茶。' },
  { id: 'g_louyu', dept: null, text: '雨天廊下漏了一处，值房的拿盆接着。滴水声声，倒成了当值的更漏。' },
  { id: 'g_xinpaizi', dept: null, text: '新来的差役把各房名牌认混了，连连作揖赔不是。谁还没个初来乍到呢。' },
  { id: 'g_yueli', dept: null, text: '这个月的皂角发得早，一人多领了一把。小便宜也是便宜，日子嘛。' },
  { id: 'g_yizi', dept: null, text: '公椅吱呀响了三日，报修无果。你自己垫了张纸——它安静了。' },
  { id: 'g_shuijian', dept: null, text: '茶水间排起了小队，聊的都是谁家的香成色好。排队的人不嫌久。', gift: { type: 'bank', mins: 1 } },
  { id: 'g_bangdan', dept: null, text: '廊下的告示被风揭走一角，没人去贴。有些榜文，贴不贴都在那儿。' },
  { id: 'g_dingqian', dept: null, text: '同僚托你盯一眼签押，回来塞给你两个铜钱买糖。你笑纳了，糖没买，钱进了罐。', gift: { type: 'bank', mins: 1 } },
  { id: 'g_fengling', dept: null, text: '檐角的风铃响了一阵，全房都停了笔听。风停了，大家又各自低头忙活。' },
  { id: 'g_jietong', dept: null, text: '新来的差役摸摸索索，总算把流程走通了。你在旁边看着，想起自己头一天。', weight: 2 },
  { id: 'g_mohe', dept: null, text: '砚台磨得发亮，老吏说这东西认主。你添了水，又多磨了几圈。', weight: 2 },
  { id: 'g_shuye', dept: null, text: '门边挂了一束艾草，说是提神的。有没有用不知道，房里倒是清香不少。', weight: 2 },
  { id: 'g_zhiban', dept: null, text: '值夜的名单排到你打头。你翻到下一页——夜宵由伙房记公账。这班值得。', gift: { type: 'contrib', n: 6 } },
  { id: 'g_huili', dept: null, text: '致仕的老吏回来探望，在廊下站了一会儿。临走只说：好好当差，别熬坏了身子。', weight: 2 },
  { id: 'g_xiaoyu', dept: null, text: '院里落了阵小雨，大家把案头都往里挪了挪。雨声听了一阵，心也静了一阵。', weight: 2 },
  { id: 'g_dangzhi', dept: null, text: '当值簿被茶渍晕了一角，两人撞了个对值。一个烧水一个磨墨，倒也顺手。', weight: 2 },
  { id: 'g_jiuwu', dept: null, text: '库房清出一批旧年账册，字迹工整得能当字帖。你借来抄了三天。', gift: { type: 'contrib', n: 5 } },
  // 转生梗（need:loop2，二周目起才进袋）
  { id: 'g_jishi', dept: null, text: '案头的摆设莫名眼熟，像是早就摆过一次。你摇摇头，只当是没睡醒。', need: 'loop2' },
  { id: 'g_mengzhong', dept: null, text: '昨夜梦里走过这条回廊。今日路过时，你的脚步不自觉慢了半拍。', need: 'loop2' },
  { id: 'g_shugu', dept: null, text: '老吏盯着你看了半晌，说：你这人有股故人气。你笑笑，没接话。', need: 'loop2' },

  // ---------- 签押房 7 条 ----------
  { id: 'qy_xiangyin', dept: 'qianyafang', text: '房里的乡音又吵起来了，外房听着像吵架，其实是在对账。快，是真快。' },
  { id: 'qy_yongzhang', dept: 'qianyafang', text: '用印排到了长队，你手起印落，一个不落。掌印的老吏点了点头。', gift: { type: 'contrib', n: 8 } },
  { id: 'qy_jijiao', dept: 'qianyafang', text: '一摞急件要连夜发出，房里凑了几盏灯。天亮时件齐了，眼圈也齐了。' },
  { id: 'qy_duihou', dept: 'qianyafang', text: '上官的口谕传了三个版本，最后以你抄的那版为准。枢纽之房，说话有分量。', gift: { type: 'bank', mins: 1 } },
  { id: 'qy_yinzhi', dept: 'qianyafang', text: '官印擦得锃亮，印文落得格外清。老吏说：印正，则文正。', gift: { type: 'contrib', n: 7 } },
  { id: 'qy_chaifa', dept: 'qianyafang', text: '文书发往四方，驿卒是最后喝上茶的。茶凉了，回文也到了——一切齐整。', weight: 2 },
  { id: 'qy_yaxun', dept: 'qianyafang', text: '上官交代三句，你记了五句。凡事留个余地，总错不了。', weight: 2 },

  // ---------- 户房 7 条 ----------
  { id: 'hf_suanpan', dept: 'hufang', text: '算盘珠子拨得比雨点还密。隔壁房探头看了一眼，默默缩回去了。', gift: { type: 'contrib', n: 10 } },
  { id: 'hf_daxian', dept: 'hufang', text: '大限前夜，账册山堆到房梁。熬过去这一宿，明日又是好汉一条。' },
  { id: 'hf_yinke', dept: 'hufang', text: '库银入库，火耗比上月少了半成。掌案的难得露了笑模样。', gift: { type: 'bank', mins: 1 } },
  { id: 'hf_zhangmu', dept: 'hufang', text: '有人来问账目怎么记，你把规矩讲了三遍。他走时说：还是你们户房门儿清。' },
  { id: 'hf_qianchuan', dept: 'hufang', text: '一枚铜钱滚进了板缝，抠了半天才抠出来。全房齐声叫好——捡的不是钱，是乐子。', gift: { type: 'bank', mins: 1 } },
  { id: 'hf_suanzhang', dept: 'hufang', text: '算账算到深夜，忽然一笔对拢，连灯花都亮了几分。账不欺人，人也不欺账。', weight: 2 },
  { id: 'hf_jiezhi', dept: 'hufang', text: '出入的亏欠一笔笔清了账。掌案翻完最后一页，竖了个大拇指：干净。', gift: { type: 'contrib', n: 8 } },

  // ---------- 制香坊 7 条 ----------
  { id: 'zx_lingye', dept: 'zhixiangfang', text: '新到的灵叶成色上佳，掌炉的说这一炉香稳了。坊里人都跟着松快。', gift: { type: 'bank', mins: 1 } },
  { id: 'zx_chulu', dept: 'zhixiangfang', text: '一炉香出，满坊皆静。揭盖那一下，连呼吸都放轻了。', gift: { type: 'contrib', n: 9 } },
  { id: 'zx_xiangfang', dept: 'zhixiangfang', text: '香方又改了一版，老师傅闻了闻说：近了。坊里人都懂，「近了」就是最好的话。' },
  { id: 'zx_houhuo', dept: 'zhixiangfang', text: '看火候熬了半宿，香灰雪白。手艺这东西，骗不了人。' },
  { id: 'zx_xiangyun', dept: 'zhixiangfang', text: '开炉时香云直上不散，老师傅都说难得。这炉香献上，全坊跟着露脸。', gift: { type: 'contrib', n: 8 } },
  { id: 'zx_peiliao', dept: 'zhixiangfang', text: '配料多试了两味，香气便差出三分。师傅说：方子都是试出来的。', weight: 2 },
  { id: 'zx_shouyi', dept: 'zhixiangfang', text: '新来的学徒学会了看火，有模有样。老人们看着，像看见当年的自己。', weight: 2 },

  // ---------- 漕运司 7 条 ----------
  { id: 'cy_kaobu', dept: 'caoyunsi', text: '漕船靠埠，货单比人先到。你核完最后一张，江风正好。', gift: { type: 'contrib', n: 8 } },
  { id: 'cy_houchao', dept: 'caoyunsi', text: '候潮等了半日，船一到便装货。漕上的老把式说：等潮也是功夫。' },
  { id: 'cy_luxian', dept: 'caoyunsi', text: '新辟了条近水路，脚程省了两成。司里记了你一笔。', gift: { type: 'bank', mins: 1 } },
  { id: 'cy_shuijiao', dept: 'caoyunsi', text: '水脚钱算得明白，船家拿了钱直拱手。账清人不疑，路才走得长。' },
  { id: 'cy_dengta', dept: 'caoyunsi', text: '渡口灯塔添了新油，夜里行船的都有了盼头。灯亮着，心就不慌。', weight: 2 },
  { id: 'cy_xiuchuan', dept: 'caoyunsi', text: '老船进坞修了一水，出来时像新的一样。船老大拍着船帮：还能再跑十年。', gift: { type: 'bank', mins: 1 } },
  { id: 'cy_shunfeng', dept: 'caoyunsi', text: '顺风转利，一列船队齐头并进。漕上的人，最盼这句「一路顺风」。', weight: 2 },

  // ---------- 机巧阁 7 条 ----------
  { id: 'jq_jiguan', dept: 'jiqiaoge', text: '新做的机关匣咔哒一响就成了，围观的掌声比锣还响。', gift: { type: 'contrib', n: 9 } },
  { id: 'jq_lingjian', dept: 'jiqiaoge', text: '阁里进了批好铁，师傅们眼睛都亮了。巧妇难为无米之炊，如今米来了。' },
  { id: 'jq_menquan', dept: 'jiqiaoge', text: '门前的机关兽修好了，又能摇头摆尾。来客都多看两眼——这就是门面。', gift: { type: 'bank', mins: 1 } },
  { id: 'jq_youtiao', dept: 'jiqiaoge', text: '给全阁的机关上油，一下午叮叮当当。手熟的人，心最静。' },
  { id: 'jq_lubiao', dept: 'jiqiaoge', text: '新制的齿轮咬得严丝合缝，不差一毫。师傅验过，点了两下头。', gift: { type: 'contrib', n: 8 } },
  { id: 'jq_tuji', dept: 'jiqiaoge', text: '图纸画了一整天，擦了又画。最后一笔落下，全阁都凑过来看。', weight: 2 },
  { id: 'jq_shibai', dept: 'jiqiaoge', text: '机关匣卡了一回，拆开看是粒尘。清掉重装，反倒更顺了。找到症结，就不算白拆。', weight: 2 },

  // ---------- 察案院 7 条 ----------
  { id: 'ca_xunlu', dept: 'chaanyuan', text: '巡查路线画了个圈，走到哪都是留痕。姿态做足，卷面自然好看。', gift: { type: 'contrib', n: 10 } },
  { id: 'ca_jubao', dept: 'chaanyuan', text: '收了封匿名帖子，查了半天是自己房的笔迹。备案存了，没声张。' },
  { id: 'ca_biaoshuai', dept: 'chaanyuan', text: '上头夸你们巡查有方，赏了一笔。表面功夫做到家，也是功夫。', gift: { type: 'bank', mins: 1 } },
  { id: 'ca_zhengji', dept: 'chaanyuan', text: '卷宗码得比别房齐半寸。别小看这半寸，查案的人先看卷面。' },
  { id: 'ca_fangwei', dept: 'chaanyuan', text: '夜巡多走了一圈，巷口的灯笼都安好。这种事看不见功劳，才叫功夫。', gift: { type: 'contrib', n: 7 } },
  { id: 'ca_anjuan', dept: 'chaanyuan', text: '案卷编了目，交叉核了三遍，一处不差。查案的底子，就靠这三遍。', weight: 2 },
  { id: 'ca_mingcha', dept: 'chaanyuan', text: '你注意到卷宗边角有人翻过，翻开来，果然夹了张字条。细，是察案院的饭碗。', weight: 2 },

  // ---------- 筹云司 7 条 ----------
  { id: 'ch_tuiyan', dept: 'chouyumsi', text: '沙盘推演改了三稿，第四稿终于过了。画饼的人，也要被人画。' },
  { id: 'ch_jianzheng', dept: 'chouyumsi', text: '监正的位子还空着，路过的人都会看一眼。你也看了一眼，低头干活。' },
  { id: 'ch_shusou', dept: 'chouyumsi', text: '你拟的疏稿被上官画了个圈——通过。同僚拱手：云司又添一笔。', gift: { type: 'contrib', n: 9 } },
  { id: 'ch_jiaochou', dept: 'chouyumsi', text: '深夜司里灯火最盛，筹的都是明日的事。饼要趁热画。', gift: { type: 'bank', mins: 1 } },
  { id: 'ch_chouhua', dept: 'chouyumsi', text: '新筹的案一次就过了，司里人人带笑。画饼画成了，也是真本事。', gift: { type: 'contrib', n: 8 } },
  { id: 'ch_yanpan', dept: 'chouyumsi', text: '沙盘上添了条新路，抄了近道省三步。成不成，明日走着瞧。', weight: 2 },
  { id: 'ch_tongqi', dept: 'chouyumsi', text: '司里凑钱置了座新沙盘，旧的留给新人练手。东西传下去，人也传下去。', weight: 2 },

  // ---------- 广闻司 7 条 ----------
  { id: 'gw_haibao', dept: 'guangwensi', text: '海舶归来，带回一匣子异闻。你抄录了两页，也算见了海。', gift: { type: 'contrib', n: 7 } },
  { id: 'gw_yangming', dept: 'guangwensi', text: '衙门的名帖递出去，换回来几句好话。声名这东西，攒着攒着就值钱了。' },
  { id: 'gw_fengxiang', dept: 'guangwensi', text: '风向转利，出海的船期提前了三日。司里上下都说顺。', gift: { type: 'bank', mins: 1 } },
  { id: 'gw_baodi', dept: 'guangwensi', text: '外邦递来份拜帖，辞藻华丽得能当赋读。你誊了一份存档，留了个心眼。' },
  { id: 'gw_yiwen', dept: 'guangwensi', text: '塞外来客讲了段新鲜事，听的人围了半房。广闻司的差事，就是听遍四方。', weight: 2 },
  { id: 'gw_mingtie', dept: 'guangwensi', text: '名帖写得体面，递出去便换回三分薄面。礼数到了，路就好走。', gift: { type: 'bank', mins: 1 } },
  { id: 'gw_haifang', dept: 'guangwensi', text: '海船定了出航的日子，货单备齐。今年海路平顺，人心也跟着稳。', weight: 2 },

  // ---------- 吏房 7 条 ----------
  { id: 'lf_kaocheng2', dept: 'lifang', text: '考成册誊到最后一页，笔都写秃了一支。铨选之事，马虎不得。' },
  { id: 'lf_ditie', dept: 'lifang', text: '有人来递帖子求个考评好看，你按规矩回了。冷面是吏房的招牌。' },
  { id: 'lf_xinzhi', dept: 'lifang', text: '新授职的名牌刻好了，一个个名字都还热乎。有人欢喜，有人盯着更高的位子。' },
  { id: 'lf_jiuan', dept: 'lifang', text: '翻旧档查到一桩积年的铨选公案，你悄悄合上了。有些账，不该你翻。', gift: { type: 'bank', mins: 1 } },
  { id: 'lf_quanxuan', dept: 'lifang', text: '铨选的名册定了稿，一处没改。吏房的笔杆子重千钧——一笔下去，就是人的前程。', weight: 2 },
  { id: 'lf_duizhi', dept: 'lifang', text: '考功的册子对过三处旧档，一处不差。底子硬，风才吹不倒。', gift: { type: 'contrib', n: 7 } },
  { id: 'lf_guixu', dept: 'lifang', text: '旧档归了架，一册一册摆得端正。老吏说：文书安了，人心才安。', weight: 2 },

  // ---------- 刑名房 7 条 ----------
  { id: 'xm_lvli', dept: 'xingmingfang', text: '新修的律条誊了三份，一份送堂上，一份存档，一份压在自己案头——防身。' },
  { id: 'xm_juanzong', dept: 'xingmingfang', text: '一摞案卷理出了头绪，证据链咬得严丝合缝。审慎的人睡得最香。', gift: { type: 'contrib', n: 9 } },
  { id: 'xm_shenji', dept: 'xingmingfang', text: '审计出一处小出入，报上去前你先递了话。留痕的人，处处留余地。' },
  { id: 'xm_yaofu', dept: 'xingmingfang', text: '两堂会签的差事办妥了，合规、审计各押一印。谨小慎微，不累心。' },
  { id: 'xm_tiaowen', dept: 'xingmingfang', text: '一条律文的措辞改了三遍，终于说得通了。字斟句酌，为的是不让人猜。', weight: 2 },
  { id: 'xm_huajian', dept: 'xingmingfang', text: '会签的用印齐了，一处不缺。手续齐全，夜里睡得踏实。', gift: { type: 'contrib', n: 6 } },
  { id: 'xm_cunzhao', dept: 'xingmingfang', text: '旧案存了照，往后要翻随时能翻。留底的东西，平时不显，急时救命。', weight: 2 },
];

export const EV_COMMON_COUNT = 32; // 通用（含 3 条转生梗前置事件）
export const EV_DEPT_COUNT = 7; // 每房专属
export const EV_TOTAL_COUNT = 102;

// need 前置口径（M7 扩充）：loop2 = 二周目起（state.loop >= 2）才进当日袋
export const EV_NEED_CHECKS = {
  loop2: (state) => (state.loop ?? 1) >= 2,
};
export const EV_MIN_PER_DAY = 2;
export const EV_MAX_PER_DAY = 4;
// 触发间隔：基础 10 分钟 + 抖动 0~15 分钟（惰性到点才发，离线段不触发）
export const EV_INTERVAL_BASE_MS = 10 * 60000;
export const EV_INTERVAL_JITTER_MS = 15 * 60000;

// 当日事件袋初始化：cap 2~4 + 加权洗牌袋（当日抽完不重复）。
// 袋内按 weight 放副本（默认 1），need 不满足的不进袋；抽中重复 id 自动跳过。
export function initEvDay(state, ts, rng = Math.random) {
  const cards = [];
  for (const e of DAILY_EVENTS) {
    if (e.dept !== null && e.dept !== state.dept) continue;
    if (e.need && !(EV_NEED_CHECKS[e.need]?.(state) ?? false)) continue;
    const w = Math.max(1, Math.floor(e.weight ?? 1));
    for (let k = 0; k < w; k++) cards.push(e.id);
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  state.evDay = {
    date: todayStr(ts),
    cap: EV_MIN_PER_DAY + Math.floor(rng() * (EV_MAX_PER_DAY - EV_MIN_PER_DAY + 1)),
    cards,
    used: [], // 当日已发 id（加权副本防重）
    nextAt: 0, // 首次心跳即定间隔
  };
}

// 惰性调度（advance 在线段调用）：到点发一条，gift 入账 + 邸报一条。只奖不罚。
export function tickDailyEvents(state, ts, ratePerMin, rng = Math.random) {
  if (!state.evDay || state.evDay.date !== todayStr(ts)) initEvDay(state, ts, rng);
  const d = state.evDay;
  if (d.cap <= 0) return; // 今日发满即停
  if (d.nextAt === 0) {
    d.nextAt = ts + EV_INTERVAL_BASE_MS + Math.floor(rng() * EV_INTERVAL_JITTER_MS);
    return;
  }
  if (ts < d.nextAt) return;
  const used = d.used ?? (d.used = []); // 旧档兼容：老袋无 used 字段
  let id = null;
  while (d.cards.length > 0) {
    const next = d.cards.pop();
    if (!used.includes(next)) {
      id = next;
      break;
    } // 加权副本抽重：跳过，不算次数
  }
  if (!id) return; // 袋空（理论上不会），不罚不停
  const ev = DAILY_EVENTS.find((e) => e.id === id);
  if (!ev) return; // 保险：库里查不到就不发、不耗次数，绝不出错
  d.cap -= 1;
  used.push(id);
  d.nextAt = ts + EV_INTERVAL_BASE_MS + Math.floor(rng() * EV_INTERVAL_JITTER_MS);
  if (ev.gift?.type === 'contrib') {
    state.contribution += ev.gift.n;
    state.contributionTotal += ev.gift.n;
    pushEventLike(state, { type: 'gift', text: `${ev.text}（贡献 +${ev.gift.n}）` }, ts);
  } else if (ev.gift?.type === 'bank') {
    const salary = Math.floor(ratePerMin * ev.gift.mins);
    state.bank += salary;
    state.totalEarned += salary;
    pushEventLike(state, { type: 'gift', text: `${ev.text}（薪酬 +${salary}）` }, ts);
  } else {
    pushEventLike(state, { type: 'daily', text: ev.text }, ts);
  }
}

// 与 engine.pushEvent 同口径（避免循环引用，内部复刻：置顶、留 20 条）
function pushEventLike(state, ev, ts) {
  if (!Array.isArray(state.events)) state.events = [];
  state.events.unshift({ ts, ...ev });
  if (state.events.length > 20) state.events.length = 20;
}
