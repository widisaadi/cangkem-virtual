const fs = require('node:fs');
const path = require('node:path');
const { DEFAULT_SETTINGS, validateSettings, validateKey } = require('./config.cjs');

function createSettings(directory, crypto) {
  const file = path.join(directory, 'settings.json');
  const steps = ['welcome', 'connect', 'shortcut', 'trial', 'ready', 'complete'];
  let data = { settings: { ...DEFAULT_SETTINGS }, key: '', onboarding: 'welcome' };
  let warning = '';
  try {
    if (fs.existsSync(file)) {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      const key = typeof saved.key === 'string' ? saved.key : '';
      data = { settings: validateSettings(saved.settings), key, onboarding: steps.includes(saved.onboarding) ? saved.onboarding : key ? 'complete' : 'welcome' };
    }
  } catch {
    warning = 'Settings could not be read. Set up your preferences and Groq API key again.';
  }
  const persist = (next) => {
    fs.mkdirSync(directory, { recursive: true });
    const temporary = file + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(next, null, 2), { mode: 0o600 });
    fs.renameSync(temporary, file);
    data = next;
  };
  return {
    get warning() { return warning; },
    read: () => ({ ...data.settings }),
    write: (settings) => { persist({ ...data, settings: validateSettings(settings) }); },
    hasKey: () => Boolean(data.key),
    onboarding: () => data.onboarding,
    setOnboarding: step => {
      if (!steps.includes(step)) throw new Error('Invalid setup step.');
      if (['shortcut', 'trial', 'ready', 'complete'].includes(step) && !data.key) throw new Error('Save your Groq API key first.');
      persist({ ...data, onboarding: step });
    },
    getKey: () => {
      if (!data.key) throw new Error('Save your Groq API key first.');
      try { return crypto.decryptString(Buffer.from(data.key, 'base64')); }
      catch { throw new Error('Your API key could not be decrypted on this device. Save it again.'); }
    },
    saveKey: (key) => {
      const value = validateKey(key);
      if (!crypto.isEncryptionAvailable()) throw new Error('Windows secure storage is unavailable. Restart Cawal and try again.');
      persist({ ...data, key: crypto.encryptString(value).toString('base64') });
    },
    removeKey: () => persist({ ...data, key: '' }),
  };
}
module.exports = { createSettings };
