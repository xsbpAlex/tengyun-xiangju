// M9 入职文书：新号建号后、选部门前的一页故事背景（只播一次，零强制）
export default function OnboardingIntro({ onDone }: { onDone: () => void }) {
  return (
    <div className="auth-backdrop">
      <div className="panel intro-scroll">
        <img className="auth-emblem" src="/emblem.png" alt="" />
        <h1 className="title">入衙文书</h1>
        <p className="intro-line">
          十年寒窗，数番比试——你过了一关又一关，闯了一试又一轮。今日，你的名字终于写上了朱榜：
          自此，你便是仙朝官办·腾云香局里当差的一分子。
        </p>
        <p className="intro-line">
          进衙之前，你听人说过无数遍这里的名头：俸禄彩头冠绝诸司，灵草仙香皆由官办，
          最要紧的是——传说当差当得久了，仙籍有望，有朝一日能脱了这身凡骨。
        </p>
        <p className="intro-line">
          只是真领了文书才晓得，头一月的俸银实在不多。你数了数掌心里那几枚灵石，
          跟传闻里的数目，差了不是一星半点。
        </p>
        <p className="intro-line">
          可转念一想：这衙门面朝仙朝、台高路宽，饼画得又大又圆。好好当差，上官总会看见你——
          说不定哪日，这衙门的朱榜上，就有你响亮的名号。
        </p>
        <p className="intro-line">
          于是你深吸一口气，整了整衣领，领下这块木牌，满怀期待地迈进了衙门大门。
        </p>
        <button className="btn" onClick={onDone}>
          领牌入衙
        </button>
        <p className="dim-tip">入衙后有老吏引路，带你认认各处的门道。</p>
      </div>
    </div>
  );
}
