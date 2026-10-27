# DBZ Companions — Visual Fan Prototype (0.2.1)

Local, unofficial VS Code extension prototype featuring detailed **illustrated 2.5D cutouts of Goku and Vegeta** (derived from the concept art made in this chat). The sprites are **not actual 3D models**, do not rotate in 3D, and are animated through CSS translations, movement, bobbing and reactions. This version prioritizes looking similar to the requested character style rather than the primitive 3D shapes in version 0.1.

## Install

1. Open VS Code -> Extensions (the squares icon in the Activity Bar).
2. Click the `...` menu -> `Install from VSIX...`.
3. Choose `dbz-companions-local-0.2.1.vsix`. This upgrades the older `dbz-companions-local` extension.
4. Click the `DBZ Companions` icon in the left Activity Bar to open the view. If missing, open Command Palette `Ctrl+Shift+P` and run `DBZ Companions: Show Companion`.
5. To see a larger panel, run `DBZ Companions: Open Large Preview`.

## Features

- Animated character picker: Goku, Vegeta or Both.
- English Characters / Stats / Settings tabs, tiny characters, training toggle and light effects.
- Feed, Play, Rest, Training Session actions.
- Hunger slowly rises and energy slowly drops over time (also while VS Code is closed, up to 8 hours), so the companions need looking after.
- Save / error reaction events in VS Code. Only manual saves earn XP (max one per 10 seconds), and the error reaction plays only when a new error appears in the active file.
- Persistent character selection, game stats and preferences.
- No external runtime dependencies or internet access required.
- Respects operating system's reduced motion preference.

## Important limits

- The illustration is a **static, manually cut-out sprite**, not a rigged 3D model or sprite sheet with original frame-by-frame animations. Motion is CSS based.
- This prototype renders in a supported VS Code webview (sidebar or editor panel), not as a native transparent overlay over text.
- Do not publish/redistribute this package, character sprites, or promotional mockups. See LICENSE-NOTICE.md.

## Local development

Open this folder in VS Code and press `F5` to launch an Extension Development Host. Use `npm run check` to validate JavaScript syntax. To build a .vsix, run `npx @vscode/vsce package`.
