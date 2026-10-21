import type { CawalAPI, Command } from './types';

export function createRecorder(api: CawalAPI, onLevel: (value: number) => void) {
  let token: string | null = null;
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  let sampleTimer: ReturnType<typeof setInterval> | undefined;
  let limitTimer: ReturnType<typeof setTimeout> | undefined;
  function release() {
    clearInterval(sampleTimer); clearTimeout(limitTimer);
    stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    stream = null;
    if (context) void context.close().catch(() => {});
    context = null; onLevel(0);
  }
  function cancel() {
    token = null;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    recorder = null; release();
  }
  async function start(command: Command) {
    cancel(); token = command.id;
    const id = command.id;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: {
        deviceId: command.microphone ? { exact: command.microphone } : undefined,
        channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
      } });
      if (token !== id) { media.getTracks().forEach(track => track.stop()); return; }
      stream = media;
      const format = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      if (!format) throw new Error('Recording format is unavailable. Restart Cawal.');
      const current = new MediaRecorder(media, { mimeType: format, audioBitsPerSecond: 64000 });
      recorder = current;
      const chunks: Blob[] = [];
      let totalBytes = 0;
      let peak = 0;
      context = new AudioContext();
      await context.resume();
      if (token !== id) return;
      const analyser = context.createAnalyser(); analyser.fftSize = 1024;
      context.createMediaStreamSource(media).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      sampleTimer = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
        peak = Math.max(peak, rms); onLevel(Math.min(1, rms * 7));
        api.audioLevel(id, Math.min(1, rms * 7));
      }, 80);
      current.ondataavailable = event => {
        if (event.data.size) { chunks.push(event.data); totalBytes += event.data.size; }
        if (totalBytes > 23 * 1024 * 1024 && current.state === 'recording') current.stop();
      };
      current.onerror = () => {
        if (token === id) { cancel(); void api.recordingFailed(id, 'Microphone recording failed. Choose another microphone or use the default.', 'unavailable'); }
      };
      media.getAudioTracks().forEach(track => { track.onended = () => {
        if (token === id) { cancel(); void api.recordingFailed(id, 'Microphone disconnected. Reconnect it or use the default, then record again.', 'disconnected'); }
      }; });
      current.onstop = async () => {
        if (token !== id) return;
        release(); recorder = null;
        if (peak < 0.003) {
          token = null; void api.recordingFailed(id, 'No speech detected. Check your microphone and try speaking closer.'); return;
        }
        try {
          const data = await new Blob(chunks, { type: format }).arrayBuffer();
          if (token !== id) return;
          await api.audio(id, data, format.split(';')[0]);
        } catch {
          if (token === id) void api.recordingFailed(id, 'Recording could not be processed. Try recording again.');
        } finally { if (token === id) token = null; }
      };
      current.start(1000);
      void api.recordingStarted(id);
      limitTimer = setTimeout(() => { if (current.state === 'recording') current.stop(); }, 5 * 60 * 1000);
    } catch (error) {
      if (token !== id) return;
      cancel();
      const name = (error as Error).name;
      const message = name === 'NotAllowedError' ? 'Microphone permission denied. Enable desktop microphone access in Windows Settings.'
        : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'Microphone not found. Choose another microphone in Settings.'
        : name === 'NotReadableError' ? 'Microphone is unavailable. Close any app using it and try again.'
        : 'Recording could not start. Check your microphone and try again.';
      const reason = name === 'NotFoundError' || name === 'OverconstrainedError' ? 'missing' : name === 'NotReadableError' ? 'unavailable' : 'other';
      void api.recordingFailed(id, message, reason);
    }
  }
  return {
    handle(command: Command) {
      if (command.type === 'start') void start(command);
      else if (command.id === token && command.type === 'cancel') cancel();
      else if (command.id === token && command.type === 'stop' && recorder?.state === 'recording') recorder.stop();
    },
    dispose: cancel,
  };
}
