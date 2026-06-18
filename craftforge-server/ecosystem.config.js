// PM2 进程管理配置
// 使用方式：pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'craftforge-server',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      out_file: 'logs/pm2-out.log',
      error_file: 'logs/pm2-error.log',
      merge_logs: true,
    },
  ],
};
