// M6.1 部门×NPC 交互事件 + 洗牌袋散排（GDD_v2 §13.6，用户 2026-08-14 立题）。
// 每位同僚一条交互事件，文案与 npcs.js 的官职/flavor 人设呼应；零现实词汇。
// 效果口径（用户决议）：约一半回礼、一半惩罚；惩罚温和，最重尺度 = 六小时收益减半
// （big=180 分钟薪酬等量，一次性结算，不做持续减益）。现有 40 条轶事原样不动。
// 结构对齐 §13.4 事件格式：{id, dept, npcId?, text, gift?|penalty?}，M6.8 并入框架零迁移。
import { VISIT_EVENTS } from './visits.js';

// 58 条，与 npcs.js COLLEAGUES 顺序一一对应（ne1 ↔ npc1）
export const NPC_EVENTS = [
  // ---------- 签押房 ----------
  { id: 'ne1', dept: 'qianyafang', npcId: 'npc1', gift: 'bank', text: '云章主事一边翻公文一边递你一盏茶：“来了就坐，走时捎上这份脚力钱——反正也是别人送来的。”' },
  { id: 'ne2', dept: 'qianyafang', npcId: 'npc2', penalty: 'small', text: '衔泥客托你捎一封加急信，等你跑回来，收信的人已经下值了。他摆摆手：“误了就误了，信资你出，就当买个教训。”' },
  { id: 'ne3', dept: 'qianyafang', npcId: 'npc3', gift: 'contrib', text: '传灯生教你一套公文口诀，你背熟了，后来两房公文对上了，他把你的名字记进了“协理”一栏。' },
  { id: 'ne4', dept: 'qianyafang', npcId: 'npc4', penalty: 'small', text: '拾遗郎让你帮忙核对来函，你手一抖碰翻了砚台。他也不恼：“砚台钱，照价赔，友情价。”' },
  { id: 'ne5', dept: 'qianyafang', npcId: 'npc5', gift: 'bank', text: '走马丞刚排好一班差车，见你来，把多余的马料银塞给你：“拿着，路上讨个彩头。”' },
  { id: 'ne6', dept: 'qianyafang', npcId: 'npc6', penalty: 'mid', text: '青牍子抓你帮忙校一摞公文，校完说：“润笔没钱付了——你请我喝茶吧。”茶钱，不菲。' },
  { id: 'ne7', dept: 'qianyafang', npcId: 'npc7', gift: 'contrib', text: '衔书雁出使缺个押签的，拉你同行。回来登记名册，你的名字也在上面。' },
  { id: 'ne8', dept: 'qianyafang', npcId: 'npc8', penalty: 'small', text: '驿铃生教你认驿铃的规矩，你记岔了一个调子，被罚“请全房喝茶”——茶是你买的。' },
  { id: 'ne9', dept: 'qianyafang', npcId: 'npc9', gift: 'bank', text: '白帖书吏替你抄了半页难抄的条目，末了塞你一份抄资费：“新来的，多照应。”' },
  { id: 'ne10', dept: 'qianyafang', npcId: 'npc10', penalty: 'mid', text: '泥砚童子拉你玩“公文接龙”，输了的给全房买纸。你输了，纸钱摊到你头上的最多。' },
  { id: 'ne11', dept: 'qianyafang', npcId: 'npc11', gift: 'contrib', text: '备车老苍教你三句看车的门道，又把你写进“车马联络”的名册里——名字签在最末，也算数。' },
  // ---------- 户房 ----------
  { id: 'ne12', dept: 'hufang', npcId: 'npc12', penalty: 'big', text: '执算主事让你替他扶算盘，你扶到大限关头手一滑，拨错一粒珠。他叹气：“这笔记‘杂项支出’。”——杂项，出在你口袋里。' },
  { id: 'ne13', dept: 'hufang', npcId: 'npc13', gift: 'bank', text: '对账先生翻出一笔陈年旧账，追了回来，心情大好，分你一份“追账茶水钱”。' },
  { id: 'ne14', dept: 'hufang', npcId: 'npc14', gift: 'contrib', text: '金账房教你看账本边上的小字，看完正赶上封账，他顺手记你一笔“帮账”，贡献落袋。' },
  { id: 'ne15', dept: 'hufang', npcId: 'npc15', penalty: 'mid', text: '铁算盘拉你比试拨算盘，你输得彻底。按规矩，输家请全房吃点心——点心记你账上。' },
  { id: 'ne16', dept: 'hufang', npcId: 'npc16', gift: 'bank', text: '量斗生量粮剩了个零头，照规矩“零头归旁观的”——你恰好旁观了。' },
  { id: 'ne17', dept: 'hufang', npcId: 'npc17', penalty: 'small', text: '持筹客借你一本批注账册，还回去时页角多了一道折痕。他提笔就记：“补册费，折一处算一处。”' },
  { id: 'ne18', dept: 'hufang', npcId: 'npc18', gift: 'contrib', text: '平账老吏抹平一笔烂账，拉你做“见证”。账平了，见证费也进了你的账。' },
  { id: 'ne19', dept: 'hufang', npcId: 'npc19', penalty: 'mid', text: '折券翁教你用“温和的法子”清欠债。法子灵了，清欠宴却要分摊——你摊到的那份最大。' },
  { id: 'ne20', dept: 'hufang', npcId: 'npc20', gift: 'bank', text: '记簿书生请你吃了碗面，理由是你替他搬了半天账册：“面钱便宜，人情贵。”临走又塞你面钱。' },
  { id: 'ne21', dept: 'hufang', npcId: 'npc21', penalty: 'small', text: '守柜小吏让你替他扶一会儿柜上钥匙，你交还时记岔了一个齿位。他哗啦一响：“配钥匙的钱，你出。”' },
  // ---------- 漕运司 ----------
  { id: 'ne22', dept: 'caoyunsi', npcId: 'npc22', gift: 'contrib', text: '转输主事让你替他在码头盯一夜粮包，天亮记你一笔“督运”，贡献落袋。' },
  { id: 'ne23', dept: 'caoyunsi', npcId: 'npc23', penalty: 'small', text: '问渡翁考你水情，你答错两题。他笑眯眯：“按老规矩，答错的请茶。”茶，不便宜。' },
  { id: 'ne24', dept: 'caoyunsi', npcId: 'npc24', gift: 'bank', text: '押纲使押货归来，分你一份“平安钱”：“船没翻，人人有份。”' },
  { id: 'ne25', dept: 'caoyunsi', npcId: 'npc25', penalty: 'mid', text: '看潮生带你去看潮，潮来时你站错了位置，湿了一身。他大笑：“鞋要买新的——记你账上。”' },
  { id: 'ne26', dept: 'caoyunsi', npcId: 'npc26', gift: 'contrib', text: '理舱客教你把货舱排得又稳又满，排完在册子上记“理舱参详”，你的名字在列。' },
  { id: 'ne27', dept: 'caoyunsi', npcId: 'npc27', penalty: 'small', text: '点垛书吏让你数货垛，数对了，但字写歪了一个。他提笔：“重抄费，一个字数一次。”' },
  { id: 'ne28', dept: 'caoyunsi', npcId: 'npc28', gift: 'bank', text: '过秤童子称重多出一钱余银，塞进你袖子：“替我拿着，沉——拿了就算扛活，扛活就有工钱。”' },
  { id: 'ne29', dept: 'caoyunsi', npcId: 'npc29', penalty: 'big', text: '你帮搬舵小力扛货，错手摔了两包。按码头规矩“损货赔脚力”，这一赔，数目不小。' },
  // ---------- 刑名房 ----------
  { id: 'ne30', dept: 'xingmingfang', npcId: 'npc30', gift: 'contrib', text: '持律主事让你替他执笔研墨审小案，案毕记你“协笔”，贡献落袋。' },
  { id: 'ne31', dept: 'xingmingfang', npcId: 'npc31', penalty: 'mid', text: '衡鉴翁拉你“模拟会审”，你输了。输家罚抄条例一页——纸墨茶钱，自带。' },
  { id: 'ne32', dept: 'xingmingfang', npcId: 'npc32', gift: 'bank', text: '朱笔判官刚判完一桩大案，心情不错，赏全房吃酒，你也得了一份酒钱。' },
  { id: 'ne33', dept: 'xingmingfang', npcId: 'npc33', penalty: 'small', text: '补牍生教你补一份旧文书，补完多出一道墨痕。他叹气：“重审费，一次。”' },
  { id: 'ne34', dept: 'xingmingfang', npcId: 'npc34', gift: 'contrib', text: '核案书吏带你核卷，核完把“会核”记进卷尾——你的名字在。' },
  { id: 'ne35', dept: 'xingmingfang', npcId: 'npc35', penalty: 'mid', text: '校律童子拉你背条例，背错一句罚“纸一张”，你背错了一串——结账时才知纸这么贵。' },
  // ---------- 筹云司 ----------
  { id: 'ne36', dept: 'chouyumsi', npcId: 'npc36', gift: 'bank', text: '观星客让你替他守一夜星图，天亮塞你一份“守夜银”：“星星看了，钱也该拿。”' },
  { id: 'ne37', dept: 'chouyumsi', npcId: 'npc37', penalty: 'mid', text: '烛影先生拉你看蓝图，看着看着你打了个盹。他不恼：“蜡烛钱，你出——半夜的蜡烛，贵。”' },
  { id: 'ne38', dept: 'chouyumsi', npcId: 'npc38', gift: 'contrib', text: '空谈真人把你拉进大棋里“参详”，你只负责点头。散局时记功簿上多了“参详”一名——就是你。' },
  { id: 'ne39', dept: 'chouyumsi', npcId: 'npc39', penalty: 'small', text: '拾筹生借你几根算筹把玩，还回去少了一根。他叹气：“新筹贵，照价赔。”' },
  { id: 'ne40', dept: 'chouyumsi', npcId: 'npc40', gift: 'bank', text: '补漏郎把一处漏洞补上了，得了赏，分你一份：“递工具也算功。”' },
  // ---------- 广闻司 ----------
  { id: 'ne41', dept: 'guangwensi', npcId: 'npc41', gift: 'contrib', text: '扬帆主事征集远航人手，把你记成“岸上接应”。船没开，接应的贡献先记上了。' },
  { id: 'ne42', dept: 'guangwensi', npcId: 'npc42', penalty: 'small', text: '闻风客给你讲了半段风声，另外半段要“茶钱才肯讲”。茶钱不多，但掏得肉疼。' },
  { id: 'ne43', dept: 'guangwensi', npcId: 'npc43', gift: 'bank', text: '传名声子教你喊话的运气法门，学成塞你一份“润喉钱”：“嗓子是司里的本钱，得养。”' },
  { id: 'ne44', dept: 'guangwensi', npcId: 'npc44', penalty: 'mid', text: '看市丞带你逛市集踩点，回来说你“看热闹误了正事”，罚你分摊踩点的茶水账。' },
  { id: 'ne45', dept: 'guangwensi', npcId: 'npc45', gift: 'contrib', text: '吆喝郎喊来一笔大买卖，记功时把你写上“随声附和”——名字虽末，贡献是真。' },
  // ---------- 吏房 ----------
  { id: 'ne46', dept: 'lifang', npcId: 'npc46', penalty: 'mid', text: '执簿主事让你旁观考评，评着评着评到你头上。按规矩，“被评者出存档费”——费，不轻。' },
  { id: 'ne47', dept: 'lifang', npcId: 'npc47', gift: 'contrib', text: '衡才翁难得抬眼，把你记了一笔“常访各房，善通声气”，贡献落袋。' },
  { id: 'ne48', dept: 'lifang', npcId: 'npc48', penalty: 'small', text: '你去递帖子，白主簿照例收了，照例退了，最后照例收了你一份“帖子手续费”。脸色一如往常。' },
  { id: 'ne49', dept: 'lifang', npcId: 'npc49', gift: 'bank', text: '冷面书办让你帮忙搬考成册，搬完塞你一份“辛苦费”，脸还是那张冷脸，钱是真钱。' },
  // ---------- 机巧阁 ----------
  { id: 'ne50', dept: 'jiqiaoge', npcId: 'npc50', gift: 'contrib', text: '督造主事让你替他拉风箱，器成之日记你一笔“助炉”，贡献落袋。' },
  { id: 'ne51', dept: 'jiqiaoge', npcId: 'npc51', penalty: 'mid', text: '观械翁拉你试新机关，机关喷了你一脸墨。他抚掌：“测试要真实——洗衣费，分摊。”' },
  { id: 'ne52', dept: 'jiqiaoge', npcId: 'npc52', gift: 'bank', text: '墨匠人修机关缺个搭手的，你递了半日工具。修成后他把余料钱塞给你：“账上多的，不拿白不拿。”' },
  { id: 'ne53', dept: 'jiqiaoge', npcId: 'npc53', penalty: 'small', text: '拾械童子借你一个小玩意解闷，还回去时齿轮松了半格。他掏出账本：“保养费，一次。”' },
  // ---------- 察案院 ----------
  { id: 'ne54', dept: 'chaanyuan', npcId: 'npc54', gift: 'contrib', text: '照影主事巡查缺个提灯的，拉你随行。巡毕记你“随巡”，贡献落袋——虽然你只是提灯。' },
  { id: 'ne55', dept: 'chaanyuan', npcId: 'npc55', penalty: 'mid', text: '持镜客让你替他照一回案，案照完了，镜子把手滑了一下。他记了一笔：“磕碰修费，经手人出。”' },
  { id: 'ne56', dept: 'chaanyuan', npcId: 'npc56', gift: 'bank', text: '留痕生让你抄一份巡查留痕，抄完付你“抄录费”，还补一句：“字不错，记下了。”' },
  // ---------- 制香坊 ----------
  { id: 'ne57', dept: 'zhixiangfang', npcId: 'npc57', penalty: 'big', text: '司炉主事让你看一夜炉火，火在你手里熄了一刻。他叹气记账：“断火折损”——这一笔，不小。' },
  { id: 'ne58', dept: 'zhixiangfang', npcId: 'npc58', gift: 'bank', text: '守灶翁看你守灶看得认真，塞你一袋新出的香：“拿去熏屋子。卖出去的钱，咱俩分——”你没卖，钱还是分了。' },
];

// 每房事件池：现有轶事（含博士暗线，原样不动）+ 该房 NPC 交互事件
const POOL_BY_DEPT = {};
for (const e of [...VISIT_EVENTS, ...NPC_EVENTS]) {
  (POOL_BY_DEPT[e.dept] ??= []).push(e);
}

export function visitPoolOf(deptId) {
  return POOL_BY_DEPT[deptId] ?? [];
}

// Fisher-Yates 洗牌；rng 可注入便于测试
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 洗牌袋散排（用户硬性要求：同一事件不在相近日期重复出现）：
// 每房一袋，袋 = 该房全池事件洗乱；抽完一张才少一张，一轮内绝不重复；
// 袋空重装时若首张 === 上一轮最后一张，则与随机位置互换，保证跨轮也不连续重复。
// decks 持久化在存档（state.decks），跨天不清空——散排以"轮"为单位而非"日"。
export function drawDeckEvent(decks, deptId, rng = Math.random) {
  const pool = visitPoolOf(deptId);
  if (pool.length === 0) return null;
  let bag = decks[deptId];
  if (!bag || !Array.isArray(bag.cards) || bag.cards.length === 0) {
    const cards = shuffle(pool.map((e) => e.id), rng);
    const last = bag?.last ?? null;
    if (last && cards.length > 1 && cards[0] === last) {
      const j = 1 + Math.floor(rng() * (cards.length - 1));
      [cards[0], cards[j]] = [cards[j], cards[0]];
    }
    bag = { cards, last };
    decks[deptId] = bag;
  }
  const id = bag.cards.shift();
  bag.last = id;
  return pool.find((e) => e.id === id) ?? null;
}
