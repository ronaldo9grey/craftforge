# CraftForge 匠魂工业实训引擎

工业流程仿真 + 故障演练训练平台，前端 + AI 师傅后端代理。

## 项目结构

- `CraftForge/`         前端（React + Vite + TS + Zustand）
- `craftforge-server/`  后端 AI 代理（Express + TS + PM2）
- `deploy/`             部署配置（nginx + DEPLOY.md）

## 快速开始

- 本地开发：见各子项目 README.md
- 服务器部署：见 [deploy/DEPLOY.md](./deploy/DEPLOY.md)

## 技术栈

- 前端：React 18, TypeScript, Vite, TailwindCSS, Zustand, Lucide
- 后端：Node 20, Express, TypeScript, PM2
- AI：DeepSeek API（OpenAI 兼容协议）
