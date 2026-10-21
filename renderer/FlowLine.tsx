import { useEffect, useRef } from 'react';
const api = window.cawal;
export default function FlowLine({ active }: { active: boolean }) {
  const path = useRef<SVGPathElement>(null);
  useEffect(() => {
    const flat = 'M2 16 L62 16';
    path.current?.setAttribute('d', flat);
    if (!active || !api) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let target = 0, level = 0, phase = 0, frame = 0;
    let lastFrame = performance.now(), lastSample = lastFrame;
    const unsubscribe = api.onAudioLevel(value => {
      target = Math.max(0, (value - .008) / .992);
      lastSample = performance.now();
    });
    const draw = (now: number) => {
      const dt = Math.min(.05, (now - lastFrame) / 1000);
      lastFrame = now;
      // Interpolate the microphone's 80ms samples at display refresh rate.
      // Fast attack keeps speech responsive; 170ms release softens the decay.
      if (now - lastSample > 240) target = 0;
      const tau = target > level ? .055 : .17;
      level += (target - level) * (1 - Math.exp(-dt / tau));
      if (!reduced.matches) phase = (phase + dt * level * 5) % (2 * Math.PI);
      if (level < .001) path.current?.setAttribute('d', flat);
      else {
        const points: string[] = [];
        for (let x = 2; x <= 62; x++) {
          const envelope = Math.pow(Math.sin((x - 2) * Math.PI / 60), 1.6);
          const y = 16 + level * 12 * envelope * Math.sin((x - 2) * .2 - phase);
          points.push(`${x === 2 ? 'M' : 'L'}${x} ${y.toFixed(3)}`);
        }
        path.current?.setAttribute('d', points.join(' '));
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { unsubscribe(); cancelAnimationFrame(frame); path.current?.setAttribute('d', flat); };
  }, [active]);
  return <svg className="live-wave" width="64" height="32" viewBox="0 0 64 32" aria-hidden="true"><path ref={path} d="M2 16 L62 16" /></svg>;
}
