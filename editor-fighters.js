'use strict';
// Goku and Vegeta inside the code editor.
//
// VS Code has no API for drawing sprites over the editor, so (like Power Mode)
// each fighter is a decoration whose CSS is injected through `textDecoration`:
// an absolutely positioned element with the sprite as a background image.
// Every animation frame re-sends the decorations with new positions.
//
// Modes (dbzCompanions.editorFighters):
//   walk   - roam along the bottom of the visible code, like pets on a floor
//   cursor - stand next to the line you are editing
//   off
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

const HEIGHT = 56;
const WIDTH = {goku: 46, vegeta: 32}; // Aspect ratio of media/art/mini sprites.
const FRAME_MS = 90;
const SPEED = {walk: 4, run: 13}; // characters per second
const GRAVITY = 520; // px/s²

const rand = (lo, hi) => lo + Math.random() * (hi - lo);

class EditorFighters {
  constructor(context) {
    this.context = context;
    this.type = vscode.window.createTextEditorDecorationType({rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed});
    this.images = new Map();
    this.look = {fighters: ['goku', 'vegeta'], art: 'base'};
    this.fighters = new Map();
    this.lastEditor = undefined;
    this.timer = undefined;
    this.lastFrame = Date.now();
    this.hopUntil = 0;
    this.decorated = new Set();
    this.setLook(this.look);
  }
  dispose() {
    clearInterval(this.timer);
    this.type.dispose();
  }
  mode() {
    const config = vscode.workspace.getConfiguration('dbzCompanions');
    if (config.get('editorBuddy', true) === false) return 'off';
    return config.get('editorFighters', 'walk');
  }
  image(name, art) {
    const key = `${name}-${art}`;
    if (!this.images.has(key)) {
      const file = path.join(this.context.extensionPath, 'media', 'art', 'mini', `${key}.png`);
      this.images.set(key, `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`);
    }
    return this.images.get(key);
  }
  setLook(look) {
    this.look = {...this.look, ...look};
    for (const name of [...this.fighters.keys()]) if (!this.look.fighters.includes(name)) this.fighters.delete(name);
    this.look.fighters.forEach((name, i) => {
      if (!this.fighters.has(name)) {
        this.fighters.set(name, {name, x: i === 0 ? 4 : 24, y: 0, vy: 0, facing: i === 0 ? 1 : -1,
          state: 'idle', t: 0, dur: rand(1, 3), shake: 0});
      }
    });
    this.refresh();
  }
  // Focusing a webview, the terminal or a panel leaves no active text editor;
  // keep the fighters on the last editor while it is still on screen.
  editor() {
    const active = vscode.window.activeTextEditor;
    if (active) return (this.lastEditor = active);
    return vscode.window.visibleTextEditors.includes(this.lastEditor) ? this.lastEditor : undefined;
  }
  refresh() {
    const mode = this.mode();
    const animate = mode === 'walk' && this.editor();
    if (animate && !this.timer) {
      this.lastFrame = Date.now();
      this.timer = setInterval(() => this.frame(), FRAME_MS);
    } else if (!animate && this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.draw();
  }

  // Events from the extension.
  react(kind) {
    const all = [...this.fighters.values()];
    if (kind === 'type') {
      if (this.mode() === 'cursor') { this.hop(); return; }
      for (const f of all) if (f.state === 'idle' && f.y === 0 && Math.random() < .3) this.jump(f, .45);
      return;
    }
    if (kind === 'save') all.forEach(f => this.jump(f, 1));
    if (kind === 'error') all.forEach(f => this.set(f, 'hit', .6));
    if (kind === 'transform' || kind === 'levelup') all.forEach(f => this.set(f, 'power', kind === 'transform' ? 2.5 : 1.2));
    if (kind === 'play') all.forEach(f => { f.facing *= -1; this.set(f, 'run', rand(1.5, 2.5)); });
    if (kind === 'rest') all.forEach(f => this.set(f, 'sleep', 6));
    if (this.mode() === 'cursor') this.hop();
  }
  hop() {
    if (Date.now() < this.hopUntil) return;
    this.hopUntil = Date.now() + 140;
    this.draw();
    setTimeout(() => this.draw(), 150);
  }
  set(f, state, dur) { f.state = state; f.t = 0; f.dur = dur; }
  jump(f, power) { f.vy = rand(150, 190) * power; this.set(f, 'jump', 5); }

  // Walk mode: a tiny state machine per fighter, like the arena but simpler.
  frame() {
    if (!vscode.window.state.focused) return; // Don't burn CPU in the background.
    const now = Date.now(), dt = Math.min(.2, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const maxX = this.floorWidth();
    for (const f of this.fighters.values()) {
      f.t += dt;
      const wch = WIDTH[f.name] / 8; // rough width in characters
      switch (f.state) {
        case 'walk': case 'run':
          f.x += f.facing * SPEED[f.state] * dt;
          if (f.x <= 0 || f.x >= maxX - wch) { f.x = Math.max(0, Math.min(maxX - wch, f.x)); f.facing *= -1; }
          break;
        case 'jump':
          f.y += f.vy * dt; f.vy -= GRAVITY * dt;
          if (f.y <= 0) { f.y = 0; this.set(f, 'idle', rand(.5, 1.5)); }
          break;
        case 'hit': f.shake = Math.sin(f.t * 60) * .4; break;
        case 'power': f.shake = Math.sin(f.t * 80) * .15; break;
      }
      if (f.state !== 'jump' && f.t >= f.dur) { f.shake = 0; this.choose(f); }
    }
    this.draw();
  }
  choose(f) {
    const r = Math.random();
    if (r < .45) { if (Math.random() < .4) f.facing *= -1; this.set(f, 'walk', rand(2, 6)); }
    else if (r < .75) this.set(f, 'idle', rand(1.5, 4));
    else if (r < .87) { if (Math.random() < .5) f.facing *= -1; this.set(f, 'run', rand(.8, 1.6)); }
    else this.jump(f, rand(.6, 1));
  }
  floorWidth() {
    const editor = this.editor();
    if (!editor) return 80;
    const [range] = editor.visibleRanges;
    let longest = 0;
    if (range) for (let n = range.start.line; n <= range.end.line && n < editor.document.lineCount; n++) {
      longest = Math.max(longest, editor.document.lineAt(n).text.length);
    }
    return Math.max(60, Math.min(120, longest + 12));
  }
  // The line the fighters stand on: the bottom of the visible code, or the top
  // when you are typing down there.
  floorLine(editor) {
    const doc = editor.document, [range] = editor.visibleRanges;
    const first = range ? range.start.line : 0;
    let floor = Math.min(doc.lineCount - 1, range ? Math.max(first, range.end.line - 1) : doc.lineCount - 1);
    const cursor = editor.selection.active.line;
    if (cursor >= floor - 3 && cursor <= floor && floor - first > 8) floor = first + 3;
    return Math.max(0, floor);
  }

  css(f, {left, marginLeft, top}) {
    return [
      'none', 'position:absolute', 'display:inline-block',
      left !== undefined ? `left:${left}` : `margin-left:${marginLeft}`, `top:${top}`,
      `width:${WIDTH[f.name]}px`, `height:${HEIGHT}px`,
      `background:url(${this.image(f.name, this.look.art)}) no-repeat center bottom / contain`,
      `transform:scaleX(${f.facing})${f.state === 'sleep' ? ' scaleY(.9)' : ''}`,
      `filter:${f.state === 'power' ? 'drop-shadow(0 0 6px #ffd23f)' : f.state === 'hit' ? 'brightness(1.6)' : 'none'}`,
      'pointer-events:none', 'z-index:5'
    ].join(';');
  }
  draw() {
    const mode = this.mode(), editor = this.editor();
    for (const ed of this.decorated) if (ed !== editor || mode === 'off') ed.setDecorations(this.type, []);
    this.decorated.clear();
    if (mode === 'off' || !editor) return;
    const options = mode === 'walk' ? this.walkOptions(editor) : this.cursorOptions(editor);
    editor.setDecorations(this.type, options);
    this.decorated.add(editor);
  }
  walkOptions(editor) {
    const line = this.floorLine(editor), start = new vscode.Position(line, 0);
    return [...this.fighters.values()].map(f => {
      const x = Math.round((f.x + f.shake) * 4) / 4;
      return {range: new vscode.Range(start, start), renderOptions: {before: {contentText: '​',
        textDecoration: this.css(f, {left: `${x}ch`, top: `calc(100% - ${HEIGHT + Math.round(f.y)}px)`})}}};
    });
  }
  cursorOptions(editor) {
    const doc = editor.document, line = editor.selection.active.line;
    // Near the top of the file there is no room above the line, so hang below it.
    const place = line < 3 ? 'below' : Date.now() < this.hopUntil ? 'hop' : 'stand';
    const top = {stand: `calc(100% - ${HEIGHT}px)`, hop: `calc(100% - ${HEIGHT + 8}px)`, below: '100%'}[place];
    // Stand clear of the text on the neighbouring lines the sprites overlap.
    const tab = Number(editor.options?.tabSize) || 4;
    const width = n => doc.lineAt(n).text.replace(/\t/g, ' '.repeat(tab)).length;
    const near = place === 'below' ? [line + 1, line + 2, line + 3] : [line - 1, line - 2];
    const longest = Math.max(0, ...near.filter(n => n >= 0 && n < doc.lineCount).map(width));
    const gapCh = 3 + Math.ceil(Math.max(0, longest - width(line)) / 4) * 4;
    const end = doc.lineAt(line).range.end;
    let offset = 0;
    return [...this.fighters.values()].map(f => {
      const css = this.css({...f, facing: 1, state: 'idle'}, {marginLeft: `calc(${gapCh}ch + ${offset}px)`, top});
      offset += WIDTH[f.name] + 4;
      return {range: new vscode.Range(end, end), renderOptions: {after: {contentText: '​', textDecoration: css}}};
    });
  }
}

module.exports = {EditorFighters};
