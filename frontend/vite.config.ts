import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** Always load `.env*` from `frontend/`, not the shell cwd. */
const frontendRoot = path.dirname(fileURLToPath(import.meta.url));

const disableHmr = process.env.VITE_DISABLE_HMR === 'true';
const hmrHost = process.env.VITE_HMR_HOST?.trim();

export default defineConfig({
  envDir: frontendRoot,
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    allowedHosts: ['wc26.kanhans.com'],
    // Dev behind nginx/HTTPS: HMR websocket often fails → full reload on every tab focus.
    // EC2: use `npm run build` + `npm run start`, or VITE_DISABLE_HMR=true for `npm run dev`.
    hmr: disableHmr
      ? false
      : hmrHost
        ? { host: hmrHost, protocol: 'wss', clientPort: 443 }
        : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
