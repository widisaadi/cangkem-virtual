const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCapture } = require('../app/paste.cjs');

test('target display accepts negative desktop coordinates and CRLF', () => {
  assert.deepEqual(parseCapture('ABC123 42 editor\r\nDISPLAY -1920 720\r\n'), {
    handle: 'ABC123', pid: '42', name: 'editor', displayPoint: { x: -1920, y: 720 },
  });
});
test('older capture output still works without a display', () => {
  assert.equal(parseCapture('ABC123 42 editor').displayPoint, null);
  assert.equal(parseCapture('invalid'), null);
});
