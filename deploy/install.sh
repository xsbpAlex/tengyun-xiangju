#!/usr/bin/env bash
# 腾云香局 · 一键部署脚本（Ubuntu 20.04+ / Debian 11+）
# 用法：sudo bash deploy/install.sh
# 前置：代码已在服务器上（git clone 或 scp 上来的），本脚本在仓库根目录执行
set -euo pipefail

APP_DIR=/opt/tengyun
DATA_DIR=/opt/tengyun-data

if [[ $EUID -ne 0 ]]; then echo "请用 sudo 运行"; exit 1; fi

echo "==> [1/6] 安装 Node.js 22（NodeSource）"
if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> [2/6] 安装 Caddy"
if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg || true
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update && apt-get install -y caddy
fi

echo "==> [3/6] 安放代码到 ${APP_DIR}"
command -v rsync >/dev/null || apt-get install -y rsync
mkdir -p "$APP_DIR" "$DATA_DIR"
rsync -a --exclude node_modules --exclude .git --exclude server/data ./ "$APP_DIR/"

echo "==> [4/6] 安装依赖并构建前端（构建需要 vite/tsc，全量安装）"
cd "$APP_DIR"
npm ci
npm run build

echo "==> [5/6] 安装 systemd 服务"
cp "$APP_DIR/deploy/tengyun.service" /etc/systemd/system/tengyun.service
systemctl daemon-reload
systemctl enable --now tengyun.service
sleep 2
systemctl status tengyun.service --no-pager || true

echo "==> [6/6] 安装每日备份（crontab，凌晨 3 点）"
cp "$APP_DIR/deploy/backup.sh" /usr/local/bin/tengyun-backup.sh
chmod +x /usr/local/bin/tengyun-backup.sh
( crontab -l 2>/dev/null | grep -v tengyun-backup; echo "0 3 * * * /usr/local/bin/tengyun-backup.sh" ) | crontab -

echo ""
echo "完成。接下来："
echo "  1. 编辑 /etc/caddy/Caddyfile（参考 ${APP_DIR}/deploy/Caddyfile 模板），然后 systemctl reload caddy"
echo "  2. 云服务器控制台防火墙放行 80/443（有域名时）或 3001（IP 直连不走 Caddy 时）"
echo "  3. 验证：curl http://127.0.0.1:3001/api/health"
