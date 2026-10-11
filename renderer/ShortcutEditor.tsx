import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { unwrap } from './types';

const prettyKey: Record<string, string> = { CommandOrControl: 'Ctrl', Super: 'Win', Space: 'Spasi', Up: '↑', Down: '↓', Left: '←', Right: '→', Minus: '−', Equal: '=', Comma: ',', Period: '.', Slash: '/', Backslash: '\\', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backquote: '`' };
export function Shortcut({ value }: { value: string }) {
  return <span className="shortcut">{value.split('+').map((key, index) => <Fragment key={`${key}-${index}`}>{index > 0 && <span className="key-plus" aria-hidden="true">+</span>}<kbd>{prettyKey[key] || key}</kbd></Fragment>)}</span>;
}
function fromKeyboard(event: KeyboardEvent<HTMLInputElement>) {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return null;
  let key = event.code.replace(/^Key|^Digit/, '');
  if (/^Arrow/.test(key)) key = key.replace('Arrow', '');
  if (!/^(?:[A-Z0-9]|F(?:[1-9]|1\d|2[0-4])|Space|Up|Down|Left|Right|Home|End|PageUp|PageDown|Insert|Delete|Backspace|Enter|Tab|Minus|Equal|Comma|Period|Slash|Backslash|Semicolon|Quote|BracketLeft|BracketRight|Backquote)$/.test(key)) {
    throw new Error('Tombol ini belum didukung. Coba kombinasi lain.');
  }
  if (!event.ctrlKey && !event.altKey && !event.metaKey && !/^F\d+$/.test(key)) {
    throw new Error('Gabungkan tombol dengan Ctrl, Alt, atau Win.');
  }
  return [event.ctrlKey && 'CommandOrControl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Super', key].filter(Boolean).join('+');
}
export default function ShortcutEditor({ value, capturing, disabled, onSave }: {
  value: string; capturing: boolean; disabled: boolean; onSave: (value: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => { if (capturing) input.current?.focus(); }, [capturing]);
  useEffect(() => () => { void window.cawal?.captureShortcut(false); }, []);
  const changed = draft !== value;
  async function begin() {
    setError(''); setHint('');
    try { await unwrap(window.cawal!.captureShortcut(true)); }
    catch (error) { setError((error as Error).message); }
  }
  async function cancel() {
    await window.cawal?.captureShortcut(false);
    setDraft(value); setError(''); setHint('');
  }
  async function capture(event: KeyboardEvent<HTMLInputElement>) {
    if (!capturing || event.repeat) return;
    if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) {
      void cancel(); return;
    }
    event.preventDefault(); event.stopPropagation();
    if (event.key === 'Escape') { await cancel(); return; }
    try {
      const combination = fromKeyboard(event);
      if (!combination) {
        setHint([event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Win'].filter(Boolean).join(' + ') + ' + …');
        return;
      }
      setDraft(combination); setError(''); setHint('');
      await unwrap(window.cawal!.captureShortcut(false));
    } catch (error) { setError((error as Error).message); }
  }
  async function save() {
    setSaving(true); setError('');
    try { await onSave(draft); }
    catch (error) { setError((error as Error).message); }
    finally { setSaving(false); }
  }
  return <div className="shortcut-editor">
    <div className="shortcut-edit-row">
      <div className={`shortcut-field ${capturing ? 'capturing' : ''}`}>
        <input id="custom-shortcut" ref={input} readOnly aria-label="Rekam shortcut kustom" aria-describedby="shortcut-help" value={capturing ? hint || 'Tekan kombinasi tombol…' : ''} onKeyDown={event => void capture(event)} onBlur={() => { if (capturing) void window.cawal?.captureShortcut(false); }} tabIndex={capturing ? 0 : -1} />
        {!capturing && <Shortcut value={draft} />}
      </div>
      {capturing ? <button className="secondary" onClick={() => void cancel()}><Cross2Icon />Batal</button>
        : changed ? <><button className="primary save-shortcut" disabled={disabled || saving} onClick={() => void save()}><CheckIcon />Simpan</button><button className="icon-button" aria-label="Batalkan perubahan shortcut" disabled={saving} onClick={() => void cancel()}><Cross2Icon /></button></>
        : <button className="secondary shortcut-capture" aria-label="Ubah shortcut dictation" disabled={disabled} onClick={() => void begin()}>Ubah</button>}
    </div>
    <p id="shortcut-help" className="field-help">{capturing ? 'Tahan Ctrl, Alt, atau Win lalu tekan tombol pilihanmu. Esc untuk batal.' : changed ? 'Kombinasi baru siap. Simpan untuk mengaktifkannya.' : 'Pilih kombinasi sendiri. Tekan sekali untuk mulai, sekali lagi untuk selesai.'}</p>
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
