#!/bin/bash
# =============================================================
# CraftForge 一键部署脚本 — 裸机模式（腾讯云 / 阿里云 / 任意 Linux）
# - 不使用 Docker
# - Node.js 20 + PM2 + Nginx + SQLite
# - 内置 P0 安全加固 + 自动备份 cron
# =============================================================
set -e

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  CraftForge 一键部署脚本（裸机模式）${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# 权限检查
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}请使用 root 用户运行此脚本（或加 sudo）${NC}"
  exit 1
fi

# 项目根目录（脚本所在目录的上级）
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# 安装目录（生产部署位置）
INSTALL_DIR="${INSTALL_DIR:-/opt/craftforge}"

# =============================================================
# 检查 / 生成 .env.production
# =============================================================
if [ ! -f ".env.production" ]; then
  echo -e "${RED}错误：未找到 .env.production${NC}"
  echo "请将模板 .env.production 拷贝到项目根目录并填写"
  exit 1
fi

# 自动生成强 JWT_SECRET（如果模板里还是占位符）
if grep -q "CHANGE_ME" .env.production; then
  echo -e "${YELLOW}检测到 JWT_SECRET 为占位符，自动生成 64 字节强密钥...${NC}"
  NEW_SECRET=$(openssl rand -hex 32)
  sed -i.bak "s|JWT_SECRET=.*|JWT_SECRET=$NEW_SECRET|" .env.production
  rm -f .env.production.bak
  echo -e "${GREEN}✅ JWT_SECRET 已写入 .env.production${NC}"
fi

source .env.production
echo -e "${GREEN}配置加载完成${NC}"
echo "  Nginx 端口: ${NGINX_PORT:-80}"
echo "  后端端口:   ${PORT:-3001}"
echo "  AI 模型:    ${DEEPSEEK_MODEL:-deepseek-chat}"
echo ""

# =============================================================
# 1. 系统依赖
# =============================================================
echo -e "${YELLOW}[1/7] 安装系统依赖...${NC}"
if command -v apt-get &> /dev/null; then
  apt-get update -y
  apt-get install -y nginx curl sqlite3 cron rsync
elif command -v dnf &> /dev/null; then
  dnf install -y nginx curl sqlite cronie rsync
elif command -v yum &> /dev/null; then
  yum install -y nginx curl sqlite cronie rsync
else
  echo -e "${RED}未检测到 apt/dnf/yum，请手动安装 nginx/sqlite3${NC}"
  exit 1
fi

# =============================================================
# 2. Node.js 20 LTS
# =============================================================
echo -e "${YELLOW}[2/7] 安装 Node.js 20 LTS...${NC}"
NEED_INSTALL_NODE=1
if command -v node &> /dev/null; then
  CUR_VER=$(node -v | cut -d. -f1 | tr -d v)
  if [ "$CUR_VER" -ge 20 ]; then
    NEED_INSTALL_NODE=0
    echo -e "${GREEN}已安装 Node.js: $(node -v)${NC}"
  fi
fi
if [ "$NEED_INSTALL_NODE" = "1" ]; then
  if command -v apt-get &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs python3 make g++ build-essential
  else
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs gcc-c++ make python3
  fi
  echo -e "${GREEN}Node.js 安装完成: $(node -v)${NC}"
fi

# =============================================================
# 3. PM2
# =============================================================
echo -e "${YELLOW}[3/7] 安装 PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi
echo -e "${GREEN}PM2: $(pm2 -v)${NC}"

# =============================================================
# 4. 同步代码到 INSTALL_DIR
# =============================================================
echo -e "${YELLOW}[4/7] 同步代码到 $INSTALL_DIR ...${NC}"
mkdir -p "$INSTALL_DIR"
rsync -a --delete \
  --exclude=node_modules \
  --exclude=dist \
  --exclude='.git' \
  --exclude='*.zip' \
  --exclude='*.tar.gz' \
  --exclude=backups \
  --exclude='data/*.db*' \
  "$PROJECT_ROOT/" "$INSTALL_DIR/"
cp -f "$PROJECT_ROOT/.env.production" "$INSTALL_DIR/.env.production"
chmod 600 "$INSTALL_DIR/.env.production"

# =============================================================
# 5. 构建后端 + 前端
# =============================================================
echo -e "${YELLOW}[5/7] 构建后端...${NC}"
cd "$INSTALL_DIR/craftforge-server"
# 拷贝 .env 到后端目录（runtime 需要）
cp -f "$INSTALL_DIR/.env.production" "$INSTALL_DIR/craftforge-server/.env"
chmod 600 "$INSTALL_DIR/craftforge-server/.env"
npm install --no-audit --no-fund
npm run build
# 收紧 data 目录权限
mkdir -p data logs
chmod 700 data logs

echo -e "${YELLOW}[5/7] 构建前端...${NC}"
cd "$INSTALL_DIR/CraftForge"
export VITE_API_BASE_URL=/api
export VITE_APP_TOKEN="$APP_TOKEN"
npm install --no-audit --no-fund
npm run build

# 部署前端到 /var/www
rm -rf /var/www/craftforge
mkdir -p /var/www/craftforge
cp -r dist/* /var/www/craftforge/
chown -R www-data:www-data /var/www/craftforge 2>/dev/null \
  || chown -R nginx:nginx /var/www/craftforge 2>/dev/null \
  || true

# =============================================================
# 6. Nginx + PM2
# =============================================================
echo -e "${YELLOW}[6/7] 配置 Nginx 与 PM2...${NC}"

# Nginx 配置
cat > /etc/nginx/conf.d/craftforge.conf << 'NGINX_EOF'
server {
    listen 80;
    server_name _;
    root /var/www/craftforge;
    index index.html;

    # 隐藏 server 信息
    server_tokens off;

    # 安全响应头（与后端一致，覆盖静态资源）
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)" always;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    client_max_body_size 50m;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 后端反向代理（含 SSE 流式支持）
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
NGINX_EOF

# 删除默认 default 配置
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t

systemctl restart nginx
systemctl enable nginx

# PM2 启动
cd "$INSTALL_DIR/craftforge-server"
pm2 delete craftforge-server 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup || true

# =============================================================
# 7. 备份 cron
# =============================================================
echo -e "${YELLOW}[7/7] 配置每日数据库自动备份...${NC}"
chmod +x "$INSTALL_DIR/deploy/backup.sh"
chmod +x "$INSTALL_DIR/deploy/restore.sh"

CRON_LINE="0 3 * * * DB_PATH=$INSTALL_DIR/craftforge-server/data/craftforge.db BACKUP_DIR=$INSTALL_DIR/backups RETAIN_DAYS=7 $INSTALL_DIR/deploy/backup.sh >> $INSTALL_DIR/backups/backup.log 2>&1"
# 写入 root 的 crontab（先去重）
( crontab -l 2>/dev/null | grep -v "$INSTALL_DIR/deploy/backup.sh"; echo "$CRON_LINE" ) | crontab -
mkdir -p "$INSTALL_DIR/backups"
chmod 700 "$INSTALL_DIR/backups"
echo -e "${GREEN}✅ 已设置每天凌晨 3 点自动备份，保留 7 天${NC}"

# =============================================================
# 完成
# =============================================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  🎉 部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || echo "<服务器IP>")
echo -e "  访问地址:  ${BLUE}http://$PUBLIC_IP:${NGINX_PORT:-80}${NC}"
echo -e "  管理员账号: ${BLUE}admin / admin123${NC}（首次登录强制改密）"
echo ""
echo "常用命令："
echo "  查看后端日志:    pm2 logs craftforge-server"
echo "  重启后端:        pm2 restart craftforge-server"
echo "  重启 Nginx:      systemctl restart nginx"
echo "  立即备份:        $INSTALL_DIR/deploy/backup.sh"
echo "  恢复备份:        $INSTALL_DIR/deploy/restore.sh <file.db.gz>"
echo "  查看业务事件:    tail -f $INSTALL_DIR/craftforge-server/logs/event-\$(date +%Y-%m-%d).jsonl"
echo "  查看错误日志:    tail -f $INSTALL_DIR/craftforge-server/logs/error-\$(date +%Y-%m-%d).jsonl"
echo "  管理员日志 API:  GET /api/admin/logs/event?date=YYYY-MM-DD"
echo ""
