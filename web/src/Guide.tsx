// M9 新手引导：经典 spotlight——压暗全屏、目标区域挖孔高亮、浮卡讲门道
// 目标不在视口先滚过去；resize/滚动实时重算；全程可跳过，只看一次（localStorage 记档）
import { useEffect, useState, type CSSProperties } from 'react';

interface GuideStep {
  sel: string;
  title: string;
  text: string;
}

const STEPS: GuideStep[] = [
  {
    sel: '.g-station',
    title: '工位 · 薪酬自动入账',
    text: '这是你的工位。俸银（灵石）逐秒自动入账，不用收、不用点——人不在衙门，薪酬照样在涨。挂着你忙你的，回来收账就行。',
  },
  {
    sel: '.g-res',
    title: '身家 · 三种家底',
    text: '三种家底要分清：灵石是俸银，攒着晋升研习用；贡献靠办差挣来，锻法器全靠它；办差力是你能扛多重活的标尺——越高，接得了越硬的差事。',
  },
  {
    sel: '.g-xinli',
    title: '心力 · 当差的底气',
    text: '办差都耗心力，耗空了就「职业倦怠」，产出打折。歇着便能自己缓回来——不急这一时，不点不亏。',
  },
  {
    sel: '.g-growth',
    title: '宦途 · 晋升与研习',
    text: '宦途经验挂机就涨，攒满了点「晋升」升一级；Lv10 跨职才花灵石打点。两本功法添产出，灵石富余时研习，不急。',
  },
  {
    sel: '.g-quest',
    title: '案牍山 · 差事自动办',
    text: '差事自动挂在办差力够得着的最高档上，办结自动续。想盯着某一档办，就在差事榜点一下锁住——什么都不点，也不亏。',
  },
  {
    sel: '.g-realm',
    title: '外差 · 秘境与凌霄阶',
    text: '例巡、夜值悬案、凌霄阶都在这一区：每日限次，彩头不薄，失手零惩罚。得闲去转转，不去也不亏。',
  },
  {
    sel: '.g-gear',
    title: '机巧阁 · 法器锻铸',
    text: '贡献在这里换成法器，直接抬办差力，十锻之内必有保底；强化失手也只掉一级，绝不寒碜人。',
  },
  {
    sel: '.g-board',
    title: '百官录 · 衙门座次',
    text: '全衙门的人都在这一榜：左看办差力，右看凌霄阶，点名字能翻履历。你的名号，迟早也要往上挪一挪。',
  },
];

const PAD = 6; // 挖孔比目标宽出一圈
const CARD_W = 340;

export default function Guide({ onClose }: { onClose: (finished: boolean) => void }) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(STEPS[idx].sel);
    if (!el) return;
    const measure = () => setRect(el.getBoundingClientRect());
    el.classList.add('guide-target');
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    measure();
    // 平滑滚动落定后再量一次，保证挖孔贴着目标
    const t = window.setTimeout(measure, 420);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      el.classList.remove('guide-target');
    };
  }, [idx]);

  const step = STEPS[idx];
  const last = idx === STEPS.length - 1;

  // 浮卡摆位：目标下方放得下就放下边，否则压上边；横向不越出视口
  let cardStyle: CSSProperties = { opacity: 0 };
  if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = rect.bottom + PAD + 172 <= vh;
    const left = Math.min(Math.max(12, rect.left), vw - CARD_W - 12);
    cardStyle = below
      ? { top: rect.bottom + PAD + 10, left, opacity: 1 }
      : { top: Math.max(12, rect.top - PAD - 10), left, transform: 'translateY(-100%)', opacity: 1 };
  }

  return (
    <div className="guide-root">
      {rect ? (
        <div
          className="guide-hole"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
          }}
        />
      ) : null}
      <div className="guide-card" style={cardStyle}>
        <div className="guide-card-head">
          <span className="guide-card-title">{step.title}</span>
          <span className="guide-card-count">
            {idx + 1}/{STEPS.length}
          </span>
        </div>
        <p className="guide-card-text">{step.text}</p>
        <div className="guide-card-btns">
          <button className="link-btn" onClick={() => onClose(false)}>
            跳过引导
          </button>
          <span className="guide-card-spacer" />
          {idx > 0 ? (
            <button className="grow-btn" onClick={() => setIdx(idx - 1)}>
              上一处
            </button>
          ) : null}
          <button className="grow-btn" onClick={() => (last ? onClose(true) : setIdx(idx + 1))}>
            {last ? '领教完毕，上任' : '下一处'}
          </button>
        </div>
      </div>
    </div>
  );
}
