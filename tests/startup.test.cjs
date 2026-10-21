const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createStartup } = require('../app/startup.cjs');

function fixture(blocked = false) {
  const entries = new Map();
  const app = {
    isPackaged: true,
    setLoginItemSettings(options) {
      if (blocked) return;
      if (options.openAtLogin) entries.set(options.name, { ...options });
      else entries.delete(options.name);
    },
    getLoginItemSettings(query) {
      const launchItems = [...entries.values()].filter(item => item.path === query.path);
      return { launchItems, executableWillLaunchAtLogin: launchItems.some(item => item.enabled) };
    },
  };
  return { entries, app };
}

test('startup restores registration after update using the installed executable and hidden argument', () => {
  const { app, entries } = fixture();
  const startup = createStartup(app, { executable: 'F:\\Cawal\\Cawal.exe' });
  startup.sync(true);
  assert.equal(startup.read(), true);
  assert.equal(entries.get('Cawal').path, 'F:\\Cawal\\Cawal.exe');
  assert.deepEqual(entries.get('Cawal').args, ['--hidden']);
  entries.clear(); // An installer removed the old registry entry, but preference remains true.
  startup.sync(true);
  assert.equal(startup.read(), true);
  startup.sync(false);
  assert.equal(startup.read(), false);
});

test('startup migrates only the legacy Cawal name and reports a disabled Windows entry', () => {
  const { app, entries } = fixture();
  entries.set('app.cawal.dictation', { path: 'old.exe', args: [], enabled: true });
  entries.set('OtherApp', { path: 'other.exe', args: [], enabled: true });
  const startup = createStartup(app, { executable: 'F:\\Cawal\\Cawal.exe' });
  startup.sync(true);
  assert.equal(entries.has('app.cawal.dictation'), false);
  assert.equal(entries.has('OtherApp'), true);
  entries.get('Cawal').enabled = false;
  assert.equal(startup.read(), false);
});

test('startup cannot silently succeed if Windows ignores the registration', () => {
  const { app } = fixture(true);
  assert.throws(() => createStartup(app).sync(true), /could not be updated/);
});

test('custom Windows launch entries remain enabled even when Electron omits their argument list', () => {
  const { app } = fixture();
  const originalRead = app.getLoginItemSettings;
  app.getLoginItemSettings = query => {
    const state = originalRead(query);
    return { ...state, launchItems: state.launchItems.map(item => ({ ...item, args: [] })) };
  };
  const startup = createStartup(app);
  startup.sync(true);
  assert.equal(startup.read(), true);
});

test('development and smoke-test startup never register Electron in Windows', () => {
  const { app, entries } = fixture();
  const startup = createStartup(app, { enabled: false });
  startup.sync(true);
  assert.equal(startup.read(), null);
  assert.equal(entries.size, 0);
});
