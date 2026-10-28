# Dragon Ball Z Arena

Goku and Vegeta live in an arena under your code, like VS Code Pets. They train, spar, nap and fire Kamehameha blasts on their own, level up into Super Saiyan forms while you code, hunt the Dragon Balls with you and keep you company in the Hyperbolic Time Chamber, a focus timer.

*Unofficial fan project, not affiliated with or endorsed by Bird Studio, Shueisha or Toei Animation.*

## Getting started

1. After you install it, the Dragon Ball Z Arena opens in the bottom panel, next to the terminal. To open it again, run **Dragon Ball Z Arena: Start Coding Session** from the Command Palette (`Ctrl+Shift+P`, or `Cmd+Shift+P` on macOS).
2. Pick your first fighter, Goku or Vegeta. Add the second one later with the **+** button on the arena's title bar (*Add Fighter*).
3. Keep coding. Your fighter levels up as you type, and the first Dragon Ball is already waiting in the arena.

The full view with stats and settings is the Dragon Ball Z Arena icon in the Activity Bar.

## Features

- **They live on their own, like VS Code Pets.** Goku and Vegeta walk, run, jump, fly, meditate, shadowbox, nap, power up, spar with each other and fire Kamehameha / Galick Gun blasts. Click a fighter to poke them (it cheers them up); click the ground to drop a senzu bean and they race to eat it (it feeds them).
- **Scouter HUD.** The arena shows the power level, level and form, with a thin XP bar. It turns red when the power level is over 9000.
- **Dragon Balls.** Typing code uncovers Dragon Balls: the first one is already waiting in the arena, then about one shows up every 2,250 typed characters. Click a ball and your fighter runs over and picks it up (they fetch it on their own after a while). The tracker in the top right shows which of the seven you have.
- **Shenron.** Collect all seven and the sky goes dark, the eternal dragon rises and grants one wish: *Make me stronger* (+1 level) or *Restore my fighters* (full mood and energy, no hunger). Then the balls scatter and the hunt starts again.
- **Hyperbolic Time Chamber (focus timer).** The watch button on the arena's title bar starts a 15, 25 or 50 minute focus session. The arena turns into the white Time Chamber, the fighters train non-stop, the status bar counts down, typing XP is doubled, and finishing gives a bonus of 1 XP per minute. Leaving early (stop button, or click the countdown) gives no bonus.
- **Six arenas.** The wasteland with a crashed Saiyan space pod, Planet Namek (three suns, a green sea, Ajisa trees and Namekian houses), Kame House on its beach, the Tenkaichi Budokai (the ring, the crowd and the hall), Kami's Lookout above the clouds, and the wasteland at night. *Change Arena Background* shows each arena as you move through the list; press Escape to keep the current one.
- **Life in the sky.** Clouds drift, birds and the Flying Nimbus fly past, waves roll at Kame House, stars twinkle and shooting stars cross the night sky.
- **Super Saiyan forms.** Level up and your fighters transform, with a flash and an aura:
  - Level 5: Super Saiyan (golden hair)
  - Level 10: Super Saiyan 2 (golden hair with lightning)
  - Level 20: Super Saiyan God (red hair)
  - Level 30: Super Saiyan Blue (blue hair)
- **XP** comes from typing code (1 XP per 150 characters; pastes count like a few keystrokes), manual saves (at most one per 10 seconds), Play and Train (at most once a minute each), wishes and Time Chamber sessions.
- **Needs.** Hunger slowly rises and energy slowly drops over time (also while VS Code is closed, up to 8 hours). Hungry, tired or bored fighters tell you so.
- **Reactions.** Fighters celebrate manual saves and react when a new error appears in the active file.
- **The arena's title bar** has *Add Fighter*, *Throw Senzu Bean*, *Ki Blast!*, *Time Chamber* and *Change Arena Background* buttons; *Remove Fighter* and *Choose Fighter* are in its `...` menu.
- The Fighters, Stats and Settings tabs in the full view follow your VS Code colour theme. Stats include Dragon Balls, wishes granted and Time Chamber sessions.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `dbzCompanions.position` | `panel` | Arena in the bottom panel or the Explorer |
| `dbzCompanions.background` | `wasteland` | Arena background |
| `dbzCompanions.dragonBalls` | `true` | Find Dragon Balls while you code |
| `dbzCompanions.showHud` | `true` | Show the scouter and the Dragon Ball tracker |
| `dbzCompanions.reactToSaves` | `true` | Celebrate manual saves |
| `dbzCompanions.reactToErrors` | `true` | React to new errors in the active file |

## Good to know

- The arena lives in a VS Code view (the bottom panel or the Explorer); nothing is drawn over your code.
- The fighters are illustrated cutouts animated with CSS, not frame-by-frame sprite sheets.
- Works offline: no network access and no telemetry. Progress is saved in VS Code and shared by all your windows.
- Respects your operating system's reduced motion setting.

## Fan project notice

Dragon Ball Z Arena is a free, unofficial fan project. It is not affiliated with, endorsed, sponsored or approved by Bird Studio, Shueisha, Toei Animation or any other Dragon Ball rights holder. Dragon Ball, Dragon Ball Z and all related names and characters belong to their respective owners. No official artwork or logos are used. If you represent a rights holder and want something changed or removed, please contact the publisher through this Marketplace page.

## Development

Open this folder in VS Code and press `F5` to launch an Extension Development Host. `npm run check` validates the JavaScript syntax, and `npx @vscode/vsce package` builds a .vsix.

The backgrounds and the Shenron drawing are generated: `python3 tools/scenes.py media/scenes.css` and `python3 tools/shenron.py media/shenron.js`. The Marketplace icon, `assets/icon.png`, is `assets/icon.svg` rendered at 256 × 256.
