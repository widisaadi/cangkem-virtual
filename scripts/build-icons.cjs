// Export the same CSS-masked logo used by the UI into Windows icon formats.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = path.join(__dirname, '..');
if (!process.versions.electron) {
  const { spawnSync } = require('node:child_process');
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(require('electron'), [__filename], { env, stdio: 'inherit', windowsHide: true, timeout: 30000 });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
} else {
  const { app, BrowserWindow } = require('electron');
  app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'cawal-icon-export-')));
  app.whenReady().then(async () => {
    const source = fs.readFileSync(path.join(root, 'resources', 'logo.png')).toString('base64');
    const window = new BrowserWindow({ width: 256, height: 256, show: false, frame: false, useContentSize: true, backgroundColor: '#000000', webPreferences: { offscreen: true, backgroundThrottling: false, nodeIntegration: false, contextIsolation: true, sandbox: true } });
    const html = `<style>html,body{margin:0;width:256px;height:256px;background:#000000}div{width:256px;height:256px;background:#ffdd33;mask:url(data:image/png;base64,${source}) center/contain no-repeat}</style><div></div>`;
    await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    await window.webContents.executeJavaScript(`new Promise(resolve => { const image = new Image(); image.onload = () => requestAnimationFrame(() => requestAnimationFrame(resolve)); image.src = 'data:image/png;base64,${source}'; })`);
    const capture = await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
    const png = capture.resize({ width: 256, height: 256 }).toPNG();
    fs.writeFileSync(path.join(root, 'resources', 'icon.png'), png);
    // A Windows ICO may contain a lossless 256px PNG payload.
    const header = Buffer.alloc(22);
    header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
    header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
    header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
    fs.writeFileSync(path.join(root, 'resources', 'icon.ico'), Buffer.concat([header, png]));
    console.log('Cawal mouth logo exported as PNG and Windows ICO.');
    app.exit(0);
  }).catch(error => { console.error(error); app.exit(1); });
}
