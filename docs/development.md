# Development notes

## Requirements

- Windows x64
- Node.js 24 or later
- .NET Framework 4.x, including the Windows C# compiler

```powershell
npm ci
npm run dev
```

## Project structure

| Path | Purpose |
| --- | --- |
| `app/` | Electron lifecycle, settings, Groq requests, and dictation state |
| `renderer/` | React settings, onboarding, microphone recording, and indicator |
| `native/Paste.cs` | Windows target detection, focus recovery, and paste |
| `resources/` | Application icons, logo, and README artwork |
| `scripts/` | Build helpers, desktop smoke test, and startup verification |
| `tests/` | Unit and integration tests, plus native desktop fixtures |

## Checks and builds

```powershell
npm run check
npm run test:desktop
npm run build:win
```

`check` runs TypeScript validation, Node tests, and the renderer build.
`test:desktop` uses an isolated settings directory, simulated microphone audio,
and stubbed Groq responses. It exercises onboarding, shortcut registration,
device recovery, background dictation, and native paste. It does not call Groq.
The desktop tests temporarily control focus and the clipboard; avoid interacting
with other windows while they run.

Windows installers are written to `dist/releases/`. The build does not download
local transcription models. Installers are unsigned unless signing is configured.

`build:win` produces a branded `Cawal-Setup-<version>.exe` in
`dist/releases/<version>/`. Its WPF interface embeds the NSIS installation engine;
the engine handles upgrades, uninstall registration, and Windows shortcuts.
Ship the **Setup** executable to users. The engine executable is a build component.

Run `npm run test:installer` after building to render all installer screens and
check navigation and folder validation without installing the application.
The installer also supports `/S /D=<absolute folder>` for silent installation.
Existing application settings and onboarding completion are preserved.
Folder selection is a separate screen. Progress and completion share one stationary layout. Once
installation completes, Continue setup launches Cawal with `--setup-after-install`.
That mode continues directly to Groq, shortcut selection, optional dictation
practice, and completion using the installer's visual theme. Existing users use
an in-memory review flow; their persisted onboarding completion is not reset.

## Implementation details

Settings and encrypted keys use a Cawal-specific data directory, separate from
OpenWhispr. The renderer receives only whether a key exists, never the saved key.
Onboarding progress persists alongside settings. Legacy users with a saved key
are treated as having completed onboarding.

Windows startup registration uses the installed executable with `--hidden`.
The application checks registration against the saved preference when launched.
The recording indicator receives microphone levels without taking focus from
the text field. Dictation requests use lifecycle tokens to reject late results
after cancellation or a new recording.

The target icon is read asynchronously from the captured window (bounded
`WM_GETICON`, then its window class), with the executable icon as a fallback.
Icon lookups carry a recording token so cancelled or delayed captures cannot
overwrite the next recording's icon or monitor. The desktop smoke fixture uses
a custom window icon to verify that generic executable branding is bypassed.

Production Groq requests use Electron's Chromium network stack so system proxy
and certificate handling follow Windows networking. API failures write bounded
local metadata to `network-errors.jsonl` in the Cawal settings directory: stage,
duration, HTTP status or network code, and timestamp. Keys, headers, response
bodies, recordings, and transcripts are excluded. Cancellation is not an error.
Transcription has a 15-second request deadline. Polishing has a 5-second deadline;
the session also enforces an independent five-second deadline and discards late
polishing results. If polishing stalls, the original transcript is delivered with a compact notice
that disappears after two seconds. Detailed errors remain in Settings.

Keep API keys, personal recordings, local settings, and generated build output
out of commits. Preserve the [MIT license and attribution](../LICENSE).
