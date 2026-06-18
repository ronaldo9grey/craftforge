# CraftForge 匠魂实训引擎 - 部署指南

## 方法一：自动部署（推荐）

### 1. 上传项目文件

将项目文件上传到服务器：

```bash
# 在本地执行，将项目文件打包
zip -r craftforge.zip CraftForge/

# 上传到服务器
scp craftforge.zip root@123.207.74.78:/root/
```

### 2. 执行部署脚本

```bash
# SSH 连接到服务器
ssh root@123.207.74.78

# 解压项目
cd /root
unzip craftforge.zip
cd CraftForge

# 执行部署脚本
chmod +x deploy.sh
./deploy.sh
```

### 3. 访问应用

部署完成后，通过浏览器访问：
- http://123.207.74.78

---

## 方法二：手动部署

### 1. 安装依赖

```bash
# 更新系统
dnf update -y

# 安装 Nginx
dnf install -y nginx

# 安装 Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs
```

### 2. 构建项目

```bash
# 进入项目目录
cd /path/to/CraftForge

# 安装依赖
npm install

# 构建生产版本
npm run build
```

### 3. 配置 Nginx

```bash
# 创建应用目录
mkdir -p /opt/craftforge

# 复制构建文件
cp -r dist/* /opt/craftforge/

# 创建 Nginx 配置
cat > /etc/nginx/conf.d/craftforge.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /opt/craftforge;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

# 测试配置
nginx -t

# 启动 Nginx
systemctl enable nginx
systemctl restart nginx
```

### 4. 配置防火墙

```bash
firewall-cmd --permanent --add-service=http
firewall-cmd --reload
```

---

## 方法三：Docker 部署（可选）

### 1. 创建 Dockerfile

```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 2. 构建并运行

```bash
# 构建镜像
docker build -t craftforge .

# 运行容器
docker run -d -p 80:80 --name craftforge craftforge
```

---

## 常见问题

### 1. Nginx 启动失败

```bash
# 检查配置语法
nginx -t

# 查看错误日志
tail -f /var/log/nginx/error.log

# 检查端口占用
ss -tlnp | grep 80
```

### 2. 页面显示空白

```bash
# 检查文件是否存在
ls -la /opt/craftforge/

# 检查 Nginx 访问日志
tail -f /var/log/nginx/access.log
```

### 3. 权限问题

```bash
# 设置正确的权限
chown -R nginx:nginx /opt/craftforge
chmod -R 755 /opt/craftforge
```

---

## 更新部署

```bash
# 进入项目目录
cd /path/to/CraftForge

# 拉取最新代码（如果使用 git）
git pull

# 重新构建
npm install
npm run build

# 复制新构建文件
cp -r dist/* /opt/craftforge/

# 重启 Nginx
systemctl restart nginx
```

---

## 安全建议

1. **配置 HTTPS**: 使用 Let's Encrypt 免费证书
2. **配置防火墙**: 只开放必要的端口
3. **定期备份**: 备份应用目录和配置
4. **监控日志**: 定期检查 Nginx 访问日志和错误日志

---

## 联系方式

如有部署问题，请联系技术支持。
