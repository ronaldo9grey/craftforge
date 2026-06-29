# CraftForge 部署指南（裸机模式）

适用于：腾讯云 / 阿里云 / 任意 Linux 服务器（Ubuntu 20.04+ / Debian 11+ / CentOS 7+ / Rocky Linux）。

> 本部署方案 **不使用 Docker**，直接装 Node.js 20 + PM2 + Nginx + SQLite，对资源消耗最小，适合 2 核 4G 起步。

---

## 1. 服务器要求

| 项 | 最低 | 推荐 |
|---|---|---|
| CPU | 2 核 | 4 核 |
| 内存 | 2 GB | 4 GB |
| 磁盘 | 20 GB | 40 GB |
| 系统 | Ubuntu 20.04 / CentOS 7 | Ubuntu 22.04 |
| 开放端口 | 80 (HTTP)，22 (SSH) | 加 443 (HTTPS) |

---

## 2. 快速开始（三步）

### Step 1 — 上传部署包

把 `craftforge-deploy.zip` 上传到服务器：

```bash
# 在你本地电脑
scp craftforge-deploy.zip root@<服务器IP>:/root/
```

### Step 2 — 解压

```bash
# SSH 登录服务器
ssh root@<服务器IP>

cd /root
unzip craftforge-deploy.zip -d craftforge
cd craftforge
```

### Step 3 — 一键部署

```bash
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

脚本会自动完成：
- ✅ 安装 nginx / sqlite3 / cron / Node.js 20 / PM2
- ✅ 自动生成强 JWT_SECRET（替换占位符）
- ✅ 构建后端（dist/）+ 构建前端（部署到 /var/www/craftforge）
- ✅ 配置 Nginx 反向代理（含 SSE 流式 + 安全头）
- ✅ PM2 启动 + 开机自启
- ✅ 配置每日凌晨 3 点自动备份数据库（保留 7 天）

部署完成后访问：`http://<服务器IP>` 

默认管理员：`admin / admin123`（首次登录强制改密）

---

## 3. P0 安全加固清单

本次升级已默认集成：

| 项 | 实现 |
|---|---|
| JWT_SECRET 强校验 | 生产环境 < 32 字符直接拒绝启动；部署脚本自动生成 64 字节随机串 |
| 限流（双维度） | 普通接口 60 req/min/user，AI 接口 30 req/min/user，超限事件入日志 |
| 安全响应头 | X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy / HSTS (HTTPS 时) |
| SQLite 文件权限 | 自动 chmod 600；data/ 与 logs/ 目录 700 |
| 关键事件埋点 | login_success / login_fail / jwt_invalid / rate_limit_hit / role_denied / drill_complete / experience_distilled / admin_action |
| 分级日志 | logs/access-YYYY-MM-DD.jsonl / error-... / event-... 三份独立 |
| 管理员日志 API | `GET /api/admin/logs/:kind?date=YYYY-MM-DD&q=keyword` |
| 自动备份 | 每天 03:00 用 `sqlite3 .backup` 热备份 + gzip，保留 7 天 |

---

## 4. 日常运维

### 查看日志

```bash
# PM2 实时日志
pm2 logs craftforge-server

# 分类查看（jsonl 格式）
tail -f /opt/craftforge/craftforge-server/logs/event-$(date +%Y-%m-%d).jsonl
tail -f /opt/craftforge/craftforge-server/logs/error-$(date +%Y-%m-%d).jsonl
tail -f /opt/craftforge/craftforge-server/logs/access-$(date +%Y-%m-%d).jsonl

# 用 jq 美化（推荐先 apt install jq）
tail -f /opt/craftforge/craftforge-server/logs/event-*.jsonl | jq .
```

### 通过 API 查询日志（仅管理员）

登录拿到 JWT 后：

```bash
curl -H "Authorization: Bearer <jwt>" \
  "http://<服务器IP>/api/admin/logs/event?date=2026-06-29&q=login&limit=50"
```

返回最近 50 条包含 "login" 关键字的事件。

### 备份与恢复

```bash
# 立即手动备份一次
/opt/craftforge/deploy/backup.sh

# 列出所有备份
ls -lh /opt/craftforge/backups/

# 恢复某次备份（会自动停服 + 备份当前 + 恢复 + 重启）
/opt/craftforge/deploy/restore.sh /opt/craftforge/backups/craftforge-20260629_030001.db.gz
```

### 重启 / 重新部署

```bash
# 只重启后端
pm2 restart craftforge-server

# 只重启 Nginx
systemctl restart nginx

# 代码升级（上传新 zip 后）
unzip -o craftforge-deploy.zip -d /tmp/craftforge-new
cp -r /tmp/craftforge-new/* /opt/craftforge/
cd /opt/craftforge && ./deploy/deploy.sh
```

---

## 5. HTTPS（推荐）

腾讯云已有备案域名情况下，推荐用 Certbot 一键签 Let's Encrypt：

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
# 选择强制 HTTPS 重定向
```

证书会自动续期。`Strict-Transport-Security` 响应头在 HTTPS 下自动启用。

---

## 6. 监控建议

- `pm2 monit` — 实时 CPU / 内存
- `GET /api/admin/health` — 含 DB 大小 / 进程内存 / uptime
- `tail -f /opt/craftforge/backups/backup.log` — 备份执行情况
- 阿里云 / 腾讯云控制台告警：CPU > 80% / 磁盘 > 80% 发短信

---

## 7. 故障排查

| 现象 | 排查 |
|---|---|
| 部署失败提示 JWT_SECRET 错误 | 检查 `.env.production` 中 `JWT_SECRET` 是否 ≥ 32 字符 |
| 502 Bad Gateway | `pm2 logs` 看后端是否起来；`pm2 restart craftforge-server` |
| AI Coach 卡住没回复 | 检查 DeepSeek key 是否欠费；看 `error-*.jsonl` |
| 学生频繁被限流 | 调高 `rateLimit.ts` 中 `MAX_HITS_AI`，重新 build |
| 数据库越来越大 | `du -sh /opt/craftforge/craftforge-server/data/`；超过 1 GB 考虑迁移 Postgres |

---

## 8. 文件结构

```
/opt/craftforge/
├── CraftForge/              # 前端源代码（构建产物已 cp 到 /var/www/craftforge）
├── craftforge-server/       # 后端
│   ├── data/
│   │   └── craftforge.db    # SQLite 数据库（700 权限）
│   ├── logs/
│   │   ├── access-*.jsonl
│   │   ├── error-*.jsonl
│   │   └── event-*.jsonl    # 业务事件埋点
│   └── dist/                # 编译产物
├── backups/
│   ├── craftforge-*.db.gz   # 每日备份（保留 7 天）
│   └── backup.log
├── deploy/
│   ├── deploy.sh
│   ├── backup.sh
│   └── restore.sh
└── .env.production          # 600 权限
```
