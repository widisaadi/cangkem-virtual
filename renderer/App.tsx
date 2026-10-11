import { useEffect, useRef, useState } from 'react';
import { GearIcon, Link2Icon, Cross2Icon, MinusIcon, CheckIcon, ReloadIcon, InfoCircledIcon, ExclamationTriangleIcon, EyeOpenIcon, EyeClosedIcon } from '@radix-ui/react-icons';
import { createRecorder } from './recorder';
import { unwrap, busyPhases, labels, type Snapshot, type Settings } from './types';
import ShortcutEditor from './ShortcutEditor';
import FlowLine from './FlowLine';
import logo from '../resources/logo.png';

const api = window.cawal;
const isOverlay = new URLSearchParams(location.search).has('overlay');
function Logo() {
  return <span aria-hidden="true" className="logo" style={{ maskImage: `url(${logo})`, WebkitMaskImage: `url(${logo})` }} />;
}
function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled: boolean }) {
  return <button className="switch" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}><span /></button>;
}
export default function App() {
  const [state, setState] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState<'general' | 'connection'>('general');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [working, setWorking] = useState(false);
  const workingRef = useRef(false);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    document.documentElement.classList.toggle('overlay', isOverlay);
    if (!api) return;
    const unsubscribe = api.onState(setState);
    void unwrap(api.bootstrap()).then(value => { setState(value); if (!value.hasKey) setTab('connection'); }).catch(error => setError(error.message));
    if (isOverlay) return unsubscribe;
    // The hidden renderer owns microphone capture; the window is only settings.
    const recorder = createRecorder(api, () => {});
    const uncommand = api.onCommand(command => recorder.handle(command));
    return () => { unsubscribe(); uncommand(); recorder.dispose(); };
  }, []);
  useEffect(() => {
    if (isOverlay || !navigator.mediaDevices) return;
    const update = () => { void navigator.mediaDevices.enumerateDevices().then(devices => setMicrophones(devices.filter(device => device.kind === 'audioinput'))).catch(() => {}); };
    update(); navigator.mediaDevices.addEventListener('devicechange', update);
    return () => navigator.mediaDevices.removeEventListener('devicechange', update);
  }, [tab, state?.phase]);
  if (isOverlay) return state ? <div className="overlay-body" role="img" aria-label={labels[state.phase]}><FlowLine active={state.phase === 'recording'} /></div> : null;
  if (!api) return <div className="desktop-required"><Logo /><h1>Cawal</h1><p>Buka aplikasi desktop Cawal untuk mengatur dictation.</p></div>;
  const busy = state ? busyPhases.includes(state.phase) : false;
  const disabled = busy || working;
  async function perform(task: () => Promise<unknown>, message = '') {
    if (workingRef.current) return;
    workingRef.current = true; setWorking(true); setError(''); setNotice('');
    try { await task(); if (message) setNotice(message); }
    catch (error) { setError((error as Error).message); }
    finally { workingRef.current = false; setWorking(false); }
  }
  async function updateSettings(patch: Partial<Settings>) {
    if (api && state) setState(await unwrap(api.saveSettings({ ...state.settings, ...patch })));
  }
  const save = (patch: Partial<Settings>) => perform(() => updateSettings(patch));
  async function refreshMicrophones() {
    await perform(async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicrophones((await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'audioinput'));
    });
  }
  function navigate(next: typeof tab) { setTab(next); setError(''); setNotice(''); setKey(''); setShowKey(false); }
  const ready = Boolean(state?.hasKey && !state.shortcutError && !state.storageWarning);
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><Logo /><div><span className="brand-name">Cawal</span><span className="brand-tagline">Cangkem Virtual</span></div></div>
      <nav className="navigation" aria-label="Pengaturan Cawal"><div className="tabs">
        <button className={tab === 'general' ? 'selected' : ''} aria-current={tab === 'general' ? 'page' : undefined} onClick={() => navigate('general')}><GearIcon />Umum</button>
        <button className={tab === 'connection' ? 'selected' : ''} aria-current={tab === 'connection' ? 'page' : undefined} onClick={() => navigate('connection')}><Link2Icon />Koneksi</button>
      </div></nav>
      <div className="sidebar-bottom"><span className={`provider-label ${state?.hasKey ? 'configured' : ''}`}><span />Groq</span><span className="provider-detail">{state?.hasKey ? 'Key tersimpan' : 'Belum disetel'}</span></div>
    </aside>
    <div className="workspace">
      <header className="titlebar"><div className="window-buttons"><button aria-label="Sembunyikan Cawal" onClick={() => void api.window('minimize')}><MinusIcon /></button><button aria-label="Tutup ke tray" onClick={() => void api.window('hide')}><Cross2Icon /></button></div></header>
      <main className="app-body settings-view">
        <h1>{tab === 'general' ? 'Pengaturan' : 'Koneksi'}</h1>
        {!state ? <p className="loading" role="status">Menyiapkan Cawal…</p> : <>
          {(error || state.error) && <div className="message" role="alert"><ExclamationTriangleIcon /><span>{error || state.error}</span>{state.canRetry && <button className="text-button" disabled={disabled} onClick={() => void perform(() => unwrap(api.action('retry')))}>Coba lagi</button>}</div>}
          {notice && <div className="message" role="status"><CheckIcon /><span>{notice}</span></div>}
          {state.shortcutError && <div className="message" role="alert"><ExclamationTriangleIcon /><span>{state.shortcutError}</span></div>}
          {state.storageWarning && <div className="message" role="alert"><ExclamationTriangleIcon /><span>{state.storageWarning}</span></div>}
          {state.warning && <div className="message" role="status"><InfoCircledIcon /><span>{state.warning}</span></div>}
          {state.phase === 'done' && state.result && !state.result.pasted && <div className="message recovery" role="status"><InfoCircledIcon /><span>{state.result.message}</span><button className="text-button" disabled={working} onClick={() => void perform(() => unwrap(api.copy()), 'Teks disalin. Tempel dengan Ctrl+V.')}>Salin ulang</button><button className="icon-button" aria-label="Tutup pemberitahuan" onClick={() => void api.action('clear')}><Cross2Icon /></button></div>}
          {tab === 'general' ? <>
            {!state.hasKey && <div className="message" role="status"><InfoCircledIcon /><span>Tambahkan API key Groq untuk mengaktifkan shortcut.</span><button className="text-button" onClick={() => navigate('connection')}>Atur koneksi</button></div>}
            <section className="shortcut-setting" aria-labelledby="shortcut-title"><h2 id="shortcut-title">Shortcut dictation</h2><ShortcutEditor value={state.settings.hotkey} capturing={state.shortcutCapturing} disabled={disabled} onSave={async hotkey => { workingRef.current = true; setWorking(true); try { await updateSettings({ hotkey }); } finally { workingRef.current = false; setWorking(false); } }} /></section>
            <section className="settings-group" aria-label="Suara">
              <div className="setting-row"><label htmlFor="microphone">Mikrofon</label><div className="select-with-button"><select id="microphone" value={state.settings.microphone} disabled={disabled} onChange={event => void save({ microphone: event.target.value })}><option value="">Mikrofon default</option>{microphones.filter(mic => mic.deviceId && mic.deviceId !== 'default' && mic.deviceId !== 'communications').map((mic,index) => <option key={mic.deviceId} value={mic.deviceId}>{mic.label || `Mikrofon ${index + 1}`}</option>)}{state.settings.microphone && !microphones.some(mic => mic.deviceId === state.settings.microphone) && <option value={state.settings.microphone}>Mikrofon tidak tersedia</option>}</select><button className="icon-button refresh-mic" aria-label="Perbarui daftar mikrofon" disabled={disabled} onClick={() => void refreshMicrophones()}><ReloadIcon /></button></div></div>
              <div className="setting-row"><label htmlFor="model">Model suara</label><select id="model" value={state.settings.model} disabled={disabled} onChange={event => void save({ model: event.target.value as Settings['model'] })}><option value="whisper-large-v3-turbo">Whisper V3 Turbo</option><option value="whisper-large-v3">Whisper V3</option></select></div>
            </section>
            <section className="settings-group preferences" aria-label="Preferensi">
              <div className="setting-row"><span>Rapikan dengan AI</span><div className="inline-setting"><Switch label="Rapikan dengan AI" checked={state.settings.cleanup} disabled={disabled} onChange={value => void save({ cleanup: value })} /><span className="muted">Qwen 3.8</span></div></div>
              <div className="setting-row"><span>Bahasa</span><span className="setting-value muted">Indonesia + English</span></div>
              <div className="setting-row"><span>Mulai bersama Windows</span><div className="setting-value"><Switch label="Mulai bersama Windows" checked={state.settings.autoStart} disabled={disabled} onChange={value => void save({ autoStart: value })} /></div></div>
            </section>
          </> : <section className="connection-view" aria-label="Koneksi Groq">
            <div className="connection-intro"><div className="connection-symbol"><Link2Icon /></div><div><h2>Groq</h2><p>Satu API key untuk suara dan perapihan AI.</p></div><span className="key-status">{state.hasKey ? <><CheckIcon />Tersimpan</> : 'Belum disetel'}</span></div>
            <label className="input-label" htmlFor="groq-key">API key</label>
            <div className="key-input-row"><div className="key-input"><input id="groq-key" type={showKey ? 'text' : 'password'} autoComplete="off" spellCheck={false} placeholder={state.hasKey ? 'Masukkan key baru untuk mengganti' : 'gsk_…'} value={key} disabled={disabled} onChange={event => setKey(event.target.value)} /><button className="icon-button" disabled={!key || disabled} aria-label={showKey ? 'Sembunyikan API key' : 'Tampilkan API key'} onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOpenIcon /> : <EyeClosedIcon />}</button></div><button className="primary save-key" disabled={!key.trim() || disabled} onClick={() => void perform(async () => { await unwrap(api.saveKey(key)); setKey(''); setShowKey(false); }, 'API key tersimpan dengan aman.')}>Simpan</button></div>
            <p className="field-help">Key disimpan terenkripsi di perangkat ini.</p>
            <div className="connection-actions"><button className="secondary test-connection" disabled={(!key && !state.hasKey) || disabled} onClick={() => void perform(async () => { setNotice(await unwrap(api.testKey(key))); })}>{working ? 'Memeriksa…' : 'Tes koneksi'}</button>{state.hasKey && <button className="text-button remove-key" disabled={disabled} onClick={() => void perform(async () => { await unwrap(api.removeKey()); }, 'API key dihapus.')}>Hapus key</button>}</div>
            <div className="connection-details"><div><span>Transkripsi</span><span>{state.settings.model === 'whisper-large-v3-turbo' ? 'Whisper V3 Turbo' : 'Whisper V3'}</span></div><div><span>Perapihan AI</span><span>{state.settings.cleanup ? 'Qwen 3.8' : 'Nonaktif'}</span></div></div>
            <p className="privacy-note"><InfoCircledIcon />Audio dan teks diproses melalui Groq.</p>
          </section>}
        </>}
      </main>
      <footer><span className="footer-hint"><InfoCircledIcon />Tutup jendela ini. Shortcut tetap aktif.</span><span className={`background-status ${ready ? 'ready' : ''}`} role="status"><span />{busy && state ? labels[state.phase] : ready ? 'Aktif di background' : 'Perlu pengaturan'}</span></footer>
    </div>
  </div>;
}
