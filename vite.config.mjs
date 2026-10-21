import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  root: 'renderer', base: './', plugins: [react(), {
    name: 'cawal-dev-csp', apply: 'serve',
    transformIndexHtml: html => html.replace("script-src 'self';", "script-src 'self' 'unsafe-inline';"),
  }],
  server: { host: '127.0.0.1', port: 5183, strictPort: true },
  build: { outDir: '../build/renderer', emptyOutDir: true, sourcemap: false },
});
