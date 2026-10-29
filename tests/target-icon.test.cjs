const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTargetIcon } = require('../app/target-icon.cjs');

test('window branding wins over the executable icon', async () => {
  const icons = [];
  const loader = createTargetIcon({
    windowIcon: async () => 'window-logo',
    fileIcon: async () => { throw new Error('Executable lookup should not run'); },
    publish: icon => icons.push(icon),
  });
  await loader.load({ image: 'generic-host.exe' }, loader.reset());
  assert.deepEqual(icons, ['window-logo']);
});

test('missing or inaccessible window icon falls back to the executable', async () => {
  for (const windowIcon of [async () => null, async () => { throw new Error('Access denied'); }]) {
    const icons = [];
    const loader = createTargetIcon({ windowIcon, fileIcon: async path => `file:${path}`, publish: icon => icons.push(icon) });
    await loader.load({ image: 'editor.exe' }, loader.reset());
    assert.deepEqual(icons, ['file:editor.exe']);
  }
});

test('icon failures leave the default branding available', async () => {
  const loader = createTargetIcon({
    windowIcon: async () => null,
    fileIcon: async () => { throw new Error('Missing file'); },
    publish: () => assert.fail('No icon should be published'),
  });
  await loader.load({ image: 'missing.exe' }, loader.reset());
  await loader.load({}, loader.reset());
});

test('cancelled window lookup cannot overwrite the next recording', async () => {
  let resolveOld;
  const icons = [];
  const loader = createTargetIcon({
    windowIcon: target => target.old ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve('new-logo'),
    fileIcon: async () => assert.fail('Stale fallback should not run'),
    publish: icon => icons.push(icon),
  });
  const previous = loader.reset();
  const pending = loader.load({ old: true, image: 'old.exe' }, previous);
  await loader.load({}, loader.reset());
  resolveOld(null);
  await pending;
  assert.equal(loader.current(previous), false);
  assert.deepEqual(icons, ['new-logo']);
});

test('late executable lookup is discarded after cancellation', async () => {
  let resolveFile;
  const loader = createTargetIcon({
    windowIcon: async () => null,
    fileIcon: () => new Promise(resolve => { resolveFile = resolve; }),
    publish: () => assert.fail('Cancelled result must be discarded'),
  });
  const pending = loader.load({ image: 'old.exe' }, loader.reset());
  await new Promise(resolve => setImmediate(resolve));
  loader.reset();
  resolveFile('old-logo');
  await pending;
});
