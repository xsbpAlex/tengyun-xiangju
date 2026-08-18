# 腾云香局 · 部署指南（阿里云轻量服务器）

目标：一台服务器跑腾云香局（以及你未来的其他游戏），朋友凭账号随时玩。

## 一、买服务器

1. 打开 https://www.aliyun.com/product/swas （轻量应用服务器），新用户活动约 68~99 元/年
2. 配置选 **2核2G 起步**（跑几个朋友局小游戏足够），系统盘默认 40~60G 够用
3. 镜像选 **Ubuntu 22.04**（应用镜像选「系统镜像」里的 Ubuntu，不要选应用镜像）
4. 地域二选一：
   - **国内节点 + 域名**：域名访问需 ICP 备案（约 1~3 周，阿里云控制台有备案入口，按流程走）
   - **想立刻上线**：选 **中国香港节点**（免备案）或直接 **IP 直连**（朋友访问 `http://公网IP:3001`，不走域名无需备案）
5. 买完在控制台记下：**公网 IP**、重置 root 密码（或上传 SSH 密钥）；在「防火墙」里放行 **80、443**（走 Caddy）或 **3001**（IP 直连）

## 二、把代码送上服务器

本地 PowerShell（在本仓库根目录）：

```powershell
scp -r d:\niuma\* root@你的公网IP:/root/tengyun-src/
```

或更稳的做法：建私有 git 仓库，服务器上 `git clone`。

## 三、一键安装

SSH 登录服务器后：

```bash
cd /root/tengyun-src
sudo bash deploy/install.sh
```

脚本会自动：装 Node 22 与 Caddy → 代码放 `/opt/tengyun` → 构建前端 → 装 systemd 服务（开机自启+崩溃拉起，存档库在 `/opt/tengyun-data`）→ 挂每日凌晨 3 点自动备份（保留 7 份）。

验证：

```bash
curl http://127.0.0.1:3001/api/health
# 期望：{"ok":true,"name":"腾云香局",...}
```

## 四、对外开放（二选一）

### 路线 A：IP 直连（最快，无域名）

什么都不用配。朋友浏览器打开 `http://你的公网IP:3001` 即可（控制台防火墙放行 3001）。

### 路线 B：域名 + 自动 HTTPS（长期推荐）

1. 有个域名，加一条 A 记录：`xiangju.你的域名.com` → 公网 IP（国内域名需备案通过后解析才生效）
2. 编辑 `/etc/caddy/Caddyfile`，参考 `/opt/tengyun/deploy/Caddyfile` 模板，把 `xiangju.你的域名.com` 换成你的子域名
3. `sudo systemctl reload caddy`（首次会自动申请 Let's Encrypt 证书）
4. 朋友访问 `https://xiangju.你的域名.com`

## 五、未来加新游戏（一台服务器多游戏）

1. 新游戏跑在自己的端口（如 :3002），同样装一个 systemd 服务
2. `/etc/caddy/Caddyfile` 加一个站点块：`game2.你的域名.com { reverse_proxy 127.0.0.1:3002 }`
3. `sudo systemctl reload caddy` 完事

## 六、日常运维小抄

```bash
sudo systemctl status tengyun      # 看状态
sudo systemctl restart tengyun     # 重启（改代码/更新后）
sudo journalctl -u tengyun -f      # 看日志
/usr/local/bin/tengyun-backup.sh   # 手动备份一次
ls /opt/tengyun-data/backups       # 备份在这
```

更新游戏流程：本地改完 → scp/git pull 到服务器 → `cd /opt/tengyun && npm ci && npm run build && sudo systemctl restart tengyun`。存档库在独立目录，更新永不碰存档。
