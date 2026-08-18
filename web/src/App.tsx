import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  getToken,
  setToken,
  type AccountInfo,
  type ClimbLine,
  type ClimbResult,
  type DailyTargets,
  type DeptInfo,
  type GameConfig,
  type GameState,
  type LeaderboardData,
  type LeaderRow,
  type LedgerPage,
  type OfflineReport,
  type QuestTitle,
  type RealmInfo,
  type StatePayload,
  type VisitEvent,
  type VisitGift,
  type XianjiInfo,
} from './api';
import { playSfx, setSoundOn, soundOn, unlockAudio } from './audio';

// ---------- 展示工具 ----------
function fmt(n: number): string {
  return Math.floor(n).toLocaleString('zh-CN');
}
function fmtDur(ms: number): string {
  const m = Math.max(1, Math.floor(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} 小时 ${m % 60} 分` : `${m} 分钟`;
}

interface FloatText {
  id: number;
  text: string;
}

// ---------- M7 铸词预告（镜像服务端 judgeTrait，仅展示用，权威以服务端为准） ----------
const TRAIT_NORM = { quest: 800, enhance: 80, realm: 100, visit: 100 };
const TRAIT_LOW_BAR = 0.25;
function previewTrait(stats: GameState['stats'] | undefined): string {
  const s = { quest: 0, enhance: 0, patrol: 0, night: 0, visit: 0, ...stats };
  const scores: [string, number][] = [
    ['andu_deep', s.quest / TRAIT_NORM.quest],
    ['forge_keen', s.enhance / TRAIT_NORM.enhance],
    ['realm_active', (s.patrol + s.night) / TRAIT_NORM.realm],
    ['visit_wide', s.visit / TRAIT_NORM.visit],
  ];
  let best = 'balanced';
  let bestScore = TRAIT_LOW_BAR;
  for (const [trait, score] of scores) {
    if (score > bestScore) {
      best = trait;
      bestScore = score;
    }
  }
  return best;
}

// 值夜/日间切换：持久化到 localStorage，index.html 已在渲染前应用防闪白
function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme !== 'light');
  function toggle() {
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('ty_theme', next);
    } catch {
      /* 隐身模式下无 localStorage，忽略 */
    }
    setDark(next === 'dark');
  }
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      title={dark ? '换回日间' : '值夜模式'}
      aria-label="切换主题"
    >
      {dark ? '☀' : '☾'}
    </button>
  );
}

// M8 音效开关：合成音效默认开，偏好持久化；图标 ♪/静
function SoundToggle() {
  const [on, setOn] = useState(soundOn);
  function toggle() {
    const next = !on;
    setSoundOn(next);
    setOn(next);
    if (next) playSfx('open'); // 开声先给一声低响，让玩家知道音量几何
  }
  return (
    <button
      className="theme-toggle sound-toggle"
      onClick={toggle}
      title={on ? '关掉音效' : '打开音效'}
      aria-label="切换音效"
    >
      {on ? '♪' : '静'}
    </button>
  );
}

function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const r =
        mode === 'login'
          ? await api.login(username.trim(), password)
          : await api.register(username.trim(), password);
      setToken(r.token);
      onAuthed();
    } catch (e) {
      setError(e instanceof Error ? e.message : '出了点状况');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-backdrop">
      <div className="panel">
        <img className="auth-emblem" src="/emblem.png" alt="" />
        <h1 className="title">腾云香局</h1>
      <p className="subtitle">仙朝官办 · 灵草种植与仙香制炼衙署</p>
      <div className="tabs">
        <button
          className={`tab ${mode === 'login' ? 'active' : ''}`}
          onClick={() => setMode('login')}
        >
          入衙点卯
        </button>
        <button
          className={`tab ${mode === 'register' ? 'active' : ''}`}
          onClick={() => setMode('register')}
        >
          新投名帖
        </button>
      </div>
      <div className="field">
        <label>名号</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="报上名来" />
      </div>
      <div className="field">
        <label>口令</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="口令至少 6 位"
        />
      </div>
      <button className="btn" onClick={submit} disabled={busy}>
        {busy ? '核验中…' : mode === 'login' ? '进入衙门' : '递上名帖'}
      </button>
      <p className="error">{error}</p>
      </div>
    </div>
  );
}

// M3 选任部门：出身即职业，选定不悔，转生才能换
// M7：loop > 1 = 辞官转生号，顶部加失忆梗（记忆没了，手感还在）
function DeptSelectScreen({ loop, onChose }: { loop: number; onChose: () => void }) {
  const [depts, setDepts] = useState<DeptInfo[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .departments()
      .then((r) => setDepts(r.departments))
      .catch(() => setError('名册没取来，稍后再试'));
  }, []);

  async function confirm() {
    if (!picked || busy) return;
    setBusy(true);
    setError('');
    try {
      await api.chooseDept(picked);
      onChose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '递牌未成');
      setBusy(false);
    }
  }

  const pickedDept = depts?.find((d) => d.id === picked) ?? null;

  return (
    <div className="auth-backdrop">
    <div className="panel dept-panel">
      <h1 className="title">选任房头</h1>
      <p className="subtitle">出身即职业 · 选定不悔 · 转生方能改换门庭</p>
      {loop > 1 ? (
        <p className="amnesia-line">
          不知道为什么，你失去了之前的记忆，但你觉得这个地方你好像来过。
        </p>
      ) : null}
      <div className="dept-grid">
        {(depts ?? []).map((d) => (
          <button
            key={d.id}
            className={`dept-card ${picked === d.id ? 'picked' : ''}`}
            onClick={() => setPicked(d.id)}
          >
            <span className="dept-name">{d.name}</span>
            <span className="dept-role">{d.role}</span>
            <span className="dept-style">{d.style}</span>
          </button>
        ))}
      </div>
      {pickedDept ? (
        <div className="dept-detail">
          <p>{pickedDept.desc}</p>
          <p className="dept-gongfa">
            本门功法《{pickedDept.gongfa.name}》——{pickedDept.gongfa.effect}
          </p>
        </div>
      ) : (
        <p className="dept-detail dim-tip">点上方房牌，查看各房职掌与本门功法。</p>
      )}
      <button className="btn" onClick={confirm} disabled={!picked || busy}>
        {busy ? '递牌中…' : '递牌入房'}
      </button>
      <p className="error">{error}</p>
    </div>
    </div>
  );
}

function GameScreen({ onLogout }: { onLogout: () => void }) {
  const [me, setMe] = useState<AccountInfo | null>(null);
  const [config, setConfig] = useState<GameConfig | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [deptList, setDeptList] = useState<DeptInfo[]>([]);
  const [report, setReport] = useState<OfflineReport | null>(null);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const [toast, setToast] = useState('');
  const [srvRate, setSrvRate] = useState(0); // 服务端实时产出速率（含职级/功法）
  const [gCost, setGCost] = useState(0); // 通用槽研习费
  const [dgCost, setDgCost] = useState(0); // 部门槽研习费
  const [promoteFee, setPromoteFee] = useState<number | null>(null); // 折后晋升费
  const [rankNeed, setRankNeed] = useState<number | null>(null); // M5.6：职内下一级所需经验
  // ---------- M5.7 串门子 ----------
  const [visitLeft, setVisitLeft] = useState(0); // 今日剩余串门次数
  const [visitNote, setVisitNote] = useState<{
    deptName: string;
    event: VisitEvent;
    gift: VisitGift | null;
    loss: VisitGift | null;
  } | null>(null); // 串门轶事弹窗内容
  // ---------- M6 衙门百官录 ----------
  const [board, setBoard] = useState<LeaderboardData | null>(null); // 百官录当前 tab 榜单
  const [boardTab, setBoardTab] = useState<'z' | 'floors'>('z'); // 办差力 / 凌霄阶
  const [card, setCard] = useState<LeaderRow | null>(null); // 履历卡弹窗
  const [zabanli, setZabanli] = useState(0); // 办差力（服务端计算）
  // ---------- M5.5 ----------
  const [speedBonus, setSpeedBonus] = useState(0); // 游刃有余当前提速
  const [dailyTargets, setDailyTargets] = useState<DailyTargets | null>(null);
  const [titles, setTitles] = useState<QuestTitle[]>([]);
  // ---------- M6.5 外差 ----------
  const [realmInfo, setRealmInfo] = useState<RealmInfo | null>(null); // 秘境/天梯展示汇总
  const [realmTab, setRealmTab] = useState<'patrol' | 'night' | 'ladder'>('patrol');
  const [realmNote, setRealmNote] = useState(''); // 最近一次外差结果短播报
  // ---------- M7.6 凌霄阶攻略感 ----------
  const [ladderLog, setLadderLog] = useState<ClimbLine[]>([]); // 登阶志：仅存本次会话，新在前
  const [battleReport, setBattleReport] = useState<ClimbResult | null>(null); // 冲阵战报卷轴
  // ---------- M7.5 监正争夺战 ----------
  const [jianzhengOpen, setJianzhengOpen] = useState(false); // 告示卷轴是否展开
  const [jianzhengNote, setJianzhengNote] = useState(''); // 最近一场对局结果文案
  const [jianzhengFinale, setJianzhengFinale] = useState<string | null>(null); // 留白结局（全胜后展示）
  // M8：金标告示新挂上时轻提醒一声（null→非空 的跳变才响，不扰挂机）
  const prevSpecialRef = useRef<string | null>(null);
  useEffect(() => {
    const cur = state?.pendingSpecial ?? null;
    if (cur && !prevSpecialRef.current) playSfx('notice');
    prevSpecialRef.current = cur;
  }, [state?.pendingSpecial]);
  // ---------- M6.8 邸报 ----------
  const [dibaoOpen, setDibaoOpen] = useState(false); // 邸报展开浮层
  // ---------- M5 ----------
  const [xianji, setXianji] = useState<XianjiInfo | null>(null); // 仙籍进度条（表面目标）
  const [xinshi, setXinshi] = useState(''); // 心事阶段文案（模糊，不暴露幻灭数值）
  const [fork, setFork] = useState<string | null>(null); // 岔路事件状态
  const [tongtou, setTongtou] = useState(0); // 通透值（分支 A）
  // ---------- M7 转生二周目 ----------
  const [rebirthOpen, setRebirthOpen] = useState(false); // 交接文书确认卷轴
  const [wallNotice, setWallNotice] = useState<string | null>(null); // 待读的撞墙告示
  const [ledgerPages, setLedgerPages] = useState<LedgerPage[] | null>(null); // 旧账册弹窗内容
  const [, force] = useState(0);
  const syncAtRef = useRef(Date.now());
  const busyRef = useRef(false);

  // 所有状态接口都附带 ratePerMin/研习费/办差力，统一同步
  const applyPayload = useCallback((p: StatePayload) => {
    setState(p.state);
    setSrvRate(p.ratePerMin);
    setGCost(p.gongfaCost);
    setDgCost(p.deptGongfaCost);
    setPromoteFee(p.nextPromoteFee);
    setRankNeed(p.rankLevelNeed);
    setVisitLeft(p.visitsLeft);
    setZabanli(p.zabanli);
    setSpeedBonus(p.speedBonus ?? 0);
    setDailyTargets(p.dailyTargets);
    setTitles(p.titles ?? []);
    setRealmInfo(p.realmInfo ?? null);
    setXianji(p.xianji);
    setXinshi(p.xinshi);
    setFork(p.fork);
    setTongtou(p.tongtou);
    setWallNotice(p.wallNotice);
    syncAtRef.current = Date.now();
  }, []);

  const refresh = useCallback(async () => {
    const r = await api.gameState();
    applyPayload(r);
    if (r.offlineReport) setReport(r.offlineReport);
    // M6：榜单随轮询顺带刷新；凌霄阶 tab 拉层数榜（切 tab 会重建轮询立即拉取）
    api.leaderboard(boardTab === 'floors' ? 'floors' : undefined).then(setBoard).catch(() => {});
  }, [applyPayload, boardTab]);

  useEffect(() => {
    api.me().then(setMe).catch(onLogout);
    api.gameConfig().then(setConfig).catch(() => {});
    api
      .departments()
      .then((r) => setDeptList(r.departments))
      .catch(() => {});
    refresh().catch(onLogout);
    // 轮询即在线心跳：服务端对最近交互 30 秒内的时段给全额产出
    const poll = setInterval(() => refresh().catch(() => {}), 10000);
    const tick = setInterval(() => force((x) => x + 1), 250);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [onLogout, refresh]);

  // 客户端插值仅用于心力条的展示平滑，权威数值以服务端为准；
  // M5.5：薪酬逐秒直接入账，不再有待收菜篮
  const rate = srvRate || config?.salaryPerMin || 0; // 服务端速率含职级/功法加成
  let xinli = state?.xinli ?? 0;
  let burnout = state?.burnout ?? false;
  if (state && config) {
    const mins = Math.max(0, Date.now() - syncAtRef.current) / 60000;
    if (!burnout) {
      const drain = config.xinliDrainPerMin * mins;
      if (xinli > drain) {
        xinli -= drain;
      } else {
        xinli = 0;
        burnout = true;
      }
    } else {
      // 倦怠期自动回血（GDD_v2 §8 呼吸节律）
      xinli = Math.min(config.xinliMax, xinli + config.burnoutRecoverPerMin * mins);
      if (xinli >= config.xinliMax) burnout = false;
    }
  }

  const ratePerMin = rate * (burnout && config ? config.burnoutProdMult : 1);

  function spawnFloat(text: string) {
    const id = Date.now() + Math.random();
    setFloats((f) => [...f, { id, text }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1300);
  }

  async function promote() {
    if (busyRef.current) return;
    busyRef.current = true;
    setToast('');
    try {
      const r = await api.promote();
      applyPayload(r);
      spawnFloat('升迁之喜');
      playSfx('reward');
    } catch (e) {
      setToast(e instanceof Error ? e.message : '打点未成');
    } finally {
      busyRef.current = false;
    }
  }

  // M5.7 串门子：拜访他房听轶事，每日限次，佐料不碰产出
  async function visit(deptId: string, deptName: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setToast('');
    try {
      const r = await api.visit(deptId);
      applyPayload(r);
      setVisitNote({ deptName, event: r.visit, gift: r.gift, loss: r.loss });
    } catch (e) {
      setToast(e instanceof Error ? e.message : '串门未成');
    } finally {
      busyRef.current = false;
    }
  }

  // M6.1：功法双槽各自封顶（读 config 下发的上限），满级研习按钮置灰
  const gongfaMaxed = (lvl: number) => config != null && lvl >= config.gongfaMax;
  // M6.1：同僚名册配名（串门弹窗显示 NPC 名）
  const npcNameOf = (npcId: string | null) =>
    npcId ? config?.npcNames.find((n) => n.id === npcId)?.name ?? null : null;

  async function upgradeGongfa() {
    if (busyRef.current) return;
    busyRef.current = true;
    setToast('');
    try {
      const r = await api.upgrade();
      applyPayload(r);
      spawnFloat('心法精进');
    } catch (e) {
      setToast(e instanceof Error ? e.message : '研习未成');
    } finally {
      busyRef.current = false;
    }
  }

  // M6 称号佩戴：仅换徽章展示，属性仍全部持有生效
  async function wearTitle(id: string | null) {
    if (busyRef.current) return;
    busyRef.current = true;
    setToast('');
    try {
      const r = await api.wearTitle(id);
      applyPayload(r);
      // null = 回退最新获得的一枚
      const latest = state?.titles?.length ? state.titles[state.titles.length - 1] : null;
      const shownId = id ?? latest;
      const shownName = shownId
        ? (config?.allTitles ?? config?.questTitles ?? []).find((t) => t.id === shownId)?.name ?? null
        : null;
      setCard((c) => (c ? { ...c, title: shownName } : c));
      api.leaderboard(boardTab === 'floors' ? 'floors' : undefined).then(setBoard).catch(() => {});
    } catch (e) {
      setToast(e instanceof Error ? e.message : '佩戴未成');
    } finally {
      busyRef.current = false;
    }
  }

  async function upgradeDeptGongfa() {
    if (busyRef.current) return;
    busyRef.current = true;
    setToast('');
    try {
      const r = await api.upgradeDept();
      applyPayload(r);
      spawnFloat('本门精进');
    } catch (e) {
      setToast(e instanceof Error ? e.message : '研习未成');
    } finally {
      busyRef.current = false;
    }
  }

  // ---------- M4 动作 ----------

  async function selectQuest(tier: number) {
    if (busyRef.current) return;
    busyRef.current = true;
    setToast('');
    try {
      const r = await api.questSelect(tier);
      applyPayload(r);
      spawnFloat('接下差事 · 已锁档');
    } catch (e) {
      setToast(e instanceof Error ? e.message : '差事接不下');
    } finally {
      busyRef.current = false;
    }
  }

  // M5.5：解除锁档，恢复自动挂最高档
  async function unlockQuest() {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const r = await api.questAuto();
      applyPayload(r);
      spawnFloat('恢复自动办差');
    } catch {
      /* 无妨 */
    } finally {
      busyRef.current = false;
    }
  }

  // 成长消费全手动（用户决议 2026-08-14）：自动开关已下线

  async function forge(slot: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setToast('');
    try {
      const r = await api.forge(slot);
      applyPayload(r);
      spawnFloat(`锻成「${r.item.name}」`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : '锻造未成');
    } finally {
      busyRef.current = false;
    }
  }

  async function enhance(slot: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setToast('');
    try {
      const r = await api.enhance(slot);
      applyPayload(r);
      spawnFloat(r.success ? '强化成功' : '强化失手，只掉一级');
    } catch (e) {
      setToast(e instanceof Error ? e.message : '强化未成');
    } finally {
      busyRef.current = false;
    }
  }

  async function claimDaily() {
    if (busyRef.current) return;
    busyRef.current = true;
    setToast('');
    try {
      const r = await api.claimDaily();
      applyPayload(r);
      spawnFloat(`领赏 +${fmt(r.reward.salary)} 薪酬 +${fmt(r.reward.contribution)} 贡献`);
      playSfx('reward');
    } catch (e) {
      setToast(e instanceof Error ? e.message : '领赏未成');
    } finally {
      busyRef.current = false;
    }
  }

  // ---------- M6.5 外差动作：一键结算，失败零惩罚，不点不亏 ----------

  // 掉落短文案：入背包报名字，满员折卖报一声
  function dropText(drop: { sold: boolean; item?: { name: string }; value?: number } | null | undefined): string {
    if (!drop) return '';
    return drop.sold
      ? `，法器径直当了 ${fmt(drop.value ?? 0)} 贡献`
      : `，得法器「${drop.item?.name ?? ''}」入背包`;
  }

  async function patrol() {
    if (busyRef.current) return;
    busyRef.current = true;
    setToast('');
    try {
      const r = await api.realmPatrol();
      applyPayload(r);
      setRealmNote(
        `例巡一圈归来：贡献 +${fmt(r.patrol.contrib)}，薪酬 +${fmt(r.patrol.salary)}${dropText(r.patrol.drop)}`,
      );
    } catch (e) {
      setToast(e instanceof Error ? e.message : '例巡未成');
    } finally {
      busyRef.current = false;
    }
  }

  async function nightWatch() {
    if (busyRef.current) return;
    busyRef.current = true;
    setToast('');
    try {
      const r = await api.realmNight();
      applyPayload(r);
      const n = r.night;
      setRealmNote(
        n.win
          ? `夜值破局（词缀「${n.affix.name}」）：贡献 +${fmt(n.contrib ?? 0)}${dropText(n.drop)}`
          : `悬案棘手（词缀「${n.affix.name}」，需办差力 ${fmt(n.need)}），今夜未能破局——无伤大雅。`,
      );
    } catch (e) {
      setToast(e instanceof Error ? e.message : '夜值未成');
    } finally {
      busyRef.current = false;
    }
  }

  // M7.6 凌霄阶登阶：带 count 限量登（登一层/连闯十层，文案进登阶志），
  // 不带 count 一键冲阵，结果开成战报卷轴
  async function climbLadder(count?: number) {
    if (busyRef.current) return;
    busyRef.current = true;
    setToast('');
    try {
      const r = await api.ladderClimb(count);
      applyPayload(r);
      const c = r.climb;
      if (count) {
        setLadderLog((log) => [...(c.lines ?? []).slice().reverse(), ...log].slice(0, 5));
        setRealmNote(`登至第 ${fmt(c.cleared)} 层，贡献 +${fmt(c.contrib)}`);
      } else {
        setBattleReport(c);
        playSfx('open');
        setRealmNote(`凌霄阶连闯 ${fmt(c.climbed)} 层，至第 ${fmt(c.cleared)} 层，贡献 +${fmt(c.contrib)}`);
      }
      spawnFloat('登阶之喜');
    } catch (e) {
      setToast(e instanceof Error ? e.message : '冲阵未成');
    } finally {
      busyRef.current = false;
    }
  }

  async function sweepLadder() {
    if (busyRef.current) return;
    busyRef.current = true;
    setToast('');
    try {
      const r = await api.ladderSweep();
      applyPayload(r);
      setRealmNote(`凌霄阶旧路重扫一遍：贡献 +${fmt(r.sweep.bonus)}`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : '扫荡未成');
    } finally {
      busyRef.current = false;
    }
  }

  // M7.5 监正争夺战：与候选对局一场，办差力判定；败零惩罚可再战，全胜开留白结局
  async function fightJianzhengCandidate(candidateId: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setToast('');
    try {
      const r = await api.jianzhengFight(candidateId);
      applyPayload(r);
      setJianzhengNote(r.fight.text);
      if (r.fight.win) {
        spawnFloat('争锋之喜');
        playSfx('reward');
      }
      if (r.fight.finale) setJianzhengFinale(r.fight.finale);
    } catch (e) {
      setToast(e instanceof Error ? e.message : '对局未成');
    } finally {
      busyRef.current = false;
    }
  }

  async function equipBag(idx: number) {
    if (busyRef.current) return;
    busyRef.current = true;
    setToast('');
    try {
      const r = await api.bagEquip(idx);
      applyPayload(r);
      spawnFloat(`换上「${r.equipped.name}」`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : '装备未成');
    } finally {
      busyRef.current = false;
    }
  }

  async function sellBag(idx: number) {
    if (busyRef.current) return;
    busyRef.current = true;
    setToast('');
    try {
      const r = await api.bagSell(idx);
      applyPayload(r);
      spawnFloat(`当了 +${fmt(r.soldValue)} 贡献`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : '折卖未成');
    } finally {
      busyRef.current = false;
    }
  }

  // ---------- M6.8 邸报 ----------

  // 邸报五色：日常灰 / 奖励绿 / 惩罚黄 / 特殊待办金 / 里程碑青（GDD_v2 §13.3）
  function evClass(type: string): string {
    if (type === 'gift' || type === 'reward') return 'ev-green';
    if (type === 'loss') return 'ev-yellow';
    if (type === 'special') return 'ev-gold';
    if (type === 'milestone' || type === 'realm') return 'ev-cyan';
    return 'ev-gray';
  }
  function fmtEvTime(ts: number): string {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  // 展开邸报：推平未读水位（不点不亏，红点只是提示）
  async function toggleDibao() {
    const open = !dibaoOpen;
    setDibaoOpen(open);
    if (open) {
      try {
        const r = await api.eventsAck();
        applyPayload(r);
      } catch {
        /* 已读回执失败无碍，下次再平 */
      }
    }
  }

  // ---------- M5 动作 ----------

  // 撞墙告示读完回执（弹窗关闭时）
  async function ackWall() {
    try {
      const r = await api.wallAck();
      applyPayload(r);
    } catch {
      /* 回执失败无妨，下次轮询再弹 */
    }
  }

  // 岔路抉择：stay 觉醒留任；leave = 辞官转生（M7 转正，服务端直接走 rebirth）
  async function chooseFork(choice: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const r = await api.forkChoose(choice);
      applyPayload(r);
    } catch (e) {
      setToast(e instanceof Error ? e.message : '岔路难行');
    } finally {
      busyRef.current = false;
    }
  }

  // M7 留任转生（交接文书确认）：服务端守卫 chose_stay，铸神器后全量重置
  async function doRebirth() {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const r = await api.rebirth();
      applyPayload(r);
      setRebirthOpen(false);
      setToast(`交接已办妥——${r.rebirth.heirloom.name} 入手，${r.rebirth.loop}周目开门。`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : '交接文书没递成');
    } finally {
      busyRef.current = false;
    }
  }

  // M7 传家槽换戴/卸下（id=null 卸下）：
  // 不走 busyRef 防重——接口幂等，绝不静默吞点击；成败都给话，绝不无声无息
  async function wearHeirloomItem(id: string | null) {
    setToast('');
    try {
      const r = await api.heirloomWear(id);
      applyPayload(r);
      if (id === null) {
        setToast('神器已收回传家库——点收藏随时再戴，分文不花。');
      } else {
        const name = state?.heirlooms.find((h) => h.id === id)?.name ?? '神器';
        setToast(`「${name}」已戴上——想换随时换，戴错不亏。`);
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : '神器戴不上');
    }
  }

  // 翻阅旧账册（只拉已收残页）
  async function openLedger() {
    try {
      const r = await api.ledger();
      setLedgerPages(r.pages);
    } catch {
      /* 翻不动就算了 */
    }
  }

  async function logout() {
    try {
      await api.logout();
    } finally {
      setToken(null);
      onLogout();
    }
  }

  if (!state || !config) {
    return (
      <div className="panel">
        <p className="subtitle">衙门开门中…</p>
      </div>
    );
  }

  // M3：尚未选任部门，先过选任关（部门名册未加载完也先不渲染，避免闪现）
  if (!deptList.length) {
    return (
      <div className="panel">
        <p className="subtitle">取部门名册中…</p>
      </div>
    );
  }
  const dept = state.dept ? (deptList.find((d) => d.id === state.dept) ?? null) : null;
  if (!dept) {
    return <DeptSelectScreen loop={state.loop ?? 1} onChose={() => refresh().catch(() => {})} />;
  }

  const xinliPct = (xinli / config.xinliMax) * 100;

  return (
    <div className="game-dash">
      <header className="dash-head">
        <h1 className="title">腾云香局</h1>
        <p className="subtitle">
          {dept.name}
          {me ? <span className="badge">{me.username}</span> : null}
        </p>
        {/* M5：心事只有模糊文案，不暴露幻灭数值 */}
        <div className="head-chips">
          <span className="chip rank" title="当前官职（晋升在左侧宦途）">
            官职 · {config.ranks[state.rank]?.name ?? '杂役'} Lv{state.rankLvl ?? 1}
          </span>
          {xinshi ? (
            <span className="chip xinshi" title="说不清的心事">
              ☁ {xinshi}
            </span>
          ) : null}
          {fork === 'chose_stay' ? (
            <span className="chip tongtou" title="画饼听多了，反而通透">
              通透 {tongtou}
            </span>
          ) : null}
          {(state.loop ?? 1) > 1 ? (
            <span
              className="chip loop-chip"
              title="转生周目与资历：每转经验 +10%，5 层封顶，产出不受影响"
            >
              {state.loop}周目 · 资历 {state.seniority ?? 0}
            </span>
          ) : null}
          {fork === 'chose_stay' ? (
            <button
              className="chip rebirth-btn"
              title="办了交接，重新走进衙门：铸一件传家神器，职级资源清零，账册称号保留"
              onClick={() => setRebirthOpen(true)}
            >
              交接文书
            </button>
          ) : null}
          {titles.length > 0 ? (
            <span
              className="chip tongtou"
              title={titles
                .map((t) => (t.words ? `${t.name}（${t.words}）` : t.name))
                .join('、')}
            >
              称号 · {titles.length}
            </span>
          ) : null}
          {state.ledger > 0 ? (
            <button className="chip ledger-btn" onClick={openLedger}>
              旧账册 · {state.ledger} 页
            </button>
          ) : null}
        </div>
        <button className="link-btn" onClick={logout}>
          辞官暂退
        </button>
      </header>

      {/* ---------- M6.8 衙门邸报：单行播报条 + 展开浮层（不占三栏宽度） ---------- */}
      {state ? (
        <div className={`dibao-wrap${dibaoOpen ? ' open' : ''}`}>
          {(() => {
            const evs = state.events ?? [];
            const unread = evs.filter((e) => e.ts > (state.evReadTs ?? 0)).length;
            const latest = evs[0];
            return (
              <button className="dibao-bar" onClick={toggleDibao} title="点开衙门邸报">
                <span className="dibao-label">邸报</span>
                {unread > 0 ? <span className="dibao-dot" /> : null}
                <span className={`dibao-text ${latest ? evClass(latest.type) : 'ev-gray'}`}>
                  {latest ? latest.text : '衙门今日风平浪静，无甚可报。'}
                </span>
                <span className="dibao-more">{dibaoOpen ? '收起 ▴' : `全录 ${evs.length} 条 ▾`}</span>
              </button>
            );
          })()}
          {dibaoOpen ? (
            <div className="dibao-panel">
              {(state.events ?? []).length === 0 ? (
                <div className="dibao-empty">邸报尚无一纸。挂着挂着，衙门总有动静。</div>
              ) : (
                (state.events ?? []).map((e) => (
                  <div key={`${e.ts}-${e.type}`} className={`dibao-row ${evClass(e.type)}`}>
                    <span className="dibao-time">{fmtEvTime(e.ts)}</span>
                    <span className="dibao-item-text">{e.text}</span>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* 左栏：身家与宦途 */}
      <section className="dash-col col-left">
      <div className="g-res">
        <div className="g-res-main">
          <span className="g-res-label">薪酬 · 灵石</span>
          <span className="g-res-num">{fmt(state.bank)}</span>
        </div>
        <div className="g-res-side">
          <div className="stat">
            <span>贡献</span>
            <span className="v">{fmt(state.contribution)}</span>
          </div>
          <div className="stat">
            <span>办差力</span>
            <span className="v">{zabanli}</span>
          </div>
          <div className="stat">
            <span>薪酬速率</span>
            <span className="v">{ratePerMin.toFixed(1)}/分</span>
          </div>
        </div>
      </div>

      <div className="g-xinli">
        <div className="g-xinli-top">
          <span>心力 {Math.floor(xinli)}/{config.xinliMax}</span>
          {burnout ? (
            <span className="tag-burnout">职业倦怠 · 产出×{config.burnoutProdMult}</span>
          ) : null}
        </div>
        <div className="bar">
          <div
            className={`bar-fill ${burnout ? 'burn' : ''}`}
            style={{ width: `${xinliPct}%` }}
          />
        </div>
      </div>

      {/* ---------- M5 仙籍遴选：表面目标 ---------- */}
      {xianji ? (
        <div className="g-block g-xianji">
          <div className="g-growth-title">
            仙籍遴选{fork === 'chose_stay' ? ' · 饼已凉' : ''}
          </div>
          {xianji.frozen ? (
            <p className="dim-tip">遴选无限期冻结。榜文还贴着，没人再看。</p>
          ) : (
            <>
              <div className="stat">
                <span>资历 · 考成 · 好感</span>
                <span className="v">
                  {xianji.progress} / {xianji.threshold}
                </span>
              </div>
              <div className="bar">
                <div
                  className="bar-fill gold"
                  style={{
                    width: `${Math.min(100, (xianji.progress / (xianji.threshold ?? 1)) * 100)}%`,
                  }}
                />
              </div>
              <p className="dim-tip">
                {fork === 'chose_stay'
                  ? '你看着这条进度条，笑而不语。'
                  : '上官说了：好好干，下次遴选优先推荐你。'}
              </p>
            </>
          )}
        </div>
      ) : null}

      <div className="g-growth">
        <div className="g-growth-title">成长进度</div>
        <div className="stat grow-row">
          {(() => {
            // M5.6：职内等级与经验。职内升级吃经验，Lv10 跨职才吃打点费
            const lvl = state.rankLvl ?? 1;
            const cur = config.ranks[state.rank]?.mult ?? 1;
            const nxt = config.ranks[state.rank + 1]?.mult ?? cur;
            const rankMult = cur + ((nxt - cur) * (lvl - 1)) / 9;
            const isTop = state.rank >= config.ranks.length - 1 && lvl >= 10;
            const fee = promoteFee ?? config.ranks[state.rank + 1]?.fee ?? 0;
            const canPromote = lvl < 10 ? state.rankExp >= (rankNeed ?? Infinity) : state.bank >= fee;
            return (
              <>
                <span className="grow-name">
                  宦途 · {config.ranks[state.rank].name} Lv{lvl}（产出×{rankMult.toFixed(2)}）
                </span>
                <span className="grow-have" title="宦途经验：挂机即得（在线每分钟 +1、离线六折），办结差事另加耗时两成；晋升与打点会消耗它">
                  拥有 · 灵石 {fmt(state.bank)} · 宦途经验 {fmt(Math.floor(state.rankExp))}
                </span>
                {isTop ? (
                  <span className="cap-note">编外顶格——再熜也没有编制</span>
                ) : (
                  <>
                    <span
                      className="v grow-cost"
                      title="宦途经验挂机自动涨，攒满点“晋升”升 1 级；Lv10 跨职才花灵石打点"
                    >
                      {lvl < 10
                        ? `宦途经验 ${fmt(Math.floor(state.rankExp))}/${fmt(rankNeed ?? 0)}`
                        : `打点：灵石 ${fmt(fee)}`}
                    </span>
                    <button className="grow-btn" onClick={promote} disabled={!canPromote}>
                      {lvl < 10 ? '晋升' : '打点晋升'}
                    </button>
                    {lvl < 10 && rankNeed ? (
                      <div className="bar rank-bar">
                        <div
                          className="bar-fill"
                          style={{ width: `${Math.min(100, (state.rankExp / rankNeed) * 100)}%` }}
                        />
                      </div>
                    ) : null}
                  </>
                )}
              </>
            );
          })()}
        </div>
        <div className="stat grow-row">
          <span className="grow-name">
            《摸鱼心法》Lv.{state.gongfaLvl} · 产出+
            {Math.round(config.gongfaBonusPerLvl * state.gongfaLvl * 100)}%
          </span>
          <span className="v grow-cost">研习费：灵石 {fmt(gCost)}</span>
          <button
            className="grow-btn"
            onClick={upgradeGongfa}
            disabled={gongfaMaxed(state.gongfaLvl) || state.bank < gCost}
          >
            {gongfaMaxed(state.gongfaLvl) ? '已臻化境' : '研习'}
          </button>
        </div>
        <div className="stat grow-row">
          <span className="grow-name">
            《{dept.gongfa.name}》Lv.{state.deptGongfaLvl} · {dept.gongfa.effect}
          </span>
          <span className="v grow-cost">研习费：灵石 {fmt(dgCost)}</span>
          <button
            className="grow-btn"
            onClick={upgradeDeptGongfa}
            disabled={gongfaMaxed(state.deptGongfaLvl) || state.bank < dgCost}
          >
            {gongfaMaxed(state.deptGongfaLvl) ? '已臻化境' : '研习'}
          </button>
        </div>
      </div>

      {/* ---------- M5.7 串门子：拜访他房听轶事，每日限次，不串不亏 ---------- */}
      <div className="g-block g-visits">
        <div className="g-growth-title">串门子 · 今日余 {visitLeft} 次</div>
        <div className="visit-grid">
          {deptList
            .filter((d) => d.id !== state.dept)
            .map((d) => (
              <button
                key={d.id}
                className="visit-card"
                disabled={visitLeft <= 0}
                title={`去${d.name}串个门`}
                onClick={() => visit(d.id, d.name)}
              >
                <span className="visit-name">{d.name}</span>
                <span className="visit-role">{d.role}</span>
              </button>
            ))}
        </div>
        <p className="dim-tip">
          {visitLeft > 0
            ? '去别房走走，听段轶闻——半数有回礼，半数破点小财，不串不亏。'
            : '今日脚力用完了，明日请早。不串不亏。'}
        </p>
      </div>
      </section>

      {/* 中栏：工位与案牍山 */}
      <section className="dash-col col-mid">
      <div className="g-station">
        <div className="g-rate">
          当前产出 {ratePerMin.toFixed(1)} 灵石/分
          {burnout ? '（职业倦怠，心力自动恢复中）' : ''}
        </div>
        <div className="g-pool-wrap">
          <span className="g-pool-label">薪酬逐秒自动入账，无需收取</span>
          <div className="floats">
            {floats.map((f) => (
              <span key={f.id} className="float-text">
                {f.text}
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* ---------- M6.8 衙门事务告示：M7.5 起金标告示可点入（监正争夺战） ---------- */}
      <div
        className={`g-block g-notice${state?.pendingSpecial ? ' special clickable' : ''}`}
        onClick={() => {
          if (state?.pendingSpecial && state?.jianzheng && !state.jianzheng.done) {
            setJianzhengNote('');
            setJianzhengFinale(null);
            setJianzhengOpen(true);
            playSfx('open');
          }
        }}
      >
        <span className="g-notice-label">衙门事务告示</span>
        <span className="g-notice-text">
          {state?.pendingSpecial ?? '衙门今日风平浪静，无甚可报。'}
          {state?.pendingSpecial && state?.jianzheng && !state.jianzheng.done ? '（点入应议）' : ''}
        </span>
      </div>
      <p className="error">{toast}</p>

      {/* ---------- M4 案牍山·差事告示板（B 方案重做：语义显性化，引擎不动） ---------- */}
      <div className="g-block g-quest">
        <div className="g-growth-title">
          案牍山 · 已通 {Math.max(0, state.questBest + 1)} 档 · 累计办结 {state.questCount} 件
        </div>
        {(() => {
          const q = config.quests[state.questTier];
          const remain = Math.max(0, q.mins - state.questProgress);
          const eta = remain / (1 + speedBonus);
          return (
            <div className="quest-now">
              <div className="quest-now-head">
                <span className="quest-now-name">「{q.name}」</span>
                <span className={`quest-badge ${state.questLocked !== null ? 'locked' : ''}`}>
                  {state.questLocked !== null ? '已锁档' : '自动挂办中'}
                </span>
              </div>
              <div className="quest-now-pay">
                办结一次得：薪酬 <b>{fmt(q.salary)}</b>｜贡献 <b>{fmt(q.contrib)}</b>
                {speedBonus > 0 ? <span className="quest-ease"> · 办得利索 +{Math.round(speedBonus * 100)}%</span> : null}
              </div>
              <div className="bar quest-bar">
                <div
                  className="bar-fill"
                  style={{ width: `${Math.min(100, (state.questProgress / q.mins) * 100)}%` }}
                />
              </div>
              <div className="quest-now-eta">
                {remain <= 0 ? '即将办结' : `还差约 ${eta >= 10 ? Math.round(eta) : eta.toFixed(1)} 分钟办结`}
              </div>
            </div>
          );
        })()}
        <div className="quest-board-title">差事榜 · 点哪挂哪（挂上即锁档，不再自动升）</div>
        <div className="quest-board">
          {config.quests.map((qq, i) => {
            const cur = i === state.questTier;
            const can = zabanli >= qq.req;
            return (
              <button
                key={qq.name}
                className={`qrow ${cur ? 'cur' : ''}`}
                disabled={!can}
                onClick={() => selectQuest(i)}
              >
                <span className="qrow-name">{qq.name}</span>
                <span className="qrow-meta">需办差力 {qq.req} · 约 {qq.mins} 分</span>
                <span className="qrow-pay">薪酬 {fmt(qq.salary)} / 贡献 {fmt(qq.contrib)}</span>
                <span className={`qrow-status ${cur ? 'cur' : can ? 'can' : 'no'}`}>
                  {cur ? '正在挂办' : can ? '可挂办' : `差 ${qq.req - zabanli} 办差力`}
                </span>
              </button>
            );
          })}
        </div>
        <div className="quest-lock-row">
          {state.questLocked !== null ? (
            <>
              <span className="dim-tip">已锁档：办结后停在此档。想回去自动，点右边。</span>
              <button className="grow-btn" onClick={unlockQuest}>
                恢复自动挂办
              </button>
            </>
          ) : (
            <span className="dim-tip">不点任何档 = 自动挂办差力够得着的最高档，办结自动换下一档，不点不亏。</span>
          )}
        </div>
      </div>
      </section>

      {/* 右栏：外差、机巧阁与案牍牌 */}
      <section className="dash-col col-right">
      {/* ---------- M6.5 外差：例巡 / 夜值悬案 / 凌霄阶（一键结算，不点不亏） ---------- */}
      <div className="g-block g-realm">
        <div className="g-growth-title">外差 · 秘境与凌霄阶</div>
        <div className="realm-tabs">
          <button
            className={`realm-tab ${realmTab === 'patrol' ? 'on' : ''}`}
            onClick={() => setRealmTab('patrol')}
          >
            例巡
          </button>
          <button
            className={`realm-tab ${realmTab === 'night' ? 'on' : ''}`}
            onClick={() => setRealmTab('night')}
          >
            夜值悬案
          </button>
          <button
            className={`realm-tab ${realmTab === 'ladder' ? 'on' : ''}`}
            onClick={() => setRealmTab('ladder')}
          >
            凌霄阶
          </button>
        </div>
        {realmTab === 'patrol' ? (
          <div className="realm-body">
            <div className="stat">
              <span>今日余次</span>
              <span className="v">
                {realmInfo?.patrolLeft ?? 0} / {config.realmPerDay}
              </span>
            </div>
            <button
              className="grow-btn realm-btn"
              onClick={patrol}
              disabled={(realmInfo?.patrolLeft ?? 0) <= 0}
            >
              一键例巡
            </button>
            <p className="dim-tip">必成功：贡献 + 薪酬，12% 几率拾法器。不巡不亏。</p>
          </div>
        ) : null}
        {realmTab === 'night' ? (
          <div className="realm-body">
            <div className="stat">
              <span>今日余次</span>
              <span className="v">
                {realmInfo?.nightLeft ?? 0} / {config.realmPerDay}
              </span>
            </div>
            {realmInfo?.affix ? (
              <p className="realm-affix" title={realmInfo.affix.text}>
                今日词缀 ·「{realmInfo.affix.name}」
              </p>
            ) : null}
            <div className="stat">
              <span>
                破局门槛{realmInfo?.nightNeed != null ? `（办差力 ${zabanli}/${realmInfo.nightNeed}）` : ''}
              </span>
              <span className="v">
                累计破局 {realmInfo?.solvedTotal ?? 0}/30
              </span>
            </div>
            <button
              className="grow-btn realm-btn"
              onClick={nightWatch}
              disabled={(realmInfo?.nightLeft ?? 0) <= 0}
            >
              一键值夜
            </button>
            <p className="dim-tip">达标破局，三倍例巡之赏；失手零惩罚——不倒扣，只记一笔。</p>
          </div>
        ) : null}
        {realmTab === 'ladder' ? (
          <div className="realm-body">
            <div className="stat">
              <span>
                已通 {fmt(realmInfo?.ladderCleared ?? 0)}/{fmt(realmInfo?.ladderTotal ?? 0)} 层
              </span>
              <span className="v">
                {realmInfo?.ladderNextNeed != null
                  ? `下一层需 ${fmt(realmInfo.ladderNextNeed)}（办差力 ${zabanli}）`
                  : '千层已尽收'}
              </span>
            </div>
            {ladderLog.length > 0 ? (
              <div className="ladder-log">
                <div className="ladder-log-title">登阶志</div>
                {ladderLog.map((l) => (
                  <p key={`${l.floor}-${l.text}`} className="ladder-log-line">
                    <b>第 {l.floor} 层</b>
                    {l.text}
                  </p>
                ))}
              </div>
            ) : null}
            <div className="realm-btns">
              <button
                className="grow-btn"
                onClick={() => climbLadder(1)}
                disabled={realmInfo?.ladderNextNeed == null || zabanli < realmInfo.ladderNextNeed}
              >
                登一层
              </button>
              <button
                className="grow-btn"
                onClick={() => climbLadder(10)}
                disabled={realmInfo?.ladderNextNeed == null || zabanli < realmInfo.ladderNextNeed}
              >
                连闯十层
              </button>
              <button
                className="grow-btn"
                onClick={() => climbLadder()}
                disabled={realmInfo?.ladderNextNeed == null || zabanli < realmInfo.ladderNextNeed}
              >
                一键冲阵
              </button>
              <button
                className="grow-btn"
                onClick={sweepLadder}
                disabled={realmInfo?.ladderSwept || (realmInfo?.ladderCleared ?? 0) <= 0}
              >
                {realmInfo?.ladderSwept ? '今日已扫' : '每日扫荡'}
              </button>
            </div>
            <p className="dim-tip">
              登一层看一层景；冲阵直闯到办差力不济，战报里见关键层。逐层首办贡献，100/500/1000
              层各授称号，不登不亏。
            </p>
          </div>
        ) : null}
        {realmNote ? <p className="realm-note">{realmNote}</p> : null}
      </div>

      {/* ---------- M4 机巧阁·法器（M5.5：吃贡献，10 锻保底，强化 +20） ---------- */}
      <div className="g-block g-gear">
        <div className="g-growth-title">
          机巧阁 · 法器 · 锻造一次 {config.forgeCost.contribution} 贡献
          {state.forgePity > 0 ? ` · 保底 ${state.forgePity}/10` : ''}
        </div>
        <div className="gear-grid">
          {config.gearSlots.map((s) => {
            const item = state.gear[s.id];
            const rarity = item ? config.rarities[item.rarity - 1] : null;
            const eCost = item && item.lvl < config.maxEnhance
              ? Math.floor(12 * Math.pow(item.lvl, 1.6))
              : null;
            return (
              <div key={s.id} className="gear-cell">
                <div className="gear-slot-name">{s.name}</div>
                {item && rarity ? (
                  <>
                    <div className={`gear-name r${item.rarity}`}>{item.name}</div>
                    <div className="gear-meta">
                      办差力 {rarity.base + (item.lvl - 1)} · 强化 +{item.lvl - 1}
                      {item.lvl >= config.maxEnhance ? '（顶格）' : ''}
                      {item.temper ? ` · 淬炼 ${item.temper} 层` : ''}
                    </div>
                  </>
                ) : (
                  <div className="gear-empty">{s.desc} · 虚位以待</div>
                )}
                <div className="gear-btns">
                  <button
                    className="grow-btn"
                    onClick={() => forge(s.id)}
                    disabled={state.contribution < config.forgeCost.contribution}
                  >
                    {item ? '重铸' : '锻造'}
                  </button>
                  {item && eCost !== null ? (
                    <button
                      className="grow-btn"
                      onClick={() => enhance(s.id)}
                      disabled={state.contribution < eCost}
                      title={`强化需 ${eCost} 贡献，办差力 +1；失败只掉一级`}
                    >
                      强化
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* ---------- M6.5 背包：秘境掉落暂存，选装自由，挂着不点不亏 ---------- */}
        <div className="bag-head">
          <span className="bag-title">背包 · {state.bag.length}/12 件</span>
          <span className="dim-tip">满员新掉落径直当了 40 贡献</span>
        </div>
        {state.bag.length === 0 ? (
          <p className="dim-tip">背包尚空——例巡与夜值会拾到法器。</p>
        ) : (
          <>
            <div className="bag-rows">
              {state.bag.map((it, i) => {
                const rar = config.rarities[it.rarity - 1];
                const power = rar.base + (it.lvl - 1);
                const worn = state.gear[it.slot];
                const wornPower = worn
                  ? config.rarities[worn.rarity - 1].base + (worn.lvl - 1)
                  : 0;
                return (
                  <div key={`${it.name}-${i}`} className="bag-row">
                    <span className={`bag-name r${it.rarity}`} title={`${it.name} · ${config.gearSlots.find((s) => s.id === it.slot)?.name ?? ''}`}>
                      {it.name}
                      {power > wornPower ? <i className="bag-better">↑强于在装</i> : null}
                    </span>
                    <span className="bag-power">{power}</span>
                    <button className="grow-btn" onClick={() => equipBag(i)}>
                      装备
                    </button>
                    <button className="grow-btn" onClick={() => sellBag(i)} title="折卖：底值一半 + 强化等级">
                      折卖
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="dim-tip">装备入对应槽，槽内旧件回背包；折卖换贡献。</p>
          </>
        )}
      </div>

      {/* ---------- M7 传家槽：每转铸一件神器，单装生效，收藏可换戴（seniority>0 才显形） ---------- */}
      {(state.seniority ?? 0) > 0 ? (
        <div className="g-block g-heirloom">
          <div className="g-growth-title">传家槽 · 神器收藏 {state.heirlooms.length} 件</div>
          {(() => {
            const worn = state.heirlooms.find((h) => h.id === state.heirloomWorn) ?? null;
            return (
              <div className="heirloom-worn">
                {worn ? (
                  <>
                    <span className="heirloom-name">
                      {worn.name}
                      <i className="heirloom-trait">
                        {config.heirloomTraits[worn.trait]?.name ?? ''} +{worn.value}%
                      </i>
                    </span>
                    <span className="heirloom-desc">
                      {config.heirloomTraits[worn.trait]?.desc ?? ''}
                    </span>
                    <button className="grow-btn" onClick={() => wearHeirloomItem(null)}>
                      卸下
                    </button>
                  </>
                ) : (
                  <span className="dim-tip">槽位空置——点下方收藏戴上，不戴不亏。</span>
                )}
              </div>
            );
          })()}
          <div className="heirloom-rows">
            {state.heirlooms
              .filter((h) => h.id !== state.heirloomWorn)
              .map((h) => (
                <button
                  key={h.id}
                  className="heirloom-row"
                  title={`第 ${h.forgedLoop} 周目铸成 · ${config.heirloomTraits[h.trait]?.desc ?? ''} +${h.value}%`}
                  onClick={() => wearHeirloomItem(h.id)}
                >
                  <span className="heirloom-name">{h.name}</span>
                  <span className="heirloom-trait">
                    {config.heirloomTraits[h.trait]?.name ?? ''} +{h.value}%
                  </span>
                  <span className="heirloom-loop">{h.forgedLoop}周目铸</span>
                  <span className="heirloom-act">{state.heirloomWorn ? '换戴' : '戴上'}</span>
                </button>
              ))}
          </div>
          <p className="dim-tip">词条只挂产出与费用，不进办差力；一次只戴一件。戴/卸/换随时可改，反悔不花钱。</p>
        </div>
      ) : null}

      {/* ---------- M4 每日案牍牌（M5.5：自动里程碑，不点不亏） ---------- */}
      {state.daily && dailyTargets ? (
        <div className="g-block g-daily">
          <div className="g-growth-title">每日案牍牌 · 自动里程碑</div>
          <div className="stat">
            <span>
              办结 {Math.min(state.daily.quest, dailyTargets.quest)}/{dailyTargets.quest} · 贡献{' '}
              {fmt(Math.min(state.daily.contrib, dailyTargets.contrib))}/{fmt(dailyTargets.contrib)} · 当值{' '}
              {Math.floor(Math.min(state.daily.onlineMin, dailyTargets.onlineMin))}/{dailyTargets.onlineMin} 分
            </span>
            {state.daily.claimed ? (
              <span className="cap-note">今日赏已领，明日请早</span>
            ) : (
              <button
                className="grow-btn"
                onClick={claimDaily}
                disabled={
                  state.daily.quest < dailyTargets.quest ||
                  state.daily.contrib < dailyTargets.contrib ||
                  state.daily.onlineMin < dailyTargets.onlineMin
                }
              >
                一键领赏
              </button>
            )}
          </div>
          <p className="dim-tip">不点不亏：当日没领，跨天自动入账</p>
        </div>
      ) : null}

      {/* ---------- M6 衙门百官录：办差力 / 凌霄阶 双榜，NPC 填榜 ---------- */}
      <div className="g-block g-board">
        <div className="g-growth-title">
          衙门百官录
          <span className="lb-tabs">
            <button
              className={`lb-tab ${boardTab === 'z' ? 'on' : ''}`}
              onClick={() => setBoardTab('z')}
            >
              办差力
            </button>
            <button
              className={`lb-tab ${boardTab === 'floors' ? 'on' : ''}`}
              onClick={() => setBoardTab('floors')}
            >
              凌霄阶
            </button>
          </span>
        </div>
        <div className="lb-rows">
          {(board?.rows ?? []).map((row, i) => (
            <button
              key={row.id}
              className={`lb-row ${row.npc ? 'npc' : ''} ${
                me && !row.npc && row.name === me.username ? 'me' : ''
              }`}
              title="点开履历卡"
              onClick={() => setCard(row)}
            >
              <span className="lb-rank">{i + 1}</span>
              <span className="lb-name">
                {row.title ? <i className="lb-badge">{row.title}</i> : null}
                {row.name}
                <span className="lb-dept">
                  {deptList.find((d) => d.id === row.dept)?.name ?? ''}
                </span>
              </span>
              <span className="lb-post">
                {row.rankName}
                {row.npc ? '' : ` Lv${row.rankLvl}`}
              </span>
              <span className="lb-z">
                {boardTab === 'floors' ? `${row.floors} 层` : row.zabanli}
              </span>
            </button>
          ))}
        </div>
        {board?.me ? (
          board.me.rank === 1 ? (
            <p className="lb-me-top">{boardTab === 'floors' ? '凌霄绝顶' : '衙门第一'}</p>
          ) : (
            <div className="lb-me">
              <p className="lb-me-line">
                你 · 第 {board.me.rank} / {board.total} 名 ·{' '}
                {boardTab === 'floors' ? `第 ${board.me.floors} 层` : `办差力 ${board.me.zabanli}`}
              </p>
              {board.me.above ? (
                <>
                  <div className="lb-bar">
                    <div
                      className="lb-bar-fill"
                      style={{
                        width: `${Math.min(
                          100,
                          boardTab === 'floors'
                            ? board.me.above.floors > 0
                              ? (board.me.floors / board.me.above.floors) * 100
                              : 100
                            : (board.me.zabanli / board.me.above.zabanli) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="lb-me-gap">
                    {boardTab === 'floors'
                      ? `距 ${board.me.above.name} 还差 ${board.me.above.floors - board.me.floors} 层`
                      : `距 ${board.me.above.name} 还差 ${fmt(board.me.above.zabanli - board.me.zabanli)} 点`}
                  </p>
                </>
              ) : null}
            </div>
          )
        ) : null}
        <p className="dim-tip">
          {boardTab === 'floors'
            ? '层数论先后；同层者以办差力分座次。'
            : '办差力论高低；称号只是招牌，不占分量。'}
        </p>
      </div>
      </section>

      {report ? (
        <div className="modal-overlay" onClick={() => setReport(null)}>
          <div className="scroll-report" onClick={(e) => e.stopPropagation()}>
            <h2>昨夜衙门记事</h2>
            <p>
              你离开衙门共 <b>{fmtDur(report.awayMs)}</b>。
            </p>
            <p>
              期间薪酬自动入账 <b className="gold">{fmt(report.salary)}</b> 灵石
              {report.quests > 0 ? (
                <>，办结差事 <b>{report.quests}</b> 件，贡献入账 <b className="gold">{fmt(report.contribution)}</b></>
              ) : null}
              {(report.rankExp ?? 0) > 0 ? (
                <>，职级经验 <b className="gold">+{fmt(report.rankExp ?? 0)}</b></>
              ) : null}
              。
            </p>
            <p className="dim">
              离岗期间产出按 {Math.round(config.offlineRate * 100)}% 计算
              {report.capped ? '。再往前的账，吏房说查不到了。' : '。'}
            </p>
            <button className="btn" onClick={() => setReport(null)}>
              知道了
            </button>
          </div>
        </div>
      ) : null}

      {/* ---------- M7.6 凌霄阶冲阵战报：关键层文案 + 总贡献 ---------- */}
      {battleReport ? (
        <div className="modal-overlay" onClick={() => setBattleReport(null)}>
          <div className="scroll-report ladder-report" onClick={(e) => e.stopPropagation()}>
            <h2>战报 · 凌霄阶</h2>
            <p>
              一鼓作气，连闯 <b>{fmt(battleReport.climbed)}</b> 层——自第{' '}
              {fmt(battleReport.cleared - battleReport.climbed + 1)} 层，直上第{' '}
              <b>{fmt(battleReport.cleared)}</b> 层。
            </p>
            <div className="report-lines">
              {(battleReport.lines ?? []).map((l) => (
                <p key={l.floor}>
                  <b>第 {fmt(l.floor)} 层</b>　{l.text}
                </p>
              ))}
            </div>
            <p>
              共得贡献 <b className="gold">+{fmt(battleReport.contrib)}</b>。
            </p>
            <button
              className="btn"
              onClick={() => {
                setBattleReport(null);
                playSfx('close');
              }}
            >
              收卷
            </button>
          </div>
        </div>
      ) : null}

      {/* ---------- M7.5 监正争夺战：三场对局叙事战，败零惩罚可再战，全胜开留白结局 ---------- */}
      {jianzhengOpen && state.jianzheng ? (
        <div className="modal-overlay" onClick={() => setJianzhengOpen(false)}>
          <div className="scroll-report jianzheng-report" onClick={(e) => e.stopPropagation()}>
            <h2>监正争夺战</h2>
            <p className="jz-rule dim">
              监正之位空悬，堂上议定择能者试之。三场对局，以办差力定胜负；败不倒扣，随时再战；三场全胜，此案方结。
            </p>
            {config.jianzhengCandidates.map((c) => {
              const won = !!state.jianzheng?.wins?.[c.id];
              return (
                <div key={c.id} className="jz-row">
                  <div className="jz-head">
                    <span className="jz-name">
                      {c.name}
                      <span className="lb-dept">{deptList.find((d) => d.id === c.dept)?.name ?? ''}</span>
                    </span>
                    <span className="jz-z">办差力 {c.z}</span>
                    {won ? (
                      <i className="lb-badge">已胜</i>
                    ) : (
                      <button
                        className="btn"
                        disabled={busyRef.current || !!jianzhengFinale}
                        onClick={() => fightJianzhengCandidate(c.id)}
                      >
                        交锋
                      </button>
                    )}
                  </div>
                  <p className="jz-intro dim">{c.intro}</p>
                </div>
              );
            })}
            {jianzhengNote ? <p className="jz-note">{jianzhengNote}</p> : null}
            {jianzhengFinale ? (
              <>
                <p className="jz-finale">{jianzhengFinale}</p>
                <button
                  className="btn"
                  onClick={() => {
                    setJianzhengOpen(false);
                    playSfx('close');
                  }}
                >
                  收卷
                </button>
              </>
            ) : (
              <button
                className="btn"
                onClick={() => {
                  setJianzhengOpen(false);
                  playSfx('close');
                }}
              >
                离堂
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* ---------- M5 撞墙告示：仙籍又"改规则"了 ---------- */}
      {wallNotice ? (
        <div className="modal-overlay">
          <div className="scroll-report ink-wall">
            <h2>衙门告示</h2>
            <p className="wall-text">{wallNotice}</p>
            <p className="dim">
              {fork === 'chose_stay' ? '你又听完一张饼。通透 +1。' : '仙籍遴选的门槛，似乎又远了些。'}
            </p>
            <button className="btn" onClick={ackWall}>
              默然收下
            </button>
          </div>
        </div>
      ) : null}

      {/* ---------- M5 岔路事件：仙籍冻结谕旨（必然降临） ---------- */}
      {fork === 'pending' ? (
        <div className="modal-overlay">
          <div className="scroll-report fork-scroll">
            <h2>谕旨 · 仙籍冻结</h2>
            <p>天庭忽降谕旨：仙籍遴选，无限期冻结。</p>
            <p>当晚，老杂役办了场告别宴。席间无人提仙籍，只聊茶。</p>
            <p className="dim">你心里的弦，一根一根地断了。</p>
            <div className="fork-btns">
              <button className="btn" onClick={() => chooseFork('stay')}>
                留下，把日子过明白
              </button>
              <button className="btn ghost" onClick={() => chooseFork('leave')}>
                另谋高就
              </button>
            </div>
            <p className="error">{toast}</p>
          </div>
        </div>
      ) : null}

      {/* ---------- M7 交接文书：留任转生确认卷轴（本周目小结 + 铸词预告） ---------- */}
      {rebirthOpen && fork === 'chose_stay' ? (
        <div className="modal-overlay" onClick={() => setRebirthOpen(false)}>
          <div className="scroll-report rebirth-scroll" onClick={(e) => e.stopPropagation()}>
            <h2>交接文书</h2>
            <p className="dim">办了交接，重新走进衙门——{state.loop + 1}周目。</p>
            <div className="rebirth-sum">
              <p>
                本周目历时 <b>{fmtDur(Date.now() - state.createdAt)}</b> · 办结差事{' '}
                <b>{state.questCount}</b> 件 · 已通 <b>{Math.max(0, state.questBest + 1)}</b> 档 ·
                通透 <b>{tongtou}</b>
              </p>
              {(() => {
                const trait = previewTrait(state.stats);
                const info = config.heirloomTraits[trait];
                const value = Math.min(8, 3 + (state.seniority ?? 0));
                return info ? (
                  <p>
                    铸词预告：以本周目行事铸神器「<b>{info.item}</b>」——{info.name} ·{' '}
                    {info.desc} <b>+{value}%</b>
                  </p>
                ) : null;
              })()}
              <p className="dim-tip">
                保留：旧账册、称号履历、仙籍冻结态、通透、传家神器。
                清零：职级、薪酬、贡献、法器、差事进度与每日次数。
              </p>
              <p className="dim-tip">
                资历 +1（经验 +{Math.min(50, ((state.seniority ?? 0) + 1) * 10)}%，5 层封顶）；
                本门功法 Lv2 起步。
              </p>
            </div>
            <div className="fork-btns">
              <button className="btn" onClick={doRebirth}>
                签下名字，办了交接
              </button>
              <button className="btn ghost" onClick={() => setRebirthOpen(false)}>
                再想想，文书先搁着
              </button>
            </div>
            <p className="error">{toast}</p>
          </div>
        </div>
      ) : null}

      {/* ---------- M6 履历卡：点开榜单任意一行；自己的卡可选戴称号 ---------- */}
      {card ? (
        <div className="modal-overlay" onClick={() => setCard(null)}>
          <div className="scroll-report resume-card" onClick={(e) => e.stopPropagation()}>
            <h2>履历卡 · {card.name}</h2>
            <p className="resume-line">
              {deptList.find((d) => d.id === card.dept)?.name ?? card.dept} · {card.rankName}
              {card.npc ? '' : ` Lv${card.rankLvl}`}
            </p>
            <p className="resume-line">
              办差力 <b className="gold">{card.zabanli}</b>
              {card.title ? (
                <>
                  {' '}· <i className="lb-badge">{card.title}</i>
                </>
              ) : null}
            </p>
            {card.npc ? (
              <p className="resume-flavor">{card.flavor}</p>
            ) : (
              <p className="resume-line">
                案牍山 · 已通 {Math.max(0, (card.questBest ?? 0) + 1)} 档 · 累计办结{' '}
                {card.questCount ?? 0} 件
              </p>
            )}
            {me && card.id === `player:${me.username}` ? (
              <div className="title-pick">
                <p className="dim-tip">选一枚挂牌（属性全部常驻生效，佩戴只换招牌）：</p>
                <div className="title-opts">
                  <button
                    className={`title-opt ${state.titleWorn === null ? 'on' : ''}`}
                    onClick={() => wearTitle(null)}
                  >
                    随最新
                  </button>
                  {(config?.allTitles ?? config?.questTitles ?? [])
                    .filter((t) => state.titles.includes(t.id))
                    .map((t) => {
                      const words = titles.find((x) => x.id === t.id)?.words;
                      return (
                        <button
                          key={t.id}
                          className={`title-opt ${state.titleWorn === t.id ? 'on' : ''}`}
                          title={`${t.flavor}${words ? ` · ${words}` : ''}`}
                          onClick={() => wearTitle(t.id)}
                        >
                          {t.name}
                        </button>
                      );
                    })}
                </div>
                {state.titles.length === 0 ? (
                  <p className="dim-tip">还没挣来称号——案牍山首办、凌霄阶、夜值悬案皆可授号。</p>
                ) : null}
              </div>
            ) : null}
            <button className="btn" onClick={() => setCard(null)}>
              合上卡片
            </button>
          </div>
        </div>
      ) : null}

      {/* ---------- M5.7 串门子轶事弹窗 ---------- */}
      {visitNote ? (
        <div className="modal-overlay" onClick={() => setVisitNote(null)}>
          <div className="scroll-report visit-scroll" onClick={(e) => e.stopPropagation()}>
            <h2>串门 · {visitNote.deptName}</h2>
            {npcNameOf(visitNote.event.npcId) ? (
              <p className="visit-npc dim">同僚 · {npcNameOf(visitNote.event.npcId)}</p>
            ) : null}
            <p className="visit-text">{visitNote.event.text}</p>
            {visitNote.gift ? (
              <p className="visit-gift">
                回礼：
                {visitNote.gift.bank ? (
                  <>
                    灵石 <b className="gold">+{fmt(visitNote.gift.bank)}</b>
                  </>
                ) : null}
                {visitNote.gift.contrib ? (
                  <>
                    贡献 <b className="gold">+{visitNote.gift.contrib}</b>
                  </>
                ) : null}
              </p>
            ) : visitNote.loss ? (
              <p className="visit-loss">
                输彩头：灵石 <b>−{fmt(visitNote.loss.bank ?? 0)}</b>
              </p>
            ) : (
              <p className="visit-gift dim">回礼嘛，这回没有——听了段好故事，不亏。</p>
            )}
            <button className="btn" onClick={() => setVisitNote(null)}>
              告辞
            </button>
          </div>
        </div>
      ) : null}

      {/* ---------- M5 旧账册：环境叙事，只展示已收残页 ---------- */}
      {ledgerPages !== null ? (
        <div className="modal-overlay" onClick={() => setLedgerPages(null)}>
          <div className="scroll-report ledger-book" onClick={(e) => e.stopPropagation()}>
            <h2>旧账册</h2>
            {ledgerPages.length === 0 ? (
              <p className="dim">案牍山的公文堆里，似乎夹着些旧纸页……</p>
            ) : (
              ledgerPages.map((p) => (
                <p key={p.id} className="ledger-page">
                  {p.text}
                </p>
              ))
            )}
            <button className="btn" onClick={() => setLedgerPages(null)}>
              合上账册
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(() => Boolean(getToken()));

  // M8：音频上下文要等首次用户交互（autoplay 策略），挂载时挂好解锁监听
  useEffect(() => {
    unlockAudio();
  }, []);

  return (
    <>
      <ThemeToggle />
      <SoundToggle />
      {authed ? (
        <GameScreen onLogout={() => setAuthed(false)} />
      ) : (
        <AuthScreen onAuthed={() => setAuthed(true)} />
      )}
    </>
  );
}
