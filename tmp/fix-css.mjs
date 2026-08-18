// 一次性修复 styles.css 损坏的中文注释（按出现顺序替换），并追加 M5.5 样式
import { readFileSync, writeFileSync } from 'node:fs';

const path = 'd:/niuma/web/src/styles.css';
let text = readFileSync(path, 'utf8');

// 按文件内出现顺序对应的干净注释
const clean = [
  '/* ---------- 主题令牌：日间兜底 / 值夜（深色，默认启用） ---------- */',
  '/* GDD §8.1 品牌色 */',
  '/* 界面基色 */',
  '/* 值夜主题：深色底覆盖同名令牌 */',
  '/* margin:auto 保证竖向居中，不依赖外层定高 */',
  '/* 主题切换按钮：固定右上角 */',
  '/* ---------- M1 挂机主界面：PC 一屏三栏 ---------- */',
  '/* 三栏网格：头部横跨全宽，左右定宽，中栏伸缩 */',
  '/* 窄屏降级：两栏 → 单栏，保证小屏可用 */',
  '/* ---------- M2 成长区 ---------- */',
  '/* ---------- M4 案牍山与机巧阁 ---------- */',
  '/* ---------- M3 部门选任 ---------- */',
  '/* 结算卷轴弹窗 */',
  '/* ---------- M5 仙籍大饼 ---------- */',
  '/* 画饼告示 */',
  '/* 岔路事件弹窗 */',
  '/* 旧账册 */',
];

let i = 0;
text = text.replace(/\/\*[\s\S]*?\*\//g, (m) => {
  // 含替换符或控制字符 = 损坏注释
  if (/[\uFFFD\u0000-\u001f]/.test(m)) {
    if (i >= clean.length) throw new Error('clean 列表不够用：' + m.slice(0, 40));
    return clean[i++];
  }
  return m;
});
if (i !== clean.length) throw new Error(`替换数 ${i} ≠ 预期 ${clean.length}`);

// 追加 M5.5 样式
text +=
  '\n/* ---------- M5.5 自动开关与锁档提示 ---------- */\n' +
  '.grow-btn.auto-toggle {\n  border-style: dashed;\n  border-color: var(--dim);\n  color: var(--dim);\n  padding: 4px 10px;\n  font-size: 12px;\n}\n' +
  '.grow-btn.auto-toggle.on { border-color: var(--teal); color: var(--teal); }\n' +
  '.quest-lock-row { display: flex; align-items: center; gap: 10px; padding-bottom: 4px; }\n' +
  '.quest-lock-row .dim-tip { margin: 0; }\n';

writeFileSync(path, text, 'utf8');

// 校验
const noCom = text.replace(/\/\*[\s\S]*?\*\//g, '');
console.log('replaced:', i);
console.log('braces:', noCom.split('{').length - 1, '/', noCom.split('}').length - 1);
console.log('bad chars left:', [...text.matchAll(/[\uFFFD\u0000-\u001f]/g)].length);
