import { useEffect, useRef } from 'react';
const api = window.cawal;
const W = 80, MID = 14, FLAT = `M2 ${MID} L${W - 2} ${MID}`;
export default function FlowLine({ active, processing = false }: { active: boolean; processing?: boolean }) {
  const path = useRef<SVGPathElement>(null);
  useEffect(() => {
    path.current?.setAttribute('d', FLAT);
    if ((!active && !processing) || !api) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let target = 0, level = 0, phase = 0, frame = 0;
    let lastFrame = performance.now(), lastSample = lastFrame;
    const unsubscribe = active ? api.onAudioLevel(value => {
      target = Math.max(0, (value - .008) / .992);
      lastSample = performance.now();
    }) : () => {};
    const draw = (now: number) => {
      const dt = Math.min(.05, (now - lastFrame) / 1000);
      lastFrame = now;
      // Interpolate the microphone's 80ms samples at display refresh rate.
      // Fast attack keeps speech responsive; 170ms release softens the decay.
      if (now - lastSample > 240) target = 0;
      const tau = target > level ? .055 : .17;
      level += (target - level) * (1 - Math.exp(-dt / tau));
      // The wave keeps drifting gently even in silence, faster while speaking.
      if (!reduced.matches) phase = (phase + dt * (3.6 + level * 15)) % (2 * Math.PI);
      // While transcribing, a small ripple travels along the line.
      const ripple = processing && !reduced.matches ? ((now / 900) % 1) * (W + 30) - 15 : null;
      if (ripple === null && level < .001) path.current?.setAttribute('d', FLAT);
      else {
        const points: string[] = [];
        for (let x = 2; x <= W - 2; x++) {
          const envelope = Math.pow(Math.sin((x - 2) * Math.PI / (W - 4)), 1.6);
          const y = ripple === null
            ? MID + level * 11 * envelope * Math.sin((x - 2) * .17 - phase)
            : MID + 2.2 * Math.exp(-((x - ripple) ** 2) / 60) * Math.sin(x * .5 - phase * 2);
          points.push(`${x === 2 ? 'M' : 'L'}${x} ${y.toFixed(3)}`);
        }
        path.current?.setAttribute('d', points.join(' '));
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => { unsubscribe(); cancelAnimationFrame(frame); path.current?.setAttribute('d', FLAT); };
  }, [active, processing]);
  return <svg className="live-wave" width={W} height="28" viewBox={`0 0 ${W} 28`} aria-hidden="true">
    <path ref={path} className="wave-line" d={FLAT} />
  </svg>;
}
