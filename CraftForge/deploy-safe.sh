#!/bin/bash

# CraftForge 匠魂实训引擎 - 安全隔离部署脚本
# 适用于已有Nginx和多个项目的服务器
# 使用独立端口 8088，避免与现有项目冲突

set -e

echo "=========================================="
echo "  CraftForge 安全隔离部署"
echo "  端口: 8088 (独立端口，避免冲突)"
echo "=========================================="

# 配置
APP_NAME="craftforge"
APP_PORT=8088
APP_DIR="/opt/$APP_NAME"
NGINX_CONF="/etc/nginx/conf.d/$APP_NAME.conf"

# 检查root权限
if [ "$EUID" -ne 0 ]; then
    echo "请使用 root 权限运行此脚本"
    exit 1
fi

# 检查端口是否被占用
echo "[1/6] 检查端口 $APP_PORT 是否可用..."
if ss -tlnp | grep -q ":$APP_PORT "; then
    echo "警告: 端口 $APP_PORT 已被占用"
    echo "占用信息:"
    ss -tlnp | grep ":$APP_PORT "
    echo ""
    read -p "是否尝试释放该端口? (y/N): " choice
    if [[ $choice == "y" || $choice == "Y" ]]; then
        # 尝试查找并停止占用进程
        pid=$(ss -tlnp | grep ":$APP_PORT " | grep -oP 'pid=\K[0-9]+' | head -1)
        if [ -n "$pid" ]; then
            echo "停止进程 PID: $pid"
            kill -9 $pid 2>/dev/null || true
            sleep 2
        fi
    else
        echo "请手动选择其他端口，修改脚本中的 APP_PORT 变量"
        exit 1
    fi
fi

echo "端口 $APP_PORT 可用"

# 检查Nginx是否运行
echo "[2/6] 检查Nginx状态..."
if ! systemctl is-active --quiet nginx; then
    echo "Nginx 未运行，尝试启动..."
    systemctl start nginx || {
        echo "错误: 无法启动Nginx，请检查Nginx安装"
        exit 1
    }
fi
echo "Nginx 运行正常"

# 创建应用目录
echo "[3/6] 创建应用目录 $APP_DIR..."
mkdir -p $APP_DIR

# 备份现有配置（如果存在）
if [ -f "$NGINX_CONF" ]; then
    echo "备份现有配置..."
    cp "$NGINX_CONF" "$NGINX_CONF.backup.$(date +%Y%m%d_%H%M%S)"
fi

# 复制构建文件
echo "[4/6] 复制构建文件..."
if [ -d "./dist" ]; then
    # 清理旧文件
    rm -rf ${APP_DIR}/*
    cp -r ./dist/* $APP_DIR/
    echo "文件复制完成"
else
    echo "错误: 未找到 dist 目录"
    echo "请确保在项目根目录运行此脚本，或先执行 'npm run build'"
    exit 1
fi

# 设置权限
chown -R nginx:nginx $APP_DIR 2>/dev/null || chown -R www-data:www-data $APP_DIR 2>/dev/null || true
chmod -R 755 $APP_DIR

# 创建Nginx配置（独立server块，使用不同端口）
echo "[5/6] 创建Nginx配置..."
cat > $NGINX_CONF << EOF
# CraftForge 匠魂实训引擎 - 独立端口配置
# 自动生成于 $(date '+%Y-%m-%d %H:%M:%S')

server {
    listen $APP_PORT;
    server_name _;
    root $APP_DIR;
    index index.html;

    # 日志配置（独立日志文件）
    access_log /var/log/nginx/${APP_NAME}-access.log;
    error_log /var/log/nginx/${APP_NAME}-error.log;

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

    # 前端路由支持（React Router）
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-App-Name "CraftForge" always;
}
EOF

# 测试Nginx配置
echo "测试Nginx配置..."
nginx -t || {
    echo "错误: Nginx配置测试失败"
    echo "恢复备份配置..."
    [ -f "$NGINX_CONF.backup."* ] && mv "$NGINX_CONF.backup."* "$NGINX_CONF"
    exit 1
}

# 重载Nginx（不中断现有连接）
echo "重载Nginx..."
nginx -s reload || systemctl reload nginx

# 配置防火墙
echo "[6/6] 配置防火墙..."
if command -v firewall-cmd &> /dev/null; then
    # 检查端口是否已开放
    if ! firewall-cmd --list-ports | grep -q "$APP_PORT/tcp"; then
        firewall-cmd --permanent --add-port=$APP_PORT/tcp
        firewall-cmd --reload
        echo "防火墙端口 $APP_PORT 已开放"
    else
        echo "防火墙端口 $APP_PORT 已存在"
    fi
elif command -v ufw &> /dev/null; then
    ufw allow $APP_PORT/tcp
    echo "UFW端口 $APP_PORT 已开放"
else
    echo "警告: 未检测到防火墙管理工具，请手动开放端口 $APP_PORT"
fi

# 验证部署
echo ""
echo "=========================================="
echo "  验证部署..."
echo "=========================================="

# 检查服务状态
sleep 2
if ss -tlnp | grep -q ":$APP_PORT "; then
    echo "✅ 服务运行正常"
    echo "   端口: $APP_PORT"
    echo "   目录: $APP_DIR"
    echo "   配置: $NGINX_CONF"
else
    echo "❌ 服务未启动，请检查日志:"
    echo "   tail -f /var/log/nginx/${APP_NAME}-error.log"
    exit 1
fi

# 获取服务器IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}' || echo 'your-server-ip')

echo ""
echo "=========================================="
echo "  🎉 部署成功！"
echo "=========================================="
echo ""
echo "  访问地址:"
echo "    http://${SERVER_IP}:${APP_PORT}"
echo ""
echo "  项目信息:"
echo "    名称: CraftForge 匠魂实训引擎"
echo "    端口: $APP_PORT (独立端口)"
echo "    目录: $APP_DIR"
echo "    配置: $NGINX_CONF"
echo ""
echo "  日志文件:"
echo "    访问日志: /var/log/nginx/${APP_NAME}-access.log"
echo "    错误日志: /var/log/nginx/${APP_NAME}-error.log"
echo ""
echo "  常用命令:"
echo "    查看状态: systemctl status nginx"
echo "    重载配置: nginx -s reload"
echo "    查看日志: tail -f /var/log/nginx/${APP_NAME}-error.log"
echo ""
echo "  卸载命令:"
echo "    rm -rf $APP_DIR $NGINX_CONF"
echo "    nginx -s reload"
echo ""
echo "=========================================="
