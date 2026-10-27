# DBZ Companions — Visual Fan Prototype (0.6.0)

Local, unofficial VS Code extension prototype featuring detailed **illustrated 2.5D cutouts of Goku and Vegeta** (derived from the concept art made in this chat). The sprites are **not actual 3D models**, do not rotate in 3D, and are animated through CSS translations, movement, bobbing and reactions. This version prioritizes looking similar to the requested character style rather than the primitive 3D shapes in version 0.1.

## Install

1. Open VS Code -> Extensions (the squares icon in the Activity Bar).
2. Click the `...` menu -> `Install from VSIX...`.
3. Choose `dbz-companions-local-0.6.0.vsix`. This upgrades the older `dbz-companions-local` extension.
   After upgrading, run `Developer: Reload Window` (`Ctrl+Shift+P`) so the new version is loaded.
4. Click the `DBZ Companions` icon in the left Activity Bar to open the view. If missing, open Command Palette `Ctrl+Shift+P` and run `DBZ Companions: Show Companion`.
5. To see a larger panel, run `DBZ Companions: Open Large Preview`.

## Features

- **They live on their own, like vscode-pets.** Goku and Vegeta walk, run, jump, fly, meditate, nap, power up, spar with each other and fire Kamehameha / Galick Gun blasts. Click a fighter to poke them; click the ground to drop a senzu bean and they race to eat it (it feeds them).
- **DBZ Arena in the Explorer.** A small arena view sits in the Explorer sidebar, so the fighters are on screen while you browse and edit files. Its title bar has *Throw Senzu Bean* and *Ki Blast!* buttons. Drag it to the bottom panel if you prefer.
- **Super Saiyan forms.** Level up and your fighters transform, with a flash and an aura:
  - Level 5: Super Saiyan (golden hair)
  - Level 10: Super Saiyan 2 (golden hair with lightning)
  - Level 20: Super Saiyan God (red hair)
  - Level 30: Super Saiyan Blue (blue hair)
- **Inside your code, too.** Goku and Vegeta walk around along the bottom of the visible code, turn around, run and jump, jump when you save, flinch at new errors and power up when they level up. If you type near the bottom, they move to the top. Set `dbzCompanions.editorFighters` to `cursor` to have them stand next to the line you are editing instead, or use `DBZ Companions: Toggle Fighters in Editor` to hide them. The status bar shows your level and form; click it to open the full view.
- XP comes from typing code (1 XP per 150 characters), manual saves, Play and Training.
- Animated character picker: Goku, Vegeta or Both.
- Fighters / Stats / Settings tabs that follow your VS Code colour theme, with an illustrated wasteland stage, a scouter power-level readout and manga speech bubbles.
- Feed, Play, Rest, Training Session actions.
- Hunger slowly rises and energy slowly drops over time (also while VS Code is closed, up to 8 hours), so the companions need looking after.
- Save / error reaction events in VS Code. Only manual saves earn XP (max one per 10 seconds), and the error reaction plays only when a new error appears in the active file.
- Persistent character selection, game stats and preferences.
- No external runtime dependencies or internet access required.
- Respects operating system's reduced motion preference.

## Keep the full view open next to your code

VS Code does not let extensions draw on top of the editor, so the big animated view lives in a side panel. To keep it always visible, open the Secondary Side Bar on the right (`Ctrl+Alt+B`) and drag the DBZ Companions icon from the left Activity Bar into it. VS Code remembers this, so the fighters stay next to your code while you use the Explorer or Search on the left.

## Important limits

- The illustration is a **static, manually cut-out sprite**, not a rigged 3D model or sprite sheet with original frame-by-frame animations. Motion is CSS based.
- This prototype renders in a supported VS Code webview (sidebar or editor panel), not as a native transparent overlay over text.
- Do not publish/redistribute this package, character sprites, or promotional mockups. See LICENSE-NOTICE.md.

## Local development

Open this folder in VS Code and press `F5` to launch an Extension Development Host. Use `npm run check` to validate JavaScript syntax. To build a .vsix, run `npx @vscode/vsce package`.
