const { contextBridge, ipcRenderer } = require('electron');
const invoke = (name, ...args) => ipcRenderer.invoke(`cawal:${name}`, ...args);
const subscribe = (name, listener) => {
  const wrapped = (_event, value) => listener(value);
  ipcRenderer.on(`cawal:${name}`, wrapped);
  return () => ipcRenderer.removeListener(`cawal:${name}`, wrapped);
};
contextBridge.exposeInMainWorld('cawal', {
  bootstrap: () => invoke('bootstrap'),
  saveSettings: settings => invoke('settings', settings),
  captureShortcut: enabled => invoke('shortcut-capture', enabled),
  saveKey: key => invoke('save-key', key),
  removeKey: () => invoke('remove-key'),
  testKey: key => invoke('test-key', key),
  action: action => invoke('action', action),
  copy: () => invoke('copy'),
  window: action => invoke('window', action),
  recordingStarted: id => invoke('recording-started', id),
  audioLevel: (id, level) => ipcRenderer.send('cawal:audio-level', id, level),
  onAudioLevel: listener => subscribe('audio-level', listener),
  recordingFailed: (id, message) => invoke('recording-failed', id, message),
  audio: (id, data, mime) => invoke('audio', id, data, mime),
  onState: listener => subscribe('state', listener),
  onCommand: listener => subscribe('command', listener),
});
