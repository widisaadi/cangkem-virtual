const { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, screen, safeStorage, clipboard, session, dialog, shell } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createSettings } = require('./settings.cjs');
const { createGroq } = require('./groq.cjs');
const { createPaste } = require('./paste.cjs');
const { createSession } = require('./session.cjs');
const { validateSettings, validateKey, HOTKEYS } = require('./config.cjs');
const { electronAccelerator } = require('./shortcuts.cjs');
const { createStartup } = require('./startup.cjs');
const { createSetupFlow } = require('./setup-flow.cjs');

app.setName('Cawal');
app.setPath('userData', path.join(app.getPath('appData'), 'Cawal'));
app.setAppUserModelId('app.cawal.dictation');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
const dev = process.argv.includes('--dev') && !app.isPackaged;
const smoke = process.argv.includes('--smoke-test') && !app.isPackaged;
if (smoke) {
  app.setPath('userData', path.join(app.getPath('temp'), `cawal-smoke-${process.pid}`));
  app.commandLine.appendSwitch('use-fake-device-for-media-stream');
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
}
const pageUrl = dev ? 'http://127.0.0.1:5183/' : pathToFileURL(path.join(__dirname, '..', 'build', 'renderer', 'index.html')).href;
let mainWindow, overlay, tray, store, dictation;
let quitting = false;
let rendererReady = false;
let escapeRegistered = false;
let maskMenu = () => {};
let shortcutError = '';
let shortcutCapturing = false;
let captureTimer;
let overlayDisplayId = null;
let recordingId = null;
let microphoneIssue = false;
let startup;
let startupError = '';
let setupFlow;
const groq = createGroq(smoke ? async url => {
  if (url.endsWith('/audio/transcriptions')) return Response.json({ text: 'aja bobad bol ira jaga mulutnya' });
  if (url.endsWith('/chat/completions')) return Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'Aja bobad, bol. Ira jaga mulutnya.' } }] });
  return Response.json({ data: [{ id: 'whisper-large-v3-turbo' }, { id: 'qwen/qwen3.8-27b' }] });
} : undefined);
const imagePath = path.join(__dirname, '..', 'resources', 'icon.png');

function showMain() {
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show(); mainWindow.focus();
}
function snapshot() {
  let startupRegistered = null;
  try { startupRegistered = startup?.read() ?? null; } catch { startupError = 'Windows startup status could not be read. Try toggling Start with Windows again.'; }
  return { ...dictation.snapshot(), onboarding: setupFlow.step(), setupFromInstaller: setupFlow.fromInstaller(), settings: store.read(), hasKey: store.hasKey(), shortcutError, shortcutCapturing, storageWarning: store.warning, microphoneIssue, startupRegistered, startupError };
}
function broadcast() {
  const value = snapshot();
  for (const window of [mainWindow, overlay]) if (window && !window.isDestroyed()) window.webContents.send('cawal:state', value);
}
function positionOverlay() {
  const { workArea } = screen.getAllDisplays().find(display => display.id === overlayDisplayId)
    || screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  overlay.setBounds({ x: Math.round(workArea.x + (workArea.width - 160) / 2), y: workArea.y + workArea.height - 82, width: 160, height: 64 });
}
function updateState(state) {
  if (state.phase === 'preparing' || state.phase === 'idle') microphoneIssue = false;
  broadcast();
  const busy = dictation.busy();
  if (busy && !escapeRegistered) escapeRegistered = globalShortcut.register('Escape', () => dictation.cancel());
  if (!busy && escapeRegistered) { globalShortcut.unregister('Escape'); escapeRegistered = false; }
  if (state.phase === 'preparing') { overlayDisplayId = null; overlay.hide(); }
  else if (busy) {
    // Capture the target monitor first, then show without taking keyboard focus.
    positionOverlay();
    overlay.setAlwaysOnTop(true, 'screen-saver');
    overlay.showInactive();
    overlay.moveTop();
  } else overlay.hide();
  if (tray) tray.setToolTip(`Cawal · ${state.phase === 'recording' ? 'Listening' : busy ? 'Processing' : 'Ready to dictate'}`);
}
function toggle(paste = false) {
  if (shortcutCapturing) return;
  if (!rendererReady) { showMain(); return; }
  if (dictation.snapshot().phase === 'recording') dictation.stop();
  else if (!dictation.busy()) {
    if (!store.hasKey()) showMain();
    void dictation.start({ paste });
  }
}
function onShortcut() {
  // Alt/Win shortcuts must not leave a lone modifier release behind (browser menu, Start).
  if (/(^|\+)(Alt|Super)\+/.test(store.read().hotkey)) maskMenu();
  toggle(true);
}
function registerShortcut(next) {
  const old = store.read().hotkey;
  if (old === next && globalShortcut.isRegistered(electronAccelerator(next))) return;
  if (!globalShortcut.register(electronAccelerator(next), onShortcut)) throw new Error('This shortcut is used by another app. Choose another combination.');
  if (old !== next) globalShortcut.unregister(electronAccelerator(old));
  shortcutError = '';
}
function endShortcutCapture() {
  clearTimeout(captureTimer);
  if (!shortcutCapturing) return;
  shortcutCapturing = false;
  try { registerShortcut(store.read().hotkey); } catch (error) { shortcutError = error.message; }
  broadcast();
}
function guard(event, mainOnly = false) {
  const allowed = mainOnly ? [mainWindow] : [mainWindow, overlay];
  if (!allowed.some(window => window && event.sender === window.webContents)) throw new Error('Request not allowed.');
  if (event.senderFrame !== event.sender.mainFrame) throw new Error('Frame not allowed.');
}
function handle(name, callback, mainOnly = true) {
  ipcMain.handle(`cawal:${name}`, async (event, ...args) => {
    guard(event, mainOnly);
    try { return { ok: true, value: await callback(...args) }; }
    catch (error) { return { ok: false, error: error.message || 'Request failed.' }; }
  });
}
function createWindow(isOverlay = false) {
  const window = new BrowserWindow({
    title: 'Cawal — Cangkem Virtual', width: isOverlay ? 160 : setupFlow.fromInstaller() ? 850 : 960, height: isOverlay ? 64 : setupFlow.fromInstaller() ? 620 : 760,
    minWidth: isOverlay ? 160 : 740, minHeight: isOverlay ? 64 : 560,
    show: false, frame: false, resizable: !isOverlay, maximizable: !isOverlay,
    fullscreenable: false, transparent: isOverlay, backgroundColor: isOverlay ? '#00000000' : '#171a1b',
    skipTaskbar: isOverlay, alwaysOnTop: isOverlay, focusable: !isOverlay,
    icon: imagePath, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required', webSecurity: true, devTools: !app.isPackaged },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  if (isOverlay) { window.setAlwaysOnTop(true, 'screen-saver'); window.setIgnoreMouseEvents(true); }
  window.loadURL(pageUrl + (isOverlay ? '?overlay=1' : ''));
  return window;
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_event, argv) => {
    if (argv.includes('--setup-after-install') && setupFlow && !dictation.busy()) {
      setupFlow.start(); mainWindow.setSize(850, 620); broadcast();
    }
    if (!argv.includes('--hidden') && mainWindow) showMain();
  });
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
      callback(contents === mainWindow?.webContents && permission === 'media' && details.mediaTypes?.every(type => type === 'audio'));
    });
    session.defaultSession.setPermissionCheckHandler((contents, permission, _origin, details) =>
      contents === mainWindow?.webContents && permission === 'media' && details.mediaType === 'audio');
    store = createSettings(app.getPath('userData'), safeStorage);
    setupFlow = createSetupFlow(store);
    if (process.argv.includes('--setup-after-install')) setupFlow.start();
    startup = createStartup(app, { enabled: app.isPackaged && !smoke });
    try { startup.sync(store.read().autoStart); } catch (error) { startupError = error.message; }
    mainWindow = createWindow(); overlay = createWindow(true);
    const paste = createPaste({ app, clipboard, ownWindows: () => BrowserWindow.getAllWindows(), onTargetDisplay: point => {
      overlayDisplayId = screen.getDisplayNearestPoint(screen.screenToDipPoint(point)).id;
    } });
    maskMenu = paste.maskMenu;
    dictation = createSession({ groq, store, ...paste,
      captureTarget: () => setupFlow.step() === 'trial' && mainWindow.isFocused() ? { onboarding: true } : paste.captureTarget(),
      deliver: (text, target) => target?.onboarding ? Promise.resolve({ pasted: true, copied: false, message: 'Practice complete.' }) : paste.deliver(text, target),
      emit: updateState, command: value => {
      recordingId = value.type === 'start' ? value.id : null;
      mainWindow.webContents.send('cawal:command', value);
    } });
    mainWindow.on('close', event => { if (!quitting) { event.preventDefault(); endShortcutCapture(); mainWindow.hide(); } });
    mainWindow.on('blur', endShortcutCapture);
    mainWindow.on('hide', endShortcutCapture);
    mainWindow.webContents.on('did-finish-load', () => { rendererReady = true; broadcast(); });
    mainWindow.webContents.on('render-process-gone', () => { rendererReady = false; dictation.cancel(); mainWindow.reload(); });
    overlay.webContents.on('did-finish-load', () => { broadcast(); if (dictation.busy()) updateState(dictation.snapshot()); });
    overlay.webContents.on('render-process-gone', () => { overlay.hide(); if (!quitting) overlay.reload(); });
    for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) {
      screen.on(event, () => { if (dictation.busy() && overlay.isVisible()) positionOverlay(); });
    }
    // First launch needs setup; configured launches quietly wait in the tray.
    if (!smoke) mainWindow.once('ready-to-show', () => { if (setupFlow.fromInstaller() || setupFlow.step() !== 'complete' || !store.hasKey() || store.warning || shortcutError || startupError || process.argv.includes('--show')) showMain(); });
    tray = new Tray(nativeImage.createFromPath(imagePath).resize({ width: 32, height: 32 }));
    tray.setToolTip('Cawal · Ready to dictate');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open Cawal', click: showMain }, { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]));
    tray.on('double-click', showMain);
    const preferredHotkey = store.read().hotkey;
    for (const candidate of [preferredHotkey, ...(HOTKEYS.includes(preferredHotkey) ? HOTKEYS.filter(value => value !== preferredHotkey) : [])]) {
      try {
        registerShortcut(candidate);
        if (candidate !== preferredHotkey) store.write({ ...store.read(), hotkey: candidate });
        shortcutError = ''; break;
      } catch (error) { shortcutError = error.message; }
    }
    handle('bootstrap', snapshot, false);
    handle('open-groq-keys', () => shell.openExternal('https://console.groq.com/keys'));
    handle('onboarding', step => {
      if (dictation.busy()) throw new Error('Finish dictation before continuing.');
      endShortcutCapture();
      setupFlow.move(step);
      if (step === 'complete') mainWindow.setSize(960, 760);
      dictation.clear(); broadcast(); return snapshot();
    });
    handle('shortcut-capture', enabled => {
      if (typeof enabled !== 'boolean') throw new Error('Invalid shortcut request.');
      if (!enabled) { endShortcutCapture(); return; }
      if (dictation.busy()) throw new Error('Finish dictation before capturing a shortcut.');
      clearTimeout(captureTimer);
      shortcutCapturing = true;
      globalShortcut.unregister(electronAccelerator(store.read().hotkey));
      captureTimer = setTimeout(endShortcutCapture, 30000);
      broadcast();
    });
    handle('settings', input => {
      if (dictation.busy()) throw new Error('Finish dictation before changing settings.');
      const next = validateSettings(input);
      const old = store.read();
      endShortcutCapture();
      registerShortcut(next.hotkey);
      try {
        startup.sync(next.autoStart);
        store.write(next);
        startupError = '';
      } catch (error) {
        if (next.hotkey !== old.hotkey) {
          globalShortcut.unregister(electronAccelerator(next.hotkey));
          globalShortcut.register(electronAccelerator(old.hotkey), onShortcut);
        }
        try { startup.sync(old.autoStart); } catch { /* Preserve the actionable original failure. */ }
        startupError = error.message;
        store.write(old); throw error;
      }
      if (microphoneIssue && old.microphone !== next.microphone) dictation.clear();
      broadcast(); return snapshot();
    });
    handle('save-key', key => { store.saveKey(key); broadcast(); return true; });
    handle('remove-key', () => { if (dictation.busy()) throw new Error('Finish dictation first.'); store.removeKey(); broadcast(); return true; });
    handle('test-key', key => groq.test(key ? validateKey(key) : store.getKey(), store.read()));
    handle('action', async action => {
      if (action === 'toggle') toggle();
      else if (action === 'cancel') dictation.cancel();
      else if (action === 'retry') await dictation.retry();
      else if (action === 'clear') dictation.clear();
      else throw new Error('Unknown action.');
    }, false);
    handle('copy', () => { const text = dictation.snapshot().result?.text; if (text) clipboard.writeText(text); });
    handle('window', action => {
      if (action === 'minimize') mainWindow.hide();
      else if (action === 'hide') mainWindow.hide();
      else if (action === 'show') showMain();
    }, false);
    handle('recording-started', id => dictation.recordingStarted(id));
    ipcMain.on('cawal:audio-level', (event, id, level) => {
      try { guard(event, true); } catch { return; }
      if (id !== recordingId || dictation.snapshot().phase !== 'recording' || typeof level !== 'number' || !Number.isFinite(level)) return;
      if (!overlay.isDestroyed()) overlay.webContents.send('cawal:audio-level', Math.max(0, Math.min(1, level)));
    });
    handle('recording-failed', (id, message, reason) => {
      if (id !== recordingId || !['preparing', 'recording', 'stopping'].includes(dictation.snapshot().phase)) return;
      microphoneIssue = ['disconnected', 'missing', 'unavailable'].includes(reason);
      dictation.recordingFailed(id, String(message).slice(0, 300));
      if (microphoneIssue) showMain();
    });
    handle('audio', (id, buffer, mime) => dictation.audio(id, buffer, mime));
    if (smoke) require('../scripts/smoke.cjs').run({ app, mainWindow, overlay, dictation, store, clipboard, setupFlow, broadcast });
  }).catch(error => { dialog.showErrorBox('Cawal could not start', error.message); app.exit(1); });
}
app.on('activate', () => mainWindow && showMain());
app.on('before-quit', () => { quitting = true; dictation?.cancel(); });
app.on('will-quit', () => { globalShortcut.unregisterAll(); tray?.destroy(); });
app.on('window-all-closed', () => { /* Cawal stays available from the system tray. */ });
