// Read-only verification against Windows, using Electron's own startup API.
const { app } = require('electron');
const executable = process.argv[2] && require('node:path').resolve(process.argv[2]);
app.whenReady().then(() => {
  if (!executable) throw new Error('Provide the installed Cawal executable path.');
  const state = app.getLoginItemSettings({ path: executable, args: ['--hidden'] });
  const entries = state.launchItems.filter(item => item.name === 'Cawal');
  const enabled = state.executableWillLaunchAtLogin && entries.some(item => item.enabled);
  console.log(JSON.stringify({ startupEnabled: enabled, openAtLogin: state.openAtLogin, executableWillLaunchAtLogin: state.executableWillLaunchAtLogin, entries }));
  app.exit(enabled ? 0 : 1);
}).catch(error => { console.error(error.message); app.exit(1); });
