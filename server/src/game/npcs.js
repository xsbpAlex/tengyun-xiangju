// M6 衙门百官录：NPC 填榜（GDD_v2 §18.2）。
// 名册镜像原型公司组织架构（用户部门表）：十部门 58 位同僚全部上榜，
// 「领导」栏 6 人（堂上诸公）不上榜——只以"天象"影响全局（GDD_v1 §4.1）。
// 化名全部为游戏世界观原创，零现实词汇；现实职务只取"层级结构"，映射为衙门官职：
//   总监→知事  副总监→高级副主事  高级经理→副主事  高级副经理→管事
//   经理→资深书吏  资深专员→书吏  专员/会计/出纳→书吏  助理/司机→帮闲
// M6.1 数值重定（用户决议）：办差力按职级直定档，锚定玩家新曲线（毕业裸体 350、
// 装备顶配 +124）：总监 420 毕业带装备稳超；另设传说 3 位 480+，二周目才能越过。

// 职务层级 → 官职（rank=职序, rankLvl=职内级）与办差力定档 z
const POS = {
  zongjian:     { rank: 6, rankLvl: 10, z: 420 },
  fuzongjian:   { rank: 5, rankLvl: 10, z: 330 },
  gaojing:      { rank: 4, rankLvl: 10, z: 250 },
  gaofu:        { rank: 3, rankLvl: 10, z: 200 },
  jingli:       { rank: 2, rankLvl: 10, z: 150 },
  zishen:       { rank: 1, rankLvl: 10, z: 115 },
  zhuanyuan:    { rank: 1, rankLvl: 4,  z: 85 },
  bangxian:     { rank: 0, rankLvl: 4,  z: 60 },
};

// 58 位同僚：[化名, 房 id, 职务层级, 一句话履历（可省）]
export const COLLEAGUES = [
  // ---------- 签押房（枢纽综办，11 人） ----------
  ['云章主事', 'qianyafang', 'zongjian', '上情下达四十年，经手的公文比坊里的茶还多。'],
  ['衔泥客', 'qianyafang', 'fuzongjian'],
  ['传灯生', 'qianyafang', 'gaojing'],
  ['拾遗郎', 'qianyafang', 'gaojing'],
  ['走马丞', 'qianyafang', 'gaofu'],
  ['青牍子', 'qianyafang', 'jingli'],
  ['衔书雁', 'qianyafang', 'jingli'],
  ['驿铃生', 'qianyafang', 'jingli'],
  ['白帖书吏', 'qianyafang', 'zishen'],
  ['泥砚童子', 'qianyafang', 'zhuanyuan'],
  ['备车老苍', 'qianyafang', 'bangxian', '白天当差，夜里守着车马，谁出门都先问他。'],
  // ---------- 户房（钱粮账目，10 人） ----------
  ['执算主事', 'hufang', 'zongjian', '户房月月有大限，他月月在大限里喝茶。'],
  ['对账先生', 'hufang', 'fuzongjian'],
  ['金账房', 'hufang', 'gaojing'],
  ['铁算盘', 'hufang', 'gaojing'],
  ['量斗生', 'hufang', 'gaojing'],
  ['持筹客', 'hufang', 'gaojing'],
  ['平账老吏', 'hufang', 'gaofu'],
  ['折券翁', 'hufang', 'gaofu'],
  ['记簿书生', 'hufang', 'jingli'],
  ['守柜小吏', 'hufang', 'zhuanyuan', '柜子钥匙挂腰间，走路哗啦响，老远就知道是他。'],
  // ---------- 漕运司（转运调度，8 人） ----------
  ['转输主事', 'caoyunsi', 'zongjian', '人在衙门坐，账从八方来。'],
  ['问渡翁', 'caoyunsi', 'fuzongjian'],
  ['押纲使', 'caoyunsi', 'gaojing'],
  ['看潮生', 'caoyunsi', 'gaojing'],
  ['理舱客', 'caoyunsi', 'jingli'],
  ['点垛书吏', 'caoyunsi', 'zishen'],
  ['过秤童子', 'caoyunsi', 'zhuanyuan'],
  ['搬舵小力', 'caoyunsi', 'bangxian'],
  // ---------- 刑名房（律例审计，6 人） ----------
  ['持律主事', 'xingmingfang', 'zongjian', '每卷底下压着别人的前程，他轻拿轻放了一辈子。'],
  ['衡鉴翁', 'xingmingfang', 'fuzongjian'],
  ['朱笔判官', 'xingmingfang', 'gaofu'],
  ['补牍生', 'xingmingfang', 'gaofu'],
  ['核案书吏', 'xingmingfang', 'zishen'],
  ['校律童子', 'xingmingfang', 'zishen'],
  // ---------- 筹云司（幕僚筹划，5 人） ----------
  ['观星客', 'chouyumsi', 'fuzongjian'],
  ['烛影先生', 'chouyumsi', 'gaojing', '蓝图都画在深夜，因为白天要留着开会。'],
  ['空谈真人', 'chouyumsi', 'gaojing', '他筹过的大棋能铺满三张桌，落子的从来是别人。'],
  ['拾筹生', 'chouyumsi', 'zishen'],
  ['补漏郎', 'chouyumsi', 'zishen'],
  // ---------- 广闻司（声名外务，5 人） ----------
  ['扬帆主事', 'guangwensi', 'zongjian'],
  ['闻风客', 'guangwensi', 'fuzongjian'],
  ['传名声子', 'guangwensi', 'gaojing'],
  ['看市丞', 'guangwensi', 'gaofu'],
  ['吆喝郎', 'guangwensi', 'jingli', '嗓门是司里最响的，风向也是他先喊的。'],
  // ---------- 吏房（铨选考成，4 人） ----------
  ['执簿主事', 'lifang', 'zongjian', '考评别人的人，自己也被考评了一辈子。'],
  ['衡才翁', 'lifang', 'fuzongjian'],
  ['白主簿', 'lifang', 'gaojing', '递帖子的人排到门外，他的脸色排在门内，一如往常。'],
  ['冷面书办', 'lifang', 'jingli'],
  // ---------- 机巧阁（格物器械，4 人） ----------
  ['督造主事', 'jiqiaoge', 'zongjian'],
  ['观械翁', 'jiqiaoge', 'fuzongjian'],
  ['墨匠人', 'jiqiaoge', 'jingli', '阁里一半机关是他造的，另一半是他修的。'],
  ['拾械童子', 'jiqiaoge', 'zishen'],
  // ---------- 察案院（监察巡查，3 人） ----------
  ['照影主事', 'chaanyuan', 'zongjian'],
  ['持镜客', 'chaanyuan', 'fuzongjian'],
  ['留痕生', 'chaanyuan', 'gaojing', '查的不是案，是姿态——这话他记在了册子里。'],
  // ---------- 制香坊（生产工坊，2 人） ----------
  ['司炉主事', 'zhixiangfang', 'fuzongjian'],
  ['守灶翁', 'zhixiangfang', 'gaojing', '炉火四十年没断过，他说火比人诚实。'],
];

// 展开为榜单行数据
export const NPCS = COLLEAGUES.map(([name, dept, pos, flavor], i) => ({
  id: `npc${i + 1}`,
  name,
  dept,
  ...POS[pos],
  flavor: flavor ?? null,
}));

// M6.1 传说位（用户决议）：站在一周目天花板之上的三位传说前辈，
// 毕业带装备（474）也够不着，二周目资历/神器自然越过；非领导栏人物，零现实词汇。
export const LEGENDS = [
  { name: '开山监正', dept: 'qianyafang', z: 500, flavor: '衙门初立时那位什么都管的开山人。如今没人说得清他管过什么，只记得所有老规矩的落款都是他。' },
  { name: '守灯博士', dept: 'chouyumsi', z: 490, flavor: '蓝图堆里那页没落款的字条，据说就是他写的。有人说他还在某盏灯下当值，只是编外多年，没人给他记过名。' },
  { name: '首炉匠师', dept: 'zhixiangfang', z: 480, flavor: '制香坊第一炉的火是他点的。守灶翁说：炉火四十年没断，断过的那一次，是他不在的那天。' },
];

// NPC 办差力：M6.1 起按职级直定档（锚定玩家毕业曲线），不再用公式推算
export function npcZabanli(n) {
  return n.z;
}
