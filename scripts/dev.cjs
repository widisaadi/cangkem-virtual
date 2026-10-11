const { spawn } = require('node:child_process');
const path = require('node:path');
const { createServer } = require('vite');
require('./build-native.cjs');
(async () => {
  const server = await createServer(); await server.listen();
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), [path.resolve(__dirname, '..'), '--dev'], { stdio: 'inherit', env, windowsHide: true });
  const close = async () => { child.kill(); await server.close(); };
  child.on('exit', async code => { await server.close(); process.exit(code || 0); });
  process.on('SIGINT', close); process.on('SIGTERM', close);
})().catch(error => { console.error(error.message); process.exit(1); });
