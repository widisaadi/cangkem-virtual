const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createSession } = require('../app/session.cjs');
const { DEFAULT_SETTINGS } = require('../app/config.cjs');
const { createGroq } = require('../app/groq.cjs');
function setup(overrides = {}) {
  const commands = []; const deliveries = [];
  const session = createSession({
    store: { read: () => ({ ...DEFAULT_SETTINGS }), getKey: () => 'key' },
    groq: { transcribe: async () => 'halo dunia', cleanup: async () => 'Halo dunia.' },
    captureTarget: async () => ({ handle: '123', pid: '999' }),
    deliver: async (text, target) => { deliveries.push({ text, target }); return { pasted: !!target, copied: true }; },
    emit: () => {}, command: value => commands.push(value), ...overrides,
  });
  const record = async () => { await session.start(); const id = commands.at(-1).id; session.recordingStarted(id); return id; };
  return { session, commands, deliveries, record };
}
test('dictation transcribes, cleans, delivers to captured window and finishes', async () => {
  const { session, deliveries, record } = setup();
  const id = await record(); session.stop();
  await session.audio(id, new ArrayBuffer(2), 'audio/webm');
  assert.equal(session.snapshot().phase, 'done');
  assert.equal(session.snapshot().result.raw, 'halo dunia');
  assert.deepEqual(deliveries, [{ text: 'Halo dunia.', target: { handle: '123', pid: '999' } }]);
});

test('mixed Indonesian-English wording survives transcription, cleanup and paste unchanged', async () => {
  const raw = 'kita follow up besok ya terus update settings nya habis meeting';
  const text = 'Kita follow up besok, ya. Terus update settings-nya habis meeting.';
  const groq = createGroq(async (url, options) => {
    if (url.endsWith('/audio/transcriptions')) return Response.json({ text: raw });
    assert.equal(JSON.parse(options.body).messages[1].content, raw);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: text } }] });
  });
  const { session, deliveries, record } = setup({ groq, store: { read: () => DEFAULT_SETTINGS, getKey: () => 'key' } });
  await session.audio(await record(), new ArrayBuffer(2), 'audio/webm');
  assert.equal(session.snapshot().result.raw, raw);
  assert.equal(deliveries[0].text, text);
  assert.equal(session.snapshot().result.pasted, true);
});
test('AI failure still delivers original Whisper transcript', async () => {
  const { session, deliveries, record } = setup({ groq: { transcribe: async () => 'raw words', cleanup: async () => { throw new Error('Qwen unavailable'); } } });
  await session.audio(await record(), new ArrayBuffer(2), 'audio/webm');
  assert.equal(deliveries[0].text, 'raw words');
  assert.match(session.snapshot().warning, /Qwen unavailable/);
  assert.equal(session.snapshot().phase, 'done');
});
test('retry keeps audio but never pastes to the stale target', async () => {
  let attempts = 0;
  const { session, record, deliveries } = setup({ groq: { transcribe: async () => { if (!attempts++) throw new Error('offline'); return 'hi'; }, cleanup: async () => 'Hi.' } });
  await session.audio(await record(), new ArrayBuffer(3), 'audio/webm');
  assert.equal(session.snapshot().canRetry, true);
  await session.retry();
  assert.equal(deliveries[0].target, null);
  assert.equal(session.snapshot().canRetry, false);
});
test('cancelled in-flight responses and stale audio never paste', async () => {
  let resolve;
  const { session, record, deliveries } = setup({ groq: { transcribe: () => new Promise(done => { resolve = done; }), cleanup: async text => text } });
  const id = await record();
  const request = session.audio(id, new ArrayBuffer(2), 'audio/webm');
  session.cancel(); resolve('too late'); await request;
  await session.audio(id, new ArrayBuffer(2), 'audio/webm');
  assert.equal(deliveries.length, 0);
  assert.equal(session.snapshot().phase, 'idle');
});
test('cancelling during target capture prevents microphone start', async () => {
  let finish;
  const { session, commands } = setup({ captureTarget: () => new Promise(resolve => { finish = resolve; }) });
  const start = session.start(); session.cancel(); finish(null); await start;
  assert.equal(commands.some(value => value.type === 'start'), false);
});
test('double start and duplicate audio do not launch duplicate requests', async () => {
  const { session, commands, record, deliveries } = setup();
  const id = await record(); await session.start();
  assert.equal(commands.filter(value => value.type === 'start').length, 1);
  await Promise.all([session.audio(id, new ArrayBuffer(2), 'audio/webm'), session.audio(id, new ArrayBuffer(2), 'audio/webm')]);
  assert.equal(deliveries.length, 1);
});
test('clear removes result and failed pending recording', async () => {
  const { session, record } = setup({ groq: { transcribe: async () => { throw new Error('offline'); } } });
  await session.audio(await record(), new ArrayBuffer(1), 'audio/webm');
  session.clear(); await session.retry();
  assert.equal(session.snapshot().canRetry, false);
  assert.equal(session.snapshot().phase, 'idle');
});
test('missing key never activates microphone', async () => {
  const { session, commands } = setup({ store: { getKey: () => { throw new Error('no key'); } } });
  await session.start(); assert.equal(session.snapshot().phase, 'error'); assert.equal(commands.length, 0);
});
