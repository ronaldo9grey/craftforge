/// <reference types="vite/client" />

declare module '*.css' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

// 后端代理客户端环境变量（vite 在构建时把 import.meta.env.* 替换为字面量）
interface ImportMetaEnv {
  /** 后端 API 基础路径，开发可填 http://localhost:3001/api，生产填 /api */
  readonly VITE_API_BASE_URL?: string;
  /** 前端访问后端的 APP_TOKEN，与服务端 .env 的 APP_TOKEN 保持一致 */
  readonly VITE_APP_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
