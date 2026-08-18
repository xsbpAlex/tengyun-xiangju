// 一次性清理：把历史测试号（m55_/mig55_/m76e2e_/m75e2e_/m8e2e_ 前缀）重置为初始低配档，
// 防止满配滞留号把徽章测试号（z=364）挤出榜单前 15 窗口。真实账号前缀不匹配，零影响。
import { DatabaseSync } from 'node:sqlite';
import { defaultState } from '../server/src/game/engine.js';

const db = new DatabaseSync('d:/niuma/server/data/game.db');
const rows = db.prepare('SELECT a.id, a.username FROM accounts a').all();
const hit = rows.filter((a) => /^(m55_|mig55_|m76e2e_|m75e2e_|m8e2e_)/.test(a.username));
const ts = Date.now();
for (const a of hit) {
  const st = defaultState(ts);
  st.dept = 'qianyafang'; // 初始档也保留一个可选部门形态，避免坏档样式
  db.prepare('UPDATE saves SET payload = ?, updated_at = ?, last_seen_at = ? WHERE account_id = ?')
    .run(JSON.stringify(st), ts, ts, a.id);
}
console.log(`重置测试号 ${hit.length} 个：${hit.map((a) => a.username).join(', ') || '（无）'}`);
db.close();
