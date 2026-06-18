#!/bin/bash

# CraftForge 匠魂实训引擎 - 部署脚本
# 适用于 OpenCloudOS 9 / CentOS 9 / RHEL 9

set -e

echo "=========================================="
echo "  CraftForge 匠魂实训引擎 - 部署脚本"
echo "=========================================="

# 配置
APP_NAME="craftforge"
APP_DIR="/opt/$APP_NAME"
NGINX_CONF="/etc/nginx/conf.d/$APP_NAME.conf"
SERVICE_FILE="/etc/systemd/system/$APP_NAME.service"

# 检查root权限
if [ "$EUID" -ne 0 ]; then
    echo "请使用 root 权限运行此脚本"
    exit 1
fi

# 安装依赖
echo "[1/8] 安装系统依赖..."
dnf update -y
dnf install -y nginx git curl

# 安装 Node.js 20
echo "[2/8] 安装 Node.js 20..."
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" != "20" ]; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
fi

echo "Node.js 版本: $(node -v)"
echo "npm 版本: $(npm -v)"

# 创建应用目录
echo "[3/8] 创建应用目录..."
mkdir -p $APP_DIR

# 复制构建文件
echo "[4/8] 复制构建文件..."
if [ -d "./dist" ]; then
    cp -r ./dist/* $APP_DIR/
else
    echo "错误: 未找到 dist 目录，请先运行 'npm run build'"
    exit 1
fi

# 配置 Nginx
echo "[5/8] 配置 Nginx..."
cat > $NGINX_CONF << 'EOF'
server {
    listen 80;
    server_name _;
    root /opt/craftforge;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # 缓存静态资源
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 前端路由支持
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

# 检查 Nginx 配置
nginx -t

# 启动 Nginx
systemctl enable nginx
systemctl restart nginx

# 配置防火墙
echo "[6/8] 配置防火墙..."
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --reload
fi

# 创建 systemd 服务（可选，用于监控）
echo "[7/8] 创建系统服务..."
cat > $SERVICE_FILE << EOF
[Unit]
Description=CraftForge 匠魂实训引擎
After=network.target nginx.service

[Service]
Type=oneshot
ExecStart=/bin/true
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable $APP_NAME

# 完成
echo "[8/8] 部署完成！"
echo ""
echo "=========================================="
echo "  部署状态: 成功"
echo "  访问地址: http://$(curl -s ifconfig.me || echo 'your-server-ip')"
echo "  应用目录: $APP_DIR"
echo "  Nginx 配置: $NGINX_CONF"
echo "=========================================="
echo ""
echo "常用命令:"
echo "  查看 Nginx 状态: systemctl status nginx"
echo "  重启 Nginx: systemctl restart nginx"
echo "  查看日志: tail -f /var/log/nginx/access.log"
echo ""
