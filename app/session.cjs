const { randomUUID } = require('node:crypto');
const { MAX_AUDIO_BYTES, AUDIO_TYPES } = require('./groq.cjs');

// One owner for the recording/request lifecycle. Tokens reject late microphone
// events and API responses after cancellation, retry, or a new recording.
function createSession({ groq, store, captureTarget, deliver, emit, command }) {
  let state = { phase: 'idle', error: '', warning: '', result: null, canRetry: false };
  let active = null;
  let pending = null;
  let sequence = 0;
  let startTimer;
  let stopTimer;
  const publish = (patch) => { state = { ...state, ...patch }; emit({ ...state }); };
  const current = (id) => active?.id === id;
  const fail = (message) => {
    clearTimeout(startTimer); clearTimeout(stopTimer);
    active?.controller.abort(); active = null;
    publish({ phase: 'error', error: message, canRetry: Boolean(pending) });
  };
  async function run(id) {
    if (!current(id) || !pending) return;
    const { controller, target } = active;
    const input = pending;
    const signal = controller.signal;
    publish({ phase: 'transcribing', error: '', warning: '', canRetry: false });
    try {
      const key = store.getKey();
      const raw = await groq.transcribe(input.bytes, input.mime, key, input.settings, signal);
      if (!current(id)) return;
      let text = raw;
      let warning = '';
      if (input.settings.cleanup) {
        publish({ phase: 'cleaning' });
        try { text = await groq.cleanup(raw, key, signal); }
        catch (error) {
          if (signal.aborted) return;
          warning = `AI tidak berhasil merapikan teks. Hasil Whisper tetap tersedia. ${error.message}`;
        }
      }
      if (!current(id)) return;
      publish({ phase: 'pasting' });
      let delivery;
      try { delivery = await deliver(text, target); }
      catch { delivery = { pasted: false, copied: false, message: 'Paste dan salin otomatis gagal. Salin hasil dari Cawal.' }; }
      if (!current(id)) return;
      pending = null; active = null;
      publish({ phase: 'done', warning, error: '', canRetry: false,
        result: { id, text, raw, cleaned: text !== raw, time: Date.now(), ...delivery } });
    } catch (error) {
      if (current(id) && !signal.aborted) fail(error.message);
    }
  }
  return {
    snapshot: () => ({ ...state }),
    busy: () => ['preparing', 'recording', 'stopping', 'transcribing', 'cleaning', 'pasting'].includes(state.phase),
    async start({ paste = true } = {}) {
      if (this.busy()) return;
      try { store.getKey(); } catch (error) { fail(error.message); return; }
      pending = null;
      const id = `${++sequence}-${randomUUID()}`;
      const settings = store.read();
      active = { id, controller: new AbortController(), target: null, settings };
      publish({ phase: 'preparing', error: '', warning: '', canRetry: false });
      let target = null;
      try { if (paste) target = await captureTarget(); } catch { /* Clipboard remains available. */ }
      if (!current(id)) return;
      active.target = target;
      command({ type: 'start', id, microphone: settings.microphone });
      startTimer = setTimeout(() => {
        if (current(id) && state.phase === 'preparing') {
          command({ type: 'cancel', id }); fail('Mikrofon belum siap. Periksa izin mikrofon Windows.');
        }
      }, 20000);
    },
    stop() {
      if (state.phase !== 'recording' || !active) return;
      const id = active.id;
      publish({ phase: 'stopping' }); command({ type: 'stop', id });
      stopTimer = setTimeout(() => {
        if (current(id) && state.phase === 'stopping') {
          command({ type: 'cancel', id }); fail('Rekaman tidak dapat diselesaikan. Coba rekam ulang.');
        }
      }, 10000);
    },
    cancel() {
      if (state.phase === 'pasting') return;
      clearTimeout(startTimer); clearTimeout(stopTimer);
      if (active) { command({ type: 'cancel', id: active.id }); active.controller.abort(); }
      active = null; pending = null;
      publish({ phase: 'idle', error: '', warning: '', canRetry: false });
    },
    async retry() {
      if (this.busy() || !pending) return;
      const id = `${++sequence}-${randomUUID()}`;
      // A retry from the app must never paste into an old target window.
      active = { id, controller: new AbortController(), target: null };
      pending.settings = store.read();
      await run(id);
    },
    recordingStarted(id) {
      if (current(id) && state.phase === 'preparing') {
        clearTimeout(startTimer); publish({ phase: 'recording' });
      }
    },
    recordingFailed(id, message) {
      if (current(id) && ['preparing', 'recording', 'stopping'].includes(state.phase)) fail(message);
    },
    async audio(id, buffer, mime) {
      if (!current(id) || !['recording', 'stopping'].includes(state.phase)) return;
      clearTimeout(startTimer); clearTimeout(stopTimer);
      if (!(buffer instanceof ArrayBuffer) || !buffer.byteLength || buffer.byteLength > MAX_AUDIO_BYTES || !AUDIO_TYPES.includes(mime)) {
        fail('Rekaman tidak valid atau terlalu besar. Maksimum 24 MB.'); return;
      }
      pending = { bytes: new Uint8Array(buffer), mime, settings: active.settings };
      await run(id);
    },
    clear() {
      if (this.busy()) return;
      pending = null; publish({ phase: 'idle', result: null, error: '', warning: '', canRetry: false });
    },
  };
}
module.exports = { createSession };
