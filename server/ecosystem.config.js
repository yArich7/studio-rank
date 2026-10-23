// pm2 进程守护：pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'leetcode-rank',
      script: 'index.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production'
      },
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      time: true
    }
  ]
}
