/**
 * Run both apps on EC2:
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save
 *
 * API: port 5001 | Frontend (vite preview): port 3000
 * nginx: proxy /api → 5001, / → 3000 (see deploy/nginx-wc26-pm2.conf)
 */
module.exports = {
  apps: [
    {
      name: 'wc26-api',
      cwd: __dirname + '/../api',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'wc26-frontend',
      cwd: __dirname + '/../frontend',
      script: 'npm',
      args: 'run start',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
