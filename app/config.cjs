const STT_MODELS = ['whisper-large-v3-turbo', 'whisper-large-v3'];
const { normalizeShortcut } = require('./shortcuts.cjs');
const CLEANUP_MODEL = 'qwen/qwen3.8-27b';
const HOTKEYS = ['CommandOrControl+Shift+Space', 'CommandOrControl+Alt+Space', 'Alt+Shift+D'];
const DEFAULT_SETTINGS = Object.freeze({
  model: STT_MODELS[0], cleanup: true, language: 'id',
  microphone: '', hotkey: HOTKEYS[0], autoStart: false,
});
function validateSettings(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid settings.');
  const result = { ...DEFAULT_SETTINGS };
  // Indonesian (with mixed English) is the only preset; legacy language values are ignored.
  for (const key of Object.keys(result)) if (key !== 'language' && Object.hasOwn(input, key)) result[key] = input[key];
  if (!STT_MODELS.includes(result.model)) {
    throw new Error('Unsupported settings option.');
  }
  result.hotkey = normalizeShortcut(result.hotkey);
  if (typeof result.cleanup !== 'boolean' || typeof result.autoStart !== 'boolean' || typeof result.microphone !== 'string' || result.microphone.length > 512) {
    throw new Error('Invalid settings.');
  }
  return result;
}
function validateKey(key) {
  if (typeof key !== 'string' || !/^gsk_[A-Za-z0-9_-]{16,256}$/.test(key.trim())) {
    throw new Error('Enter a Groq API key starting with gsk_.');
  }
  return key.trim();
}
module.exports = { STT_MODELS, CLEANUP_MODEL, HOTKEYS, DEFAULT_SETTINGS, validateSettings, validateKey };
