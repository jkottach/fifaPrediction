/**
 * pm2 on EC2 (run from repo root or admin-local):
 *   cd admin-local && npm run build
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save
 *
 * Listens on ADMIN_PORT (default 5002). Put nginx in front (see nginx-admin.conf).
 */
module.exports = {
  apps: [
    {
      name: 'wc26-admin',
      cwd: __dirname + '/..',
      script: 'npm',
      args: 'start',
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
