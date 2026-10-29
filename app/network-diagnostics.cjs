const fs = require('node:fs');
const path = require('node:path');

// Technical metadata only: never record headers, keys, audio, or transcripts.
function createNetworkDiagnostics(directory) {
  const file = path.join(directory, 'network-errors.jsonl');
  return event => {
    try {
      const entry = {
        time: new Date().toISOString(),
        stage: ['models', 'transcription', 'cleanup'].includes(event.stage) ? event.stage : 'unknown',
        kind: ['http', 'timeout', 'network', 'response'].includes(event.kind) ? event.kind : 'unknown',
        elapsedMs: Number.isFinite(event.elapsedMs) ? Math.max(0, Math.round(event.elapsedMs)) : 0,
      };
      if (Number.isInteger(event.status)) entry.status = event.status;
      if (/^[A-Z][A-Z0-9_]{0,63}$/.test(event.networkCode || '')) entry.networkCode = event.networkCode;
      fs.mkdirSync(directory, { recursive: true });
      if (fs.existsSync(file) && fs.statSync(file).size > 32 * 1024) {
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').trim().split('\n').slice(-50).join('\n') + '\n');
      }
      fs.appendFileSync(file, JSON.stringify(entry) + '\n');
    } catch { /* Diagnostics must never interrupt dictation. */ }
  };
}
module.exports = { createNetworkDiagnostics };
