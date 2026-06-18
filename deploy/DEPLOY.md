# CraftForge 服务器部署指南（腾讯云 OpenCloudOS 9）

> 目标系统：腾讯云 OpenCloudOS 9（RHEL 9 衍生，包管理器为 `dnf`）
> 部署路径示例：`/opt/craftforge`，前端静态目录：`/var/www/craftforge`，后端端口：`3001`
> 全部命令以 `root` 或 `sudo` 用户执行。生产环境请按需替换 `your-domain.com`、目录路径等占位符。

---

## 1. 服务器准备

### 1.1 系统更新与基础工具

```bash
sudo dnf -y update
sudo dnf -y install git nginx gcc-c++ make curl tar
```

### 1.2 安装 Node 20

推荐 NodeSource 官方 RPM 仓库：

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf -y install nodejs
node -v   # 应输出 v20.x.x
npm -v
```

> 备选：使用 nvm
> ```bash
> curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
> source ~/.bashrc
> nvm install 20
> nvm use 20
> nvm alias default 20
> ```

### 1.3 安装 PM2

```bash
sudo npm i -g pm2
pm2 -v
```

### 1.4 启动并启用 nginx

```bash
sudo systemctl enable --now nginx
sudo systemctl status nginx --no-pager
```

---

## 2. 拉取代码

```bash
sudo mkdir -p /opt
sudo git clone git@github.com:ronaldo9grey/craftforge.git /opt/craftforge
# 若服务器没配 SSH key，可改用 https：
# sudo git clone https://github.com/ronaldo9grey/craftforge.git /opt/craftforge
sudo chown -R $USER:$USER /opt/craftforge
cd /opt/craftforge
```

---

## 3. 后端启动

```bash
cd /opt/craftforge/craftforge-server

# 安装依赖
npm ci

# 复制环境变量并填入真实值
cp .env.example .env
vim .env
# 至少填入：
#   APP_TOKEN=<与前端 VITE_APP_TOKEN 完全一致>
#   DEEPSEEK_API_KEY=<sk-xxxxxxxxxx>
chmod 600 .env

# 编译 TypeScript
npm run build

# 用 PM2 启动
pm2 start ecosystem.config.js

# 让 PM2 在重启后自动拉起当前进程列表
pm2 save
# 生成系统级 systemd unit（按 pm2 输出的命令复制粘贴执行）
pm2 startup

# 查看运行情况
pm2 status
pm2 logs craftforge-server --lines 50
```

健康检查：

```bash
curl -s http://127.0.0.1:3001/api/health
# 期望输出：{"status":"ok","time":1700000000000}
```

---

## 4. 前端构建

```bash
cd /opt/craftforge/CraftForge

# 安装依赖
npm ci

# 复制环境变量模板，填入与后端一致的 APP_TOKEN
cp .env.example .env.production
vim .env.production
# 至少填入：
#   VITE_API_BASE_URL=/api
#   VITE_APP_TOKEN=<与后端 APP_TOKEN 完全一致>

# 构建
npm run build

# 部署静态文件到 nginx 目录
sudo mkdir -p /var/www/craftforge
sudo cp -r dist/* /var/www/craftforge/
sudo chown -R nginx:nginx /var/www/craftforge
```

---

## 5. nginx 配置

```bash
sudo cp /opt/craftforge/deploy/nginx-craftforge.conf /etc/nginx/conf.d/craftforge.conf

# 修改 server_name 与 root（如目录与示例不同）
sudo vim /etc/nginx/conf.d/craftforge.conf

# 校验语法并热加载
sudo nginx -t
sudo systemctl reload nginx
```

如果 SELinux 处于 enforcing，需要允许 nginx 反向代理本机网络：

```bash
sudo setsebool -P httpd_can_network_connect 1
```

---

## 6. 防火墙

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

> 腾讯云控制台「安全组」也需要放行 80 / 443，否则公网无法访问。

---

## 7. HTTPS（推荐 Let's Encrypt）

```bash
sudo dnf -y install epel-release
sudo dnf -y install certbot python3-certbot-nginx

sudo certbot --nginx -d your-domain.com
# 按提示输入邮箱、同意条款，certbot 会自动改写 nginx 配置并申请证书

# 自动续期已经通过 systemd timer 启用，可手动测试一下
sudo certbot renew --dry-run
```

---

## 8. 排错速查

```bash
# 后端日志（PM2 stdout/stderr）
pm2 logs craftforge-server

# 后端业务日志（按日切分）
ls /opt/craftforge/craftforge-server/logs
tail -f /opt/craftforge/craftforge-server/logs/$(date +%F).jsonl

# nginx 访问/错误日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# 直连后端测试
curl -i http://127.0.0.1:3001/api/health

# 经 nginx 测试
curl -i http://your-domain.com/api/health

# 测试鉴权（应 401）
curl -i -X POST http://your-domain.com/api/ai/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"hi"}]}'

# 测试鉴权（应开始流式输出）
curl -N -X POST http://your-domain.com/api/ai/chat \
  -H "Authorization: Bearer <APP_TOKEN>" \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"FCC 是什么"}]}'
```

常见问题：

- **SSE 卡顿、首字慢**：检查 nginx 是否设了 `proxy_buffering off;`、`proxy_cache off;`，以及上游是否在 keep-alive 长连接超时内返回。
- **401 Unauthorized**：前端 `VITE_APP_TOKEN` 与后端 `APP_TOKEN` 不一致。
- **429 Too Many Requests**：60 秒内同一 IP 超过 20 次，等冷却或调高 `src/middleware/rateLimit.ts` 的阈值。
- **502 / upstream_failed**：后端进程没起或 DeepSeek 返回错误，看 `pm2 logs`。
- **白屏**：构建产物未拷到 `/var/www/craftforge`，或 nginx `root` 指向错误。

---

## 9. 更新流程

```bash
cd /opt/craftforge
git pull

# 后端
cd craftforge-server
npm ci
npm run build
pm2 reload craftforge-server

# 前端
cd ../CraftForge
npm ci
npm run build
sudo cp -r dist/* /var/www/craftforge/
```

> 若前端环境变量发生变化（例如换了 APP_TOKEN），需要先更新 `.env.production` 再重新 `npm run build`。

---

## 10. 安全说明

1. `craftforge-server/.env` 必须 `chmod 600`，仅 owner 可读。
2. `DEEPSEEK_API_KEY`（`sk-...`）只放在服务器后端 `.env` 内，永远不应入 git，永远不应出现在前端构建产物里。
3. `APP_TOKEN` 仅是「最低请求门槛」凭据：前端构建产物公开后，任何人都能从 JS bundle 里看到它。它能挡住一般爬虫和未授权脚本，但不是身份认证。生产环境若要更强保护，建议未来引入用户登录系统，把 `APP_TOKEN` 升级成短期 JWT。
4. 内存版 IP 限流是单进程版本，多实例 / 集群部署需要替换为 Redis（推荐 `rate-limit-redis`）。
5. 推荐启用 HTTPS（见第 7 节）。HTTP 明文通道下 `Authorization` header 与对话内容均可被中间人嗅探。
6. 在腾讯云控制台为 22/80/443 之外的端口（含 3001）保持安全组关闭，3001 不应直接暴露公网。
