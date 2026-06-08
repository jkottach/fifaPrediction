/** PM2 process config — run from api/: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: 'fifa-api',
      script: 'dist/server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: '5001',
      },
    },
  ],
};
