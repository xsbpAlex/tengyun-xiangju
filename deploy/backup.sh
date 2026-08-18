#!/usr/bin/env bash
# 腾云香局 · 存档热备份（SQLite VACUUM INTO，不停服不锁写）
# 保留最近 7 份；由 install.sh 挂到 crontab 每日凌晨 3 点执行
set -euo pipefail

DB="${NiumA_DATA_DIR:-/opt/tengyun-data}/game.db"
BACKUP_DIR="${NiumA_DATA_DIR:-/opt/tengyun-data}/backups"

if [[ ! -f "$DB" ]]; then
  echo "未找到存档库：$DB（服务还没跑过或路径不对）"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
node --input-type=module -e "
import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('$DB');
db.exec(\"VACUUM INTO '$BACKUP_DIR/game_$STAMP.db'\");
db.close();
console.log('备份完成：$BACKUP_DIR/game_$STAMP.db');
"

# 只留最近 7 份
ls -1t "$BACKUP_DIR"/game_*.db | tail -n +8 | xargs -r rm --
