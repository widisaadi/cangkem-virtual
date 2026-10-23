const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCapture } = require('../app/paste.cjs');

test('target display accepts negative desktop coordinates and CRLF', () => {
  assert.deepEqual(parseCapture('ABC123 42 editor\r\nDISPLAY -1920 720\r\n'), {
    handle: 'ABC123', pid: '42', name: 'editor', image: null, displayPoint: { x: -1920, y: 720 },
  });
});
test('target app path is read for the overlay icon', () => {
  const captured = parseCapture('ABC123 42 msedge\r\nDISPLAY 0 0\r\nPATH C:\\Program Files\\Edge\\msedge.exe\r\n');
  assert.equal(captured.image, 'C:\\Program Files\\Edge\\msedge.exe');
  assert.deepEqual(captured.displayPoint, { x: 0, y: 0 });
});
test('older capture output still works without a display', () => {
  assert.equal(parseCapture('ABC123 42 editor').displayPoint, null);
  assert.equal(parseCapture('invalid'), null);
});
