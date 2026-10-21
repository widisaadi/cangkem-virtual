# User guide

## First-time setup

Open Cawal after installation and select **Get started**. Add your Groq API key,
choose a shortcut, and try dictation in the practice area. **Get a Groq API key**
opens the official key page in your browser. You log in to Groq yourself.

Practice is optional: select **Skip for now** or **Continue** to move on.
Unfinished setup resumes at the saved step. Existing users with a stored key
go directly to Settings after updating.

## Dictation

1. Place the cursor in the app where you want to type.
2. Press your configured shortcut to start recording.
3. Speak, then press the same shortcut to finish and paste the text.

Press **Esc** to cancel recording or processing. The default shortcut is
**Ctrl + Shift + Space**; if unavailable, Cawal tries an alternative. Check
**General → Dictation shortcut** for the active combination.

The recording indicator follows the monitor containing the target app. It does
not take keyboard focus or block clicks. Recordings are limited to five minutes
and 24 MB. Internet access is required.

If automatic paste fails, use **Copy again** and paste manually. Elevated apps
may require manual paste. For recognized terminals, Cawal uses Ctrl + Shift + V.
Retrying a failed transcription copies the result rather than pasting into a
possibly outdated target window.

## General settings

- **Microphone:** select an input device or use the Windows default.
- **Speech model:** Whisper V3 Turbo (default) or Whisper V3, hosted by Groq.
- **Language:** Indonesia (default) or Cirebon. These are presets; mixed English
  wording is supported. Cirebon enables automatic language detection with dialect context.
- **Polish with AI:** use Qwen 3.8 to clean punctuation and paragraph breaks.
  If polishing fails, the original Whisper transcript is used.
- **Start with Windows:** launch Cawal in the background when you sign in.

Language presets provide prompting context, not custom model training. Accuracy
depends on your audio and the models. Polishing cannot recover speech omitted
from a transcript. If Qwen is unavailable for your Groq account, disable polishing.

If a microphone disconnects, Cawal stops recording and offers device recovery.
Select another input or **Use default microphone**, then start a new recording.

## Connection

Saved API keys appear as masked dots and cannot be revealed in the interface.
Enter a new key and select **Save** to replace it. **Test connection** checks model
availability; **Remove key** deletes the stored key.

## Background behavior

After setup, Cawal starts in the system tray. Closing or minimizing Settings
hides the window while the shortcut stays active. Double-click the tray icon
to reopen Settings, or select **Quit** in the tray menu to exit.

## Data and privacy

- Settings and the encrypted API key are stored in `%APPDATA%/Cawal/settings.json`.
- Audio is sent to Groq. Transcripts are also sent to Groq when AI polishing is enabled.
- The microphone is inactive while Cawal waits in the background.
- Audio and the last result remain in memory only and are lost on exit.
- Copied text stays in the Windows clipboard until replaced or cleared.
- Cawal has no telemetry, cloud sync, or automatic application updater.

Groq's processing, pricing, and usage limits are governed by your Groq account.
Download application updates from [Releases](https://github.com/widisaadi/cangkem-virtual/releases).
