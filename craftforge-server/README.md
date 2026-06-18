# craftforge-server

CraftForge 前端的后端代理服务：把前端的 AI 请求转发到 DeepSeek，集中持有 API Key、做 APP_TOKEN 鉴权、IP 限流和访问日志。

## 技术栈

- Node 20+
- Express 4 + TypeScript
- 开发：tsx watch；生产：tsc 编译后 node 跑
- 进程管理：PM2

## 目录结构

```
craftforge-server/
├── src/
│   ├── server.ts                # Express 入口
│   ├── routes/ai.ts             # /api/ai/chat 流式转发
│   ├── middleware/auth.ts       # APP_TOKEN 校验
│   ├── middleware/rateLimit.ts  # IP 限流（内存版，60s/20 次）
│   ├── services/deepseek.ts     # 调 DeepSeek 的 SSE 透传
│   └── utils/logger.ts          # 按日切分 JSONL 日志
├── .env.example                 # 环境变量模板
├── ecosystem.config.js          # PM2 配置
├── package.json
└── tsconfig.json
```

## 快速开始

```bash
# 安装依赖
npm install

# 复制环境变量并填好
cp .env.example .env
# 编辑 .env，填入 DEEPSEEK_API_KEY 和 APP_TOKEN

# 开发模式（tsx watch）
npm run dev

# 生产构建并启动
npm run build
npm start
```

## 接口

### GET /api/health

```json
{ "status": "ok", "time": 1734567890123 }
```

### POST /api/ai/chat

请求头：

```
Authorization: Bearer <APP_TOKEN>
Content-Type: application/json
```

请求体：

```json
{
  "messages": [
    { "role": "system", "content": "你是工业实训师傅" },
    { "role": "user", "content": "什么是 FCC 反应器跑剂？" }
  ],
  "temperature": 0.7,
  "maxTokens": 400
}
```

响应：`Content-Type: text/event-stream`

```
data: {"delta":"FCC"}

data: {"delta":" 是"}

...

data: [DONE]

```

错误：

- 401 `{ "error": "Unauthorized" }` — APP_TOKEN 不匹配
- 429 `{ "error": "Too Many Requests", "retryAfter": 30 }` — 触发限流（60s 内同一 IP 超 20 次）
- 400 `{ "error": "..." }` — 请求体校验失败

## PM2 部署

```bash
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

详细服务器部署流程见仓库根目录 `deploy/DEPLOY.md`。

## 日志

- 访问日志：`logs/YYYY-MM-DD.jsonl`（每行 1 条）
- PM2 日志：`logs/pm2-out.log`、`logs/pm2-error.log`

## 安全说明

- `DEEPSEEK_API_KEY` 仅放在服务器 `.env` 内（chmod 600），永远不应入 git
- `APP_TOKEN` 是给前端 web 应用的最低门槛凭据；公开仓库后会被任何人通过浏览器看到，仅作为防扫请求层。生产环境若需更强保护，建议未来加用户登录系统
