import { useEffect, useState } from 'react';
import FlowLine from './FlowLine';
import cawalIcon from '../resources/icon.png';
import { labels, type Snapshot } from './types';
// Compact island: icon of the app receiving the text, live wave, elapsed time.
export default function RecordingPill({ state }: { state: Snapshot }) {
  const recording = state.phase === 'recording';
  const [started, setStarted] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!recording) return;
    const start = Date.now(); setStarted(start); setNow(start);
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [recording]);
  const seconds = Math.max(0, Math.floor((now - started) / 1000));
  return <div className={`overlay-body ${recording ? 'is-recording' : 'is-processing'}`} role="img" aria-label={labels[state.phase]}>
    <img className="target-icon" src={state.targetIcon || cawalIcon} alt="" />
    <FlowLine active={recording} />
    <span className="elapsed">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>
  </div>;
}
