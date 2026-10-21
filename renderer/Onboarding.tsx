import { useEffect, useRef, useState } from 'react';
import { unwrap, busyPhases, labels, type Snapshot, type OnboardingStep } from './types';
import ShortcutEditor, { Shortcut } from './ShortcutEditor';
import KeyField from './KeyField';
import logo from '../resources/logo.png';

const tagline = 'Pake Cangkem Virtual , Build Aplikasi 2.5x Lebih Cepat';
const steps: OnboardingStep[] = ['welcome', 'connect', 'shortcut', 'trial', 'ready'];

export default function Onboarding({ state }: { state: Snapshot }) {
  const api = window.cawal!;
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [practice, setPractice] = useState('');
  const lastResult = useRef(state.result?.id);
  const lock = useRef(false);
  const busy = busyPhases.includes(state.phase);
  const disabled = working || busy;
  const step = state.onboarding;
  const visibleSteps = state.setupFromInstaller ? steps.slice(1) : steps;
  useEffect(() => {
    if (step === 'trial' && state.phase === 'done' && state.result?.message === 'Practice complete.' && state.result.id !== lastResult.current) {
      lastResult.current = state.result.id;
      setPractice(previous => [previous, state.result!.text].filter(Boolean).join('\n'));
    }
  }, [step, state.phase, state.result]);
  async function run(task: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true; setWorking(true); setError('');
    try { await task(); } catch (error) { setError((error as Error).message); }
    finally { lock.current = false; setWorking(false); }
  }
  const move = (next: OnboardingStep) => void run(() => unwrap(api.onboarding(next)));
  const shortcut = <ShortcutEditor value={state.settings.hotkey} capturing={state.shortcutCapturing} disabled={disabled}
    onSave={async hotkey => { await unwrap(api.saveSettings({ ...state.settings, hotkey })); }} />;
  return <main className={`onboarding ${state.setupFromInstaller ? 'from-installer' : ''}`} aria-label="Set up Cawal">
    {state.setupFromInstaller && <aside className="setup-rail"><div><span className="setup-rail-logo" aria-hidden="true" style={{ maskImage: `url(${logo})`, WebkitMaskImage: `url(${logo})` }} /><p>Less typing.<br /><span>More flow.</span></p><div className="setup-rail-description">Your Windows voice companion.</div></div><small>WINDOWS / 64-BIT<br />Cawal setup</small></aside>}
    <div className="setup-main">
    <div className="setup-progress" aria-label={`Step ${visibleSteps.indexOf(step) + 1} of ${visibleSteps.length}`}>{visibleSteps.map((item, index) => <span key={item} className={index <= visibleSteps.indexOf(step) ? 'active' : ''} />)}</div>
    <section className={`setup-content setup-${step}`} key={step}>
      {!state.setupFromInstaller && <span className="setup-logo" aria-hidden="true" style={{ maskImage: `url(${logo})`, WebkitMaskImage: `url(${logo})` }} />}
      <p className="setup-eyebrow">{step === 'welcome' ? 'WELCOME TO CAWAL' : `GETTING STARTED · ${visibleSteps.indexOf(step) + 1} / ${visibleSteps.length}`}</p>
      <h1>{step === 'welcome' ? tagline : step === 'connect' ? 'Connect Groq' : step === 'shortcut' ? 'Set your shortcut' : step === 'trial' ? 'Try your first dictation' : 'You’re ready to dictate.'}</h1>
      {step === 'welcome' && <p className="setup-description">Speak naturally. Let Cawal do the typing.</p>}
      {step === 'connect' && <>
        <p className="setup-description">Enter your Groq API key to enable voice dictation.</p>
        <div className="setup-form"><label className="input-label" htmlFor="groq-key">Groq API key {state.hasKey && <span className="saved-key"> · Saved</span>}</label>
          <KeyField value={key} onChange={setKey} saved={state.hasKey} disabled={disabled} />
          <p className="field-help">Your key is encrypted and stored on this device.</p>
          <button className="text-button get-groq-key" disabled={working} onClick={() => void run(() => unwrap(api.openGroqKeys()))}>Get a Groq API key</button>
        </div>
      </>}
      {step === 'shortcut' && <><p className="setup-description">Choose the keys you’ll use to start and finish dictation.</p><div className="setup-form">{shortcut}</div>{state.shortcutError && <p role="alert" className="field-error">{state.shortcutError}</p>}</>}
      {step === 'trial' && <>
        <p className="setup-description">Click the text area below. Press your shortcut, say something, then press it again to finish.</p>
        <div className="practice-shortcut"><Shortcut value={state.settings.hotkey} /><span role="status">{busy ? labels[state.phase] : practice ? 'Done' : 'Ready to try'}</span></div>
        <textarea id="practice-text" aria-label="Dictation practice" placeholder="Your words will appear here…" value={practice} onChange={event => setPractice(event.target.value)} />
        <p className="field-help">Audio is sent to Groq for transcription. You can skip this step.</p>
        {busy && <button className="text-button" onClick={() => void api.action('cancel')}>Cancel dictation</button>}
      </>}
      {step === 'ready' && <><p className="setup-description">Use your shortcut in any app. Cawal stays ready in the background.</p><div className="ready-shortcut"><Shortcut value={state.settings.hotkey} /></div></>}
      {(error || state.error || state.warning || state.storageWarning) && <p className="message" role="alert">{error || state.error || state.warning || state.storageWarning}</p>}
      <div className="setup-actions">
        {visibleSteps.indexOf(step) > 0 && <button className="text-button" disabled={disabled} onClick={() => move(visibleSteps[visibleSteps.indexOf(step) - 1])}>Back</button>}
        {step === 'trial' && <button className="text-button skip-practice" disabled={disabled} onClick={() => move('ready')}>Skip for now</button>}
        <button className="primary setup-next" disabled={disabled || (step === 'connect' && !key.trim() && !state.hasKey) || (step === 'shortcut' && (!!state.shortcutError || state.shortcutCapturing))}
          onClick={() => {
            if (step === 'connect') void run(async () => {
              if (key.trim()) { await unwrap(api.testKey(key)); await unwrap(api.saveKey(key)); setKey(''); }
              else await unwrap(api.testKey(''));
              await unwrap(api.onboarding('shortcut'));
            });
            else move(step === 'welcome' ? 'connect' : step === 'shortcut' ? 'trial' : step === 'trial' ? 'ready' : 'complete');
          }}>{working ? 'Checking…' : step === 'welcome' ? 'Get started' : step === 'connect' ? 'Save & continue' : step === 'ready' ? state.setupFromInstaller ? 'Finish setup' : 'Open settings' : 'Continue'}</button>
      </div>
    </section>
    </div>
  </main>;
}
