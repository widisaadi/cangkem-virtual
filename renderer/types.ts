export type Settings = {
  model: 'whisper-large-v3-turbo' | 'whisper-large-v3';
  cleanup: boolean; language: 'id'; microphone: string; hotkey: string; autoStart: boolean;
};
export type Phase = 'idle' | 'preparing' | 'recording' | 'stopping' | 'transcribing' | 'cleaning' | 'pasting' | 'done' | 'error';
export type Snapshot = {
  phase: Phase; error: string; warning: string; canRetry: boolean;
  settings: Settings; hasKey: boolean; shortcutError: string; shortcutCapturing: boolean; storageWarning: string;
  result: null | { id: string; text: string; raw: string; cleaned: boolean; time: number; pasted: boolean; copied: boolean; message: string };
};
export type Command = { type: 'start' | 'stop' | 'cancel'; id: string; microphone?: string };
export type Reply<T = void> = { ok: true; value: T } | { ok: false; error: string };
export interface CawalAPI {
  bootstrap(): Promise<Reply<Snapshot>>;
  saveSettings(settings: Settings): Promise<Reply<Snapshot>>;
  captureShortcut(enabled: boolean): Promise<Reply>;
  saveKey(key: string): Promise<Reply<boolean>>;
  removeKey(): Promise<Reply<boolean>>;
  testKey(key: string): Promise<Reply<string>>;
  action(action: 'toggle' | 'cancel' | 'retry' | 'clear'): Promise<Reply>;
  copy(): Promise<Reply>;
  window(action: 'minimize' | 'hide' | 'show'): Promise<Reply>;
  recordingStarted(id: string): Promise<Reply>;
  audioLevel(id: string, level: number): void;
  onAudioLevel(listener: (level: number) => void): () => void;
  recordingFailed(id: string, message: string): Promise<Reply>;
  audio(id: string, data: ArrayBuffer, mime: string): Promise<Reply>;
  onState(listener: (state: Snapshot) => void): () => void;
  onCommand(listener: (command: Command) => void): () => void;
}
declare global { interface Window { cawal?: CawalAPI } }
export async function unwrap<T>(promise: Promise<Reply<T>>): Promise<T> {
  const reply = await promise;
  if (!reply.ok) throw new Error(reply.error);
  return reply.value;
}
export const busyPhases: Phase[] = ['preparing', 'recording', 'stopping', 'transcribing', 'cleaning', 'pasting'];
export const labels: Record<Phase, string> = {
  idle: 'Siap mendengarkan', preparing: 'Menyiapkan mikrofon', recording: 'Mendengarkan',
  stopping: 'Menyelesaikan rekaman', transcribing: 'Mengubah suara jadi teks',
  cleaning: 'Merapikan tulisan', pasting: 'Mengirim tulisan', done: 'Tulisan siap', error: 'Perlu diperiksa',
};
