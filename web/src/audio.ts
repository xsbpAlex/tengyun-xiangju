// M8 合成音效：WebAudio 五声音阶短音，零素材依赖。
// 挂机静默是铁律——只挂四类反馈：得赏（清亮一声）/开卷（低一声）/收卷（两声）/金标告示（轻提醒）。
// AudioContext 延迟到首次用户交互后创建，规避浏览器 autoplay 策略。

export type SfxName = 'reward' | 'open' | 'close' | 'notice';

const KEY = 'ty_sound';
let ctx: AudioContext | null = null;
let hooked = false;

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* 隐身模式下无 localStorage，忽略 */
  }
}

function ensureCtx(): void {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

// 首次交互挂监听（App 挂载时调用一次），交互后音频上下文才可用
export function unlockAudio(): void {
  if (hooked) return;
  hooked = true;
  window.addEventListener('pointerdown', ensureCtx, { once: true });
  window.addEventListener('keydown', ensureCtx, { once: true });
}

// 五声音阶（宫商角徵羽），只取需要的几枚
const NOTE = {
  zhi3: 196.0,
  gong4: 261.63,
  zhi4: 392.0,
  yu4: 440.0,
  gong5: 523.25,
};

// 单音：正弦短音 + 快起缓落包络，音量刻意压低（不吵挂机人）
function tone(freq: number, delay: number, dur: number, peak: number): void {
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function playSfx(name: SfxName): void {
  if (!soundOn()) return;
  ensureCtx();
  switch (name) {
    case 'reward': // 晋升/领赏/对局得胜：清亮一声
      tone(NOTE.gong5, 0, 0.35, 0.09);
      break;
    case 'open': // 开卷轴：低一声
      tone(NOTE.zhi3, 0, 0.3, 0.07);
      break;
    case 'close': // 结案收卷：两声（徵→宫）
      tone(NOTE.zhi4, 0, 0.25, 0.08);
      tone(NOTE.gong5, 0.14, 0.35, 0.08);
      break;
    case 'notice': // 金标告示：轻提醒两连
      tone(NOTE.yu4, 0, 0.18, 0.045);
      tone(NOTE.yu4, 0.22, 0.18, 0.035);
      break;
  }
}
