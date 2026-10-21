# Cawal brand artwork

`logo.png` is the original full-color artwork supplied by the project owner.
It depicts a person speaking toward a laptop on a rounded yellow tile.

Run `npm run build:icons` to produce:

- `brand.png`: display artwork with only the connected outer white background
  removed and empty margins trimmed. White details inside the laptop are preserved.
- `icon.png`: the 256px application and tray icon.
- `icon.ico`: Windows icons at 16, 24, 32, 48, 64, 128, and 256px.

Settings, onboarding, and the installer display the full-color artwork directly.
Do not use the alpha channel as a monochrome CSS mask.
