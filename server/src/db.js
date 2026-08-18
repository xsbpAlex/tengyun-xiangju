// 数据库层：SQLite（node:sqlite 内置模块，零原生依赖）
// 所有表结构按 GDD §9.3 预留，为网游化与 DLC 铺路
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

// M8：生产可用 NiumA_DATA_DIR 把存档库放独立目录（便于卷挂载/备份），默认不变
const DATA_DIR = process.env.NiumA_DATA_DIR
  ? path.resolve(process.env.NiumA_DATA_DIR)
  : path.resolve(import.meta.dirname, '../data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'game.db'));

db.exec(`
  PRAGMA journal_mode = WAL;

  -- 账号
  CREATE TABLE IF NOT EXISTS accounts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    INTEGER NOT NULL
  );

  -- 会话 token（不引 JWT 依赖，服务端自管）
  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  -- 权威存档：客户端只展示，服务端说了算
  CREATE TABLE IF NOT EXISTS saves (
    account_id   INTEGER PRIMARY KEY REFERENCES accounts(id),
    payload      TEXT NOT NULL DEFAULT '{}',
    updated_at   INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
  );

  -- 离线结算流水（M1 启用：登录时由服务端结算离线收益）
  CREATE TABLE IF NOT EXISTS offline_settlements (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    from_ts    INTEGER NOT NULL,
    to_ts      INTEGER NOT NULL,
    summary    TEXT NOT NULL DEFAULT '{}',
    settled_at INTEGER NOT NULL
  );

  -- 异步互动投递队列（预留：Phase 2 DLC 甩锅/互坑用）
  CREATE TABLE IF NOT EXISTS interactions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    from_account INTEGER NOT NULL REFERENCES accounts(id),
    to_account   INTEGER NOT NULL REFERENCES accounts(id),
    kind         TEXT NOT NULL,
    payload      TEXT NOT NULL DEFAULT '{}',
    created_at   INTEGER NOT NULL,
    consumed_at  INTEGER
  );

  -- 排行榜：按 维度 x 赛季 存储，周榜每周一滚动
  CREATE TABLE IF NOT EXISTS leaderboards (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    season     TEXT NOT NULL,
    metric     TEXT NOT NULL,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    value      REAL NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    UNIQUE (season, metric, account_id)
  );

  -- 玩家行为日志（为平衡调参留数据）
  CREATE TABLE IF NOT EXISTS action_logs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    action     TEXT NOT NULL,
    payload    TEXT NOT NULL DEFAULT '{}',
    at         INTEGER NOT NULL
  );
`);

export const now = () => Date.now();
