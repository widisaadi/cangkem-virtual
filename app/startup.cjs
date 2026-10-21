// Keep Windows registration aligned with the saved preference after reinstall/update.
function createStartup(app, { enabled = app.isPackaged, executable = process.execPath } = {}) {
  const query = { path: executable, args: ['--hidden'] };
  let registered = null;
  function read() {
    if (!enabled) return null;
    const state = app.getLoginItemSettings(query);
    // Windows can omit args from launchItems for a custom registry name.
    registered = state.executableWillLaunchAtLogin && state.launchItems.some(item => item.name === 'Cawal' && item.enabled);
    return registered;
  }
  return {
    read,
    sync(wanted) {
      if (!enabled) return;
      app.setLoginItemSettings({ ...query, name: 'Cawal', openAtLogin: wanted, enabled: wanted });
      // Retire the older auto-generated name to avoid duplicate launches.
      app.setLoginItemSettings({ ...query, name: 'app.cawal.dictation', openAtLogin: false });
      if (read() !== wanted) throw new Error('Windows startup could not be updated. Try toggling Start with Windows again.');
    },
  };
}
module.exports = { createStartup };
