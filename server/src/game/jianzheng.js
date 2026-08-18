// M7.5 监正争夺战（GDD_v2 §13.2 大事件内容投放）：二周目且办差力进 NPC 榜前五才开议。
// 用户拍板（2026-08-17）：① 门槛 = 二周目 + 办差力榜单前五（给二周目动力）；
// ② 三场对局叙事战（办差力判定，败零惩罚可再战）；③ 讽刺留白结局——赢遍三场也坐不上那把椅子。
// 铁律：不点不亏不过期（pendingSpecial 挂着等玩家）；失败零惩罚；数值只奖不罚。
import { NPCS, LEGENDS } from './npcs.js';

export const JIANZHENG_SPECIAL_TEXT = '朱批要务：监正之位空悬已久，堂上议定——择能者试之。';
export const JIANZHENG_PREVIEW_TEXT = '邸报金标：堂上议定，择能者试监正之位——中栏告示有详文，且去一观。';

export const JIANZHENG_TITLE_ID = 'jianzheng_zhengduo';
export const JIANZHENG_FINAL_CONTRIB = 200;

// 三位候选：皆为知事档（办差力 420），叙事战对手按房头取人，零现实词汇
export const JIANZHENG_CANDIDATES = [
  {
    id: 'yunzhang',
    name: '云章主事',
    dept: 'qianyafang',
    z: 420,
    intro: '上情下达四十年，他笔下印章的轻重，就是衙门的轻重。要争这个位子，先过他这一关。',
    winText: '三枚印落定，云章主事搁下笔：「你的文书，能办事。」这一场，他认了。',
    loseText: '你的文书还是轻了些。云章主事没批，只退了一句：「再拟。」败不要紧，改了再来。',
  },
  {
    id: 'zhisuan',
    name: '执算主事',
    dept: 'hufang',
    z: 420,
    intro: '户房月月有大限，他月月在大限里喝茶。要争这个位子，先陪他对一局账。',
    winText: '算盘打过三巡，执算主事合上册子：「一文不差。」能当户房的账，这一场，他认了。',
    loseText: '算盘上你输了一粒珠。执算主事给你添了杯茶：「回去再练练。」败不要紧，练了再来。',
  },
  {
    id: 'chilv',
    name: '持律主事',
    dept: 'xingmingfang',
    z: 420,
    intro: '每卷底下压着别人的前程，他轻拿轻放了一辈子。要争这个位子，先答他三问。',
    winText: '三问答罢，持律主事点头：「你懂律例，也懂宽宥。」这一场，他认了。',
    loseText: '三问你答岔了两处。持律主事不恼：「懂律例不难，懂宽宥难。」败不要紧，悟了再来。',
  },
];

// 讽刺留白结局：三场全赢，椅子还是那把空椅子
export const JIANZHENG_FINAL_TEXT =
  '三场比罢，你全胜。堂上诸公议了很久，最后檐上传来一句：「兹事体大，容后再议。」——椅子还是空的。你收拾文书出堂，脚步倒比进堂时轻：原来争到最后，争的不过是敢争这一件事。';

// 办差力在静态 NPC 榜（三传说 + 58 同僚）上的名次：1 + 严格高于你的人数
export function jianzhengBoardRank(z) {
  const above =
    NPCS.filter((n) => n.z > z).length + LEGENDS.filter((l) => l.z > z).length;
  return above + 1;
}

// 开议条件：二周目起 + 榜前五（≤5）。未开过议（jianzheng 为空）才触发。
export function jianzhengReady(state, z) {
  if ((state.loop ?? 1) < 2) return false;
  if (state.jianzheng) return false;
  return jianzhengBoardRank(z) <= 5;
}
