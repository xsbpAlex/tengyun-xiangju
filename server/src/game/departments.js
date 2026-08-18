// 部门数据（GDD §3.1/§3.3）。v1 首发 10 部门，部门=职业。
// 独家机制（筹云司争位/广闻司远航/吏房考成/刑名房两堂）后置点亮，机会均等铁律见 GDD §3。
// 每个部门带一门专属功法（功法双槽制的部门槽），效果字段供引擎读取：
//   salaryBonus     薪酬产出加成/级    drainMult       心力消耗增幅/级
//   drainCut        心力消耗减免/级    offlineBonus    离线倍率加成/级
//   costCut         研习费折扣/级      promoteFeeCut   晋升打点费折扣/级
//   questSpeedBonus 差事办结速度加成/级（M5.5 修正，替换原摸鱼冷却）
//   contribBonus    贡献获取加成/级（M5.5 修正，替换原摸鱼值）
//   voyageBonus     远航收益加成/级（远航为全员玩法）
//   kaochengBonus   考成评分加成/级（考成为全员玩法）
export const DEPARTMENTS = [
  {
    id: 'qianyafang',
    name: '签押房',
    role: '枢纽综办',
    style: '均衡万金油 · 乡音会 · 被动加班',
    desc: '衙门的枢纽，上情下达、公文往来皆过此房之手。同僚多操南洋土话，抱团成风，天降差事常常先砸到这里——也正因过手的事多，办起活来最讲一个“快”字。',
    gongfa: {
      name: '乡音诀',
      desc: '同僚打掩护，活儿干得快',
      effect: '差事办结速度每级+5%',
      mods: { questSpeedBonus: 0.05 },
    },
  },
  {
    id: 'hufang',
    name: '户房',
    role: '钱粮账目',
    style: '经济碾压流 · 钱多命短 · 大限风暴',
    desc: '掌衙门钱粮，握算盘、管账册、对仓廪。俸禄冠绝诸房，但差事重、心力熬，月月有大限风暴临头，同僚流失也是各房中最快的——富贵险中求。',
    gongfa: {
      name: '算盘经',
      desc: '钱多命短，富贵险中求',
      effect: '俸禄每级+25%，心力消耗每级+30%',
      mods: { salaryBonus: 0.25, drainMult: 0.3 },
    },
  },
  {
    id: 'zhixiangfang',
    name: '制香坊',
    role: '生产工坊',
    style: '生产链管理流 · 全衙门最神秘',
    desc: '灵叶进、仙香出，坊中工序无人能道清，只闻得香雾缭绕。手艺人讲究收成，收菜那一下最见功夫；香成出坊之日，便是账上最体面之时。',
    gongfa: {
      name: '调香手札',
      desc: '手艺人的收成，一分耕耘一分香',
      effect: '薪酬产出每级+15%',
      mods: { salaryBonus: 0.15 },
    },
  },
  {
    id: 'caoyunsi',
    name: '漕运司',
    role: '转运调度',
    style: '贸易调度流 · 船不停钱不停',
    desc: '调度香路漕运，南货北调，低买高卖。船在走，钱在流——人不在衙门，收益照样进账，是诸房中最耐“离岗”的一房。',
    gongfa: {
      name: '漕路要略',
      desc: '船在走，钱在流',
      effect: '离线收益倍率每级+0.2',
      mods: { offlineBonus: 0.2 },
    },
  },
  {
    id: 'jiqiaoge',
    name: '机巧阁',
    role: '格物器械',
    style: '装备科技流 · 前期弱后期猛',
    desc: '修缮法器、牵线机关、守阵护院，阁中尽是叮叮当当的敲打声。格物之人读书成本低，研习费天生打折；往后法器机关越攒越多，也最趁手。',
    gongfa: {
      name: '格物篇',
      desc: '技术流学习成本天生低',
      effect: '研习费每级×0.8',
      mods: { costCut: 0.2 },
    },
  },
  {
    id: 'chaanyuan',
    name: '察案院',
    role: '监察巡查',
    style: '整活流 · 巡查全是表演',
    desc: '预告式巡查、留痕式监察，查的不是案，是姿态。在这里当差，表面功夫就是真功夫，账面上的贡献自然比谁都好看。',
    gongfa: {
      name: '表面功',
      desc: '表面功夫做足，账面贡献自然高',
      effect: '贡献获取每级+15%',
      mods: { contribBonus: 0.15 },
    },
  },
  {
    id: 'chouyumsi',
    name: '筹云司',
    role: '幕僚筹划',
    style: '高能力强压力 · 监正之位虚悬',
    desc: '衙门里最能画蓝图的一群人，筹的是一局大棋。能力强、压力大，上官的饼也画得格外圆。监正之位虚悬已久，各方都在盯着。',
    gongfa: {
      name: '筹云疏',
      desc: '蓝图绘得好，上官少收钱',
      effect: '晋升打点费每级-15%',
      mods: { promoteFeeCut: 0.15 },
    },
  },
  {
    id: 'guangwensi',
    name: '广闻司',
    role: '声名外务',
    style: '绩效流 · 出海次数最多',
    desc: '香局主业门面，扬名声、通外务，出海远航最勤的一房。远航人人可去，唯独这一房的水手最懂风向，海上得的也多。',
    gongfa: {
      name: '航路簿',
      desc: '远航人人可去，唯我最识风向',
      effect: '远航出差收益每级+25%（远航为全员玩法）',
      mods: { voyageBonus: 0.25 },
    },
  },
  {
    id: 'lifang',
    name: '吏房',
    role: '铨选考成',
    style: '冷面判官 · 好感难刷收益大',
    desc: '掌人事铨选、进退考成，冷面无私，谁来递帖子都是那副脸色。考成人人须过，唯独这一房的人最懂考评的门道。',
    gongfa: {
      name: '登记簿',
      desc: '考成人人须过，唯我最懂门道',
      effect: '考成评分每级+10%（考成为全员玩法）',
      mods: { kaochengBonus: 0.1 },
    },
  },
  {
    id: 'xingmingfang',
    name: '刑名房',
    role: '律例审计',
    style: '一房两堂 · 谨小慎微',
    desc: '研天条仙律、查案卷账目，一房之内分合规、审计两堂。行事谨慎、步步留痕，最不累心，熬得起也睡得着。',
    gongfa: {
      name: '慎行录',
      desc: '谨小慎微，不累心',
      effect: '心力消耗每级-20%',
      mods: { drainCut: 0.2 },
    },
  },
];

export const EMPTY_MODS = {
  salaryBonus: 0,
  drainMult: 0,
  drainCut: 0,
  offlineBonus: 0,
  costCut: 0,
  promoteFeeCut: 0,
  questSpeedBonus: 0,
  contribBonus: 0,
  voyageBonus: 0,
  kaochengBonus: 0,
};

export function findDept(id) {
  return DEPARTMENTS.find((d) => d.id === id) ?? null;
}
