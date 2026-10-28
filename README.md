# DBZ Companions — Visual Fan Prototype (0.10.0)

Local, unofficial VS Code extension: Goku and Vegeta live in an arena under your code, like VS Code Pets. They level up into Super Saiyan forms while you code, hunt Dragon Balls and train with you in the Hyperbolic Time Chamber. The fighters are illustrated cutouts animated with CSS (not 3D models or frame-by-frame sprite sheets).

## Install

1. Open VS Code -> Extensions (the squares icon in the Activity Bar).
2. Click the `...` menu -> `Install from VSIX...`.
3. Choose `dbz-companions-local-0.10.0.vsix`. This upgrades the older `dbz-companions-local` extension.
   After upgrading, run `Developer: Reload Window` (`Ctrl+Shift+P`) so the new version is loaded. A notification confirms which version is running.
4. Open the Command Palette (`Ctrl+Shift+P`) and run **DBZ Companions: Start Coding Session**. The DBZ Arena opens in the bottom panel, under your code.
   Pick your first fighter (Goku or Vegeta). Add the second one later with the **+** button on the arena's title bar (*Add Fighter*).
5. The full view with stats and settings is the `DBZ Companions` icon in the Activity Bar.

## Features

- **They live on their own, like vscode-pets.** Goku and Vegeta walk, run, jump, fly, meditate, shadowbox, nap, power up, spar with each other and fire Kamehameha / Galick Gun blasts. Click a fighter to poke them (it cheers them up); click the ground to drop a senzu bean and they race to eat it (it feeds them).
- **Scouter HUD.** The arena shows the power level, level and form, with a thin XP bar. It turns red when the power level is over 9000.
- **Dragon Balls.** Typing code uncovers Dragon Balls: the first one is already waiting in the arena, then about one shows up every 2,250 typed characters. A ball waits on the ground in the arena; click it and your fighter runs over and picks it up (they fetch it on their own after a while). The tracker in the top right shows which of the seven you have.
- **Shenron.** Collect all seven and the sky goes dark, the eternal dragon rises and grants one wish: *Make me stronger* (+1 level) or *Restore my fighters* (full mood and energy, no hunger). Then the balls scatter and the hunt starts again.
- **Hyperbolic Time Chamber (focus timer).** The watch button on the arena's title bar starts a 15, 25 or 50 minute focus session. The arena turns into the white Time Chamber, the fighters train non-stop, the status bar counts down, typing XP is doubled, and finishing gives a bonus of 1 XP per minute. Leaving early (stop button, or click the countdown) gives no bonus.
- **Life in the sky.** Clouds drift, birds and the Flying Nimbus fly past, waves roll at Kame House, stars twinkle and shooting stars cross the night sky.
- **DBZ Arena, VS Code Pets style.** The arena lives in the bottom panel next to the terminal (set `dbzCompanions.position` to `explorer` to put it in the Explorer instead). Its title bar has *Add Fighter*, *Throw Senzu Bean*, *Ki Blast!*, *Time Chamber* and *Change Arena Background* buttons; *Remove Fighter* and *Choose Fighter* are in its `...` menu.
- **Six arenas.** The wasteland with a crashed Saiyan space pod, Planet Namek (three suns, a green sea, Ajisa trees and Namekian houses), Kame House on its beach, the Tenkaichi Budokai (the ring, the crowd and the hall), Kami's Lookout above the clouds, and the wasteland at night. *Change Arena Background* shows each arena as you move through the list; press Escape to keep the current one (`dbzCompanions.background`).
- **Super Saiyan forms.** Level up and your fighters transform, with a flash and an aura:
  - Level 5: Super Saiyan (golden hair)
  - Level 10: Super Saiyan 2 (golden hair with lightning)
  - Level 20: Super Saiyan God (red hair)
  - Level 30: Super Saiyan Blue (blue hair)
- **XP** comes from typing code (1 XP per 150 characters, pastes count like a few keystrokes), manual saves (at most one per 10 seconds), Play and Train (at most once a minute each), wishes and Time Chamber sessions.
- **Needs.** Hunger slowly rises and energy slowly drops over time (also while VS Code is closed, up to 8 hours). Hungry, tired or bored fighters tell you so.
- Fighters / Stats / Settings tabs in the full view follow your VS Code colour theme. Stats include Dragon Balls, wishes granted and Time Chamber sessions.
- Save and error reactions: only manual saves count, and the error reaction plays only when a new error appears in the active file.
- Works across several VS Code windows: they share one save and don't overwrite each other's progress.
- No external runtime dependencies or internet access required. Respects the operating system's reduced motion preference.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `dbzCompanions.position` | `panel` | Arena in the bottom panel or the Explorer |
| `dbzCompanions.background` | `wasteland` | Arena background |
| `dbzCompanions.dragonBalls` | `true` | Find Dragon Balls while you code |
| `dbzCompanions.showHud` | `true` | Show the scouter and the Dragon Ball tracker |
| `dbzCompanions.reactToSaves` | `true` | Celebrate manual saves |
| `dbzCompanions.reactToErrors` | `true` | React to new errors in the active file |

## Important limits

- The fighters are static, manually cut-out sprites, not rigged 3D models or frame-by-frame animations. Motion is CSS based.
- The arena renders in a VS Code webview (bottom panel or Explorer), not as a transparent overlay over your code.
- Do not publish/redistribute this package, character sprites, or promotional mockups. See LICENSE-NOTICE.md.

## Local development

Open this folder in VS Code and press `F5` to launch an Extension Development Host. Use `npm run check` to validate JavaScript syntax. To build a .vsix, run `npx @vscode/vsce package`.

The backgrounds and the Shenron drawing are generated: `python3 tools/scenes.py media/scenes.css` and `python3 tools/shenron.py media/shenron.js`.
