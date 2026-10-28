'use strict';
const vscode = require('vscode');
const path = require('path');
const crypto = require('crypto');

const INITIAL = Object.freeze({
  fighter: 'goku', fighterChosen: false, training: true, tiny: true, particles: true,
  mood: 85, energy: 70, hunger: 40, xp: 0, age: 0, lastTick: 0,
  balls: 0, ballOut: 0, ballXp: 0, wishes: 0,
  chamberUntil: 0, chamberMinutes: 0, chamberOwner: '', sessions: 0, focusTotal: 0
});
const STATE_KEY = 'visualPetState';
const VERSION = require('./package.json').version;
const WINDOW_ID = crypto.randomBytes(8).toString('hex'); // Each VS Code window has its own; the saved state is shared.
const FIGHTERS = new Set(['both','goku','vegeta']);
const BOOLEAN_OPTIONS = new Set(['training','tiny','particles']);
const ACTIONS = new Set(['feed','play','rest','train','poke']);
const OTHER = {goku:'vegeta', vegeta:'goku'};
const MINUTE = 60000;
const MAX_OFFLINE_MINUTES = 8 * 60; // Time away from VS Code counts, but only up to 8 hours.
const SAVE_XP_COOLDOWN = 10000;
const ACTION_XP_COOLDOWN = 60000; // Play and Train give XP at most once a minute each.
const POKE_COOLDOWN = 10000;
const ERROR_REACTION_COOLDOWN = 15000;
const XP_PER_LEVEL = 50;
const CHARS_PER_XP = 150;
const MAX_CHARS_PER_CHANGE = 20; // Pastes and generated edits count like a few keystrokes.
const ALL_BALLS = 0b1111111; // One bit per Dragon Ball, 1 to 7 stars.
const FIRST_BALL_XP = 3; // The first ball shows up quickly so the hunt is easy to discover...
const BALL_XP = 15;      // ...then one per 15 XP of typing (about 2,250 characters).
const CHAMBER_LENGTHS = [25, 50, 15];
const WISHES = {power:'Make me stronger', restore:'Restore my fighters'};
// Keep in sync with FORMS in media/world.js. `art` is the sprite/icon suffix.
const FORMS = [
  {id:'base', name:'Base form',         level:1,  art:'base'},
  {id:'ssj',  name:'Super Saiyan',      level:5,  art:'ssj'},
  {id:'ssj2', name:'Super Saiyan 2',    level:10, art:'ssj'},
  {id:'god',  name:'Super Saiyan God',  level:20, art:'god'},
  {id:'blue', name:'Super Saiyan Blue', level:30, art:'blue'}
];
// Arena backgrounds (drawn in media/scenes.css) and their names in the picker.
const SCENES = {wasteland:'Wasteland', namek:'Planet Namek', kamehouse:'Kame House', tournament:'Tenkaichi Budokai', lookout:"Kami's Lookout", night:'Wasteland at night'};
const FIGHTER_NAMES = {both:'Goku & Vegeta', goku:'Goku', vegeta:'Vegeta'};

function clamp(v, lo=0, hi=100) { return Math.max(lo, Math.min(hi, v)); }
function levelFor(xp) { return 1 + Math.floor(xp / XP_PER_LEVEL); }
function formFor(level) { return FORMS.filter(f => level >= f.level).pop(); }
function ballCount(bits) { let n = 0; for (let i = 0; i < 7; i++) if (bits & 1 << i) n++; return n; }
function clock(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function saneState(obj) {
  const state = { ...INITIAL };
  if (!obj || typeof obj !== 'object') return state;
  if (FIGHTERS.has(obj.fighter)) state.fighter = obj.fighter;
  for (const k of BOOLEAN_OPTIONS) if (typeof obj[k] === 'boolean') state[k] = obj[k];
  if (typeof obj.fighterChosen === 'boolean') state.fighterChosen = obj.fighterChosen;
  for (const k of ['mood','energy','hunger']) if (Number.isFinite(obj[k])) state[k] = clamp(Math.round(obj[k]));
  if (Number.isSafeInteger(obj.xp)) state.xp = clamp(obj.xp,0,1000000);
  for (const k of ['age','lastTick','ballXp','wishes','chamberUntil','sessions','focusTotal']) if (Number.isSafeInteger(obj[k]) && obj[k] >= 0) state[k] = obj[k];
  if (Number.isSafeInteger(obj.balls)) state.balls = clamp(obj.balls,0,ALL_BALLS);
  if (Number.isSafeInteger(obj.ballOut)) state.ballOut = clamp(obj.ballOut,0,7);
  if (Number.isSafeInteger(obj.chamberMinutes)) state.chamberMinutes = clamp(obj.chamberMinutes,0,240);
  if (typeof obj.chamberOwner === 'string') state.chamberOwner = obj.chamberOwner.slice(0,32);
  // A ball that is already collected can't be waiting in the arena, and none wait while Shenron does.
  if (state.ballOut && (state.balls & 1 << state.ballOut - 1 || state.balls === ALL_BALLS)) state.ballOut = 0;
  if (!state.chamberUntil) Object.assign(state, {chamberMinutes:0, chamberOwner:''});
  return state;
}
// One minute of companion life: hunger slowly rises, energy slowly drops,
// and mood suffers while they are very hungry or exhausted.
function liveMinute(state) {
  state.age += 1;
  if (state.age % 6 === 0) state.hunger = clamp(state.hunger + 1);
  if (state.age % 10 === 0) state.energy = clamp(state.energy - 1);
  if (state.age % 5 === 0 && (state.hunger >= 80 || state.energy <= 15)) state.mood = clamp(state.mood - 1);
}
class CompanionProvider {
  constructor(context) {
    this.context = context;
    this.state = saneState(context.globalState.get(STATE_KEY));
    this.webviews = new Set();
    this.arenaViews = new Set();
    this.readyViews = new WeakSet();
    this.pendingArena = null;
    this.lastErrorAt = 0;
    this.lastSaveXpAt = 0;
    this.lastPokeAt = 0;
    this.actionXpAt = {};
    this.manualSaves = new Set();
    this.errorCounts = new Map();
    this.typedChars = 0;
    this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.status.command = 'dbzCompanions.start';
    this.status.show();
    this.chamberStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    this.chamberStatus.command = 'dbzCompanions.leaveChamber';
    this.chamberStatus.tooltip = 'Hyperbolic Time Chamber: typing XP is doubled. Click to leave early.';
    this.chamberKey = '';
    this.updateStatus();
  }
  dispose() {
    clearTimeout(this.chamberTimer); clearInterval(this.chamberClock);
    this.status.dispose(); this.chamberStatus.dispose();
  }
  // VS Code windows share the saved state: start from the latest copy before changing it.
  sync() {
    const saved = this.context.globalState.get(STATE_KEY);
    if (saved) this.state = saneState(saved);
  }
  react(kind, except) {
    this.broadcast({type:'reaction',reaction:kind}, except);
  }
  async addXp(amount) {
    const before = levelFor(this.state.xp);
    this.state.xp = Math.min(1000000, this.state.xp + amount);
    const after = levelFor(this.state.xp);
    if (formFor(after) !== formFor(before)) {
      vscode.window.showInformationMessage(`${FIGHTER_NAMES[this.state.fighter]} reached ${formFor(after).name} at level ${after}!`);
    }
  }
  // Play and Train give XP at most once a minute each, so the buttons can't be farmed.
  async actionXp(kind, amount) {
    const now = Date.now();
    if (now - (this.actionXpAt[kind] || 0) < ACTION_XP_COOLDOWN) return;
    this.actionXpAt[kind] = now;
    await this.addXp(amount);
  }
  updateStatus() {
    const s = this.state, level = levelFor(s.xp), form = formFor(level);
    const next = FORMS.find(f => f.level > level);
    this.status.text = `$(flame) Lv ${level}${form.id === 'base' ? '' : ' · ' + form.name}`;
    this.status.tooltip = [`${FIGHTER_NAMES[s.fighter]}: level ${level}, ${form.name}`,
      next ? `${next.name} at level ${next.level}` : 'Maximum power reached!',
      `Dragon Balls: ${ballCount(s.balls)} of 7` + (s.ballOut ? ' (one is waiting in the arena)' : ''),
      'Click to open the DBZ Arena'].join('\n');
  }
  inChamber(now=Date.now()) { return this.state.chamberUntil > now; }
  // The countdown in the status bar and the timer that ends a Time Chamber session.
  updateChamber() {
    const s = this.state, key = `${s.chamberUntil}:${s.chamberOwner}`;
    if (key === this.chamberKey) return;
    this.chamberKey = key;
    clearTimeout(this.chamberTimer); clearInterval(this.chamberClock);
    vscode.commands.executeCommand('setContext', 'dbzCompanions.inChamber', !!s.chamberUntil).then(undefined, ()=>{});
    if (!s.chamberUntil) { this.chamberStatus.hide(); return; }
    // The window that started the session ends it; another one steps in if that window was closed.
    const grace = s.chamberOwner === WINDOW_ID ? 0 : MINUTE;
    this.chamberTimer = setTimeout(() => this.finishChamber(), Math.max(0, s.chamberUntil + grace - Date.now()));
    const show = () => { this.chamberStatus.text = `$(watch) ${clock(this.state.chamberUntil - Date.now())}`; };
    show();
    this.chamberClock = setInterval(show, 1000);
    this.chamberStatus.show();
  }
  async enterChamber() {
    this.sync();
    if (this.inChamber()) {
      const pick = await vscode.window.showInformationMessage(`You are in the Hyperbolic Time Chamber: ${clock(this.state.chamberUntil - Date.now())} left.`, 'Leave Early');
      if (pick) await this.leaveChamber(true);
      return;
    }
    const pick = await vscode.window.showQuickPick(CHAMBER_LENGTHS.map(minutes => ({
      label: `${minutes} minutes`, minutes,
      description: minutes === 25 ? 'A classic focus session' : minutes > 25 ? 'Long training' : 'Quick training'
    })), {placeHolder: 'Hyperbolic Time Chamber: train without distractions. Typing XP is doubled inside.'});
    if (!pick) return;
    this.sync();
    Object.assign(this.state, {chamberUntil: Date.now() + pick.minutes * MINUTE, chamberMinutes: pick.minutes, chamberOwner: WINDOW_ID});
    await this.persist();
    vscode.commands.executeCommand('dbzCompanions.start').then(undefined, ()=>{});
  }
  async leaveChamber(confirmed=false) {
    this.sync();
    if (!this.state.chamberUntil) return;
    if (!confirmed) {
      const pick = await vscode.window.showWarningMessage('Leave the Hyperbolic Time Chamber early? You will not get the training bonus.', {modal:true}, 'Leave');
      if (pick !== 'Leave') return;
      this.sync();
    }
    Object.assign(this.state, {chamberUntil:0, chamberMinutes:0, chamberOwner:''});
    await this.persist();
  }
  async finishChamber() {
    this.sync();
    const s = this.state;
    if (!s.chamberUntil) return;
    if (Date.now() < s.chamberUntil) { this.chamberKey = ''; this.updateChamber(); return; }
    const minutes = s.chamberMinutes;
    Object.assign(s, {chamberUntil:0, chamberMinutes:0, chamberOwner:'', sessions:s.sessions + 1, focusTotal:s.focusTotal + minutes});
    await this.addXp(minutes);
    await this.persist();
    this.react('chamber');
    vscode.window.showInformationMessage(`Time Chamber training complete: ${minutes} minutes. +${minutes} XP`);
  }
  // The very first Dragon Ball is already waiting in the arena, so the hunt is easy to discover.
  async welcomeBall() {
    this.sync();
    const s = this.state;
    if (s.balls || s.wishes || s.ballOut || !vscode.workspace.getConfiguration('dbzCompanions').get('dragonBalls', true)) return;
    s.ballOut = 1 + Math.floor(Math.random() * 7);
    await this.persist();
  }
  // Coding uncovers Dragon Balls: one waits in the arena until it is collected.
  findBalls(xp) {
    const s = this.state;
    if (!vscode.workspace.getConfiguration('dbzCompanions').get('dragonBalls', true)) return;
    if (s.ballOut || s.balls === ALL_BALLS) return;
    s.ballXp += xp;
    if (s.ballXp < (s.balls || s.wishes ? BALL_XP : FIRST_BALL_XP)) return;
    const missing = [1,2,3,4,5,6,7].filter(n => !(s.balls & 1 << n - 1));
    s.ballOut = missing[Math.floor(Math.random() * missing.length)];
    s.ballXp = 0;
  }
  async onTextChange(event) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || event.document !== editor.document) return;
    for (const change of event.contentChanges) this.typedChars += Math.min(change.text.length, MAX_CHARS_PER_CHANGE);
    if (this.typedChars < CHARS_PER_XP) return;
    const xp = Math.floor(this.typedChars / CHARS_PER_XP);
    this.typedChars %= CHARS_PER_XP;
    this.sync();
    await this.addXp(this.inChamber() ? xp * 2 : xp);
    this.findBalls(xp);
    await this.persist();
  }
  async tick(now=Date.now()) {
    const before = JSON.stringify(this.state);
    this.sync();
    if (!this.state.lastTick) { this.state.lastTick = now; await this.persist(); return; }
    const minutes = Math.floor((now - this.state.lastTick) / MINUTE);
    if (minutes > 0) {
      for (let i = 0; i < Math.min(minutes, MAX_OFFLINE_MINUTES); i++) liveMinute(this.state);
      this.state.lastTick += minutes * MINUTE;
      await this.persist();
    } else if (JSON.stringify(this.state) !== before) {
      // Another window changed something: show it here too.
      this.updateStatus(); this.updateChamber();
      this.broadcast({type:'state',state:this.state});
    }
  }
  bind(view) {
    view.webview.options = {enableScripts:true, localResourceRoots:[vscode.Uri.file(path.join(this.context.extensionPath,'media'))]};
    view.webview.html = this.html(view.webview);
    const listener = this.register(view.webview);
    view.onDidDispose(() => {this.webviews.delete(view.webview); listener.dispose();});
  }
  bindArena(view) {
    view.webview.options = {enableScripts:true, localResourceRoots:[vscode.Uri.file(path.join(this.context.extensionPath,'media'))]};
    view.webview.html = this.html(view.webview, arenaDocument);
    this.arenaViews.add(view);
    const listener = this.register(view.webview);
    view.onDidDispose(() => {this.webviews.delete(view.webview); this.arenaViews.delete(view); listener.dispose();});
  }
  // Senzu beans and ki blasts from the title bar or the Command Palette go to the
  // arena only (beans feed the fighters, so they must land in one place). It is opened if needed.
  async toArena(message) {
    const ready = () => [...this.arenaViews].find(v => v.visible && this.readyViews.has(v.webview));
    const view = ready();
    if (view) { view.webview.postMessage(message); return; }
    this.pendingArena = message;
    await vscode.commands.executeCommand('dbzCompanions.start').then(undefined, ()=>{});
    // An arena that was only hidden is ready straight away; a new one picks it up when it says "ready".
    setTimeout(() => { const v = ready(); if (v && this.pendingArena === message) { this.pendingArena = null; v.webview.postMessage(message); } }, 300);
  }
  // Like vscode-pets: start with one fighter, then add the other one.
  async setFighter(fighter) {
    this.sync();
    this.state.fighter = fighter;
    this.state.fighterChosen = true;
    await this.persist();
  }
  async chooseFighter() {
    const pick = await vscode.window.showQuickPick([
      {label:'Goku', description:'Cheerful Saiyan raised on Earth', id:'goku'},
      {label:'Vegeta', description:'Proud prince of all Saiyans', id:'vegeta'}
    ], {placeHolder:'Choose your fighter'});
    if (pick) await this.setFighter(pick.id);
  }
  async addFighter() {
    this.sync();
    if (!this.state.fighterChosen) return this.chooseFighter();
    if (this.state.fighter === 'both') {
      vscode.window.showInformationMessage('Goku and Vegeta are both in the arena already.');
      return;
    }
    await this.setFighter('both');
  }
  async removeFighter() {
    this.sync();
    if (this.state.fighter !== 'both') {
      vscode.window.showInformationMessage(`${FIGHTER_NAMES[this.state.fighter]} is your only fighter. Use "Choose Fighter" to switch.`);
      return;
    }
    const pick = await vscode.window.showQuickPick([{label:'Goku', id:'goku'}, {label:'Vegeta', id:'vegeta'}], {placeHolder:'Which fighter leaves the arena?'});
    if (pick) await this.setFighter(OTHER[pick.id]);
  }
  openBeside() {
    const panel=vscode.window.createWebviewPanel('dbzCompanions.large','DBZ Companions — Preview',vscode.ViewColumn.Beside,{
      enableScripts:true, retainContextWhenHidden:true, localResourceRoots:[vscode.Uri.file(path.join(this.context.extensionPath,'media'))]
    });
    panel.webview.html=this.html(panel.webview);
    const listener=this.register(panel.webview);
    panel.onDidDispose(()=>{this.webviews.delete(panel.webview); listener.dispose();});
  }
  config() {
    const c = vscode.workspace.getConfiguration('dbzCompanions'), scene = c.get('background','wasteland');
    return {type:'config', config:{scene:scene in SCENES ? scene : 'wasteland', hud:c.get('showHud',true), dragonBalls:c.get('dragonBalls',true)}};
  }
  register(webview) {
    this.webviews.add(webview);
    return webview.onDidReceiveMessage(async message=>{
      if (!message || typeof message !== 'object') return;
      if (message.type === 'ready') {
        this.readyViews.add(webview);
        await webview.postMessage({type:'state',state:this.state});
        await webview.postMessage(this.config());
        const pending = this.pendingArena;
        if (pending && [...this.arenaViews].some(v => v.webview === webview)) { this.pendingArena = null; webview.postMessage(pending); }
        return;
      }
      this.sync();
      const s = this.state;
      if (message.type === 'set') {
        if (message.key === 'fighter' && FIGHTERS.has(message.value)) {s.fighter=message.value;s.fighterChosen=true;}
        else if (BOOLEAN_OPTIONS.has(message.key) && typeof message.value === 'boolean') s[message.key]=message.value;
        else return;
        await this.persist();
      } else if (message.type === 'action') {
        const kind=message.action;
        if (!ACTIONS.has(kind)) return;
        if (kind === 'poke') {
          // Petting cheers them up a little.
          const now = Date.now(); if (now - this.lastPokeAt < POKE_COOLDOWN) return;
          this.lastPokeAt = now; s.mood = clamp(s.mood + 2);
          await this.persist();
          return;
        }
        if (kind === 'feed') {s.hunger=clamp(s.hunger-24);s.mood=clamp(s.mood+4);}
        if (kind === 'play') {s.mood=clamp(s.mood+14);s.energy=clamp(s.energy-7);await this.actionXp('play',5);}
        if (kind === 'rest') {s.energy=clamp(s.energy+20);s.mood=clamp(s.mood+3);}
        if (kind === 'train') {s.energy=clamp(s.energy-5);await this.actionXp('train',4);}
        await this.persist();
        // The webview that sent the action has already played its reaction.
        this.react(kind,webview);
      } else if (message.type === 'collect') {
        if (!s.ballOut) return;
        s.balls |= 1 << s.ballOut - 1;
        s.ballOut = 0;
        await this.persist();
      } else if (message.type === 'wish') {
        if (s.balls !== ALL_BALLS || !WISHES[message.wish]) return;
        if (message.wish === 'power') await this.addXp(XP_PER_LEVEL);
        if (message.wish === 'restore') Object.assign(s, {mood:100, energy:100, hunger:0});
        // The Dragon Balls scatter across the world again.
        s.balls = 0; s.ballXp = 0; s.wishes += 1;
        await this.persist();
      }
    });
  }
  onWillSave(event) {
    if (event.reason === vscode.TextDocumentSaveReason.Manual) this.manualSaves.add(event.document.uri.toString());
  }
  async onDidSave(document) {
    const key=document.uri.toString();
    const manual=this.manualSaves.delete(key);
    // Auto save and rapid Ctrl+S spam don't earn XP or trigger a reaction.
    if (!manual || !vscode.workspace.getConfiguration('dbzCompanions').get('reactToSaves',true)) return;
    const now=Date.now(); if (now-this.lastSaveXpAt < SAVE_XP_COOLDOWN) return;
    this.lastSaveXpAt=now;
    this.sync();
    await this.addXp(1);
    await this.persist();
    this.react('save');
  }
  onDiagnostics(event) {
    const active=vscode.window.activeTextEditor?.document.uri.toString();
    let newError=false;
    for (const uri of event.uris) {
      const key=uri.toString();
      const count=vscode.languages.getDiagnostics(uri).filter(d=>d.severity===vscode.DiagnosticSeverity.Error).length;
      if (key===active && count > (this.errorCounts.get(key) || 0)) newError=true;
      if (count) this.errorCounts.set(key,count); else this.errorCounts.delete(key);
    }
    if (!newError || !vscode.workspace.getConfiguration('dbzCompanions').get('reactToErrors',true)) return;
    const now=Date.now(); if (now-this.lastErrorAt < ERROR_REACTION_COOLDOWN) return;
    this.lastErrorAt=now;
    this.react('error');
  }
  async persist() {
    this.state = saneState(this.state);
    await this.context.globalState.update(STATE_KEY,this.state);
    this.updateStatus();
    this.updateChamber();
    this.broadcast({type:'state',state:this.state});
  }
  broadcast(message, except) {for(const w of this.webviews) if (w!==except) w.postMessage(message).then(undefined,()=>{});}
  html(webview, render=htmlDocument) {
    const nonce=crypto.randomBytes(16).toString('base64');
    const folder=vscode.Uri.file(path.join(this.context.extensionPath,'media'));
    const url=(p)=>webview.asWebviewUri(vscode.Uri.joinPath(folder,p)).toString();
    const csp=`default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}' ${webview.cspSource};`;
    const art={};
    for (const f of ['goku','vegeta']) {
      art[f]={base:url(`art/${f}.png`)};
      for (const form of ['ssj','god','blue']) art[f][form]=url(`art/${f}-${form}.png`);
    }
    const scene=this.config().config.scene;
    const scripts=['arena.js','shenron.js','world.js',render===arenaDocument?'arena-view.js':'app.js'].map(url);
    return render({scenes:url('scenes.css'),scene,style:url('style.css'),scripts,art:JSON.stringify(art),nonce,csp});
  }
}
// Arena background; each layer is themed and repeats sideways in media/scenes.css.
const SCENE_HTML = '<div class="scene" aria-hidden="true">' + ['sky','sun','stars','clouds','far','sea','mid','land','near','ground','mark','front'].map(c => `<i class="${c}"></i>`).join('') + '</div>';
// Shown on the stage until the first fighter is chosen.
const CHOOSER_HTML = `<div class="chooser" id="chooser" hidden>
      <p>Choose your fighter</p>
      <div class="chooser-cards">
        <button type="button" data-pick="goku"><img alt="" data-art="goku"/><span>Goku</span></button>
        <button type="button" data-pick="vegeta"><img alt="" data-art="vegeta"/><span>Vegeta</span></button>
      </div>
    </div>`;
const ICONS = {
  feed: '<path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M9 7.5c0-1.5 1-2 1-3.5M14 7.5c0-1.5 1-2 1-3.5"/>',
  play: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><path d="M16 11.5h.01M18 14h.01"/>',
  rest: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
  train: '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
const scriptTags = a => a.scripts.map(src => `<script nonce="${a.nonce}" src="${src}"></script>`).join('\n  ');
function arenaDocument(a) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="${a.csp}"/><link rel="stylesheet" href="${a.style}" /><link rel="stylesheet" href="${a.scenes}" />
    <title>DBZ Arena</title></head>
<body class="arena-view" data-art='${a.art}' data-scene="${a.scene}">
  <div class="stage" id="stage" title="Click the ground to drop a senzu bean">
    ${SCENE_HTML}
    <div class="power-flash" aria-hidden="true"></div>
    ${CHOOSER_HTML}
  </div>
  ${scriptTags(a)}
</body></html>`;
}
function htmlDocument(a) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="${a.csp}"/><link rel="stylesheet" href="${a.style}" /><link rel="stylesheet" href="${a.scenes}" />
    <title>DBZ Companions</title></head>
<body data-art='${a.art}' data-scene="${a.scene}">
  <div class="shell">
    <nav class="nav" aria-label="Companion sections">
      <button type="button" class="nav-item is-active" data-tab="characters" aria-selected="true">Fighters</button>
      <button type="button" class="nav-item" data-tab="stats" aria-selected="false">Stats</button>
      <button type="button" class="nav-item" data-tab="settings" aria-selected="false">Settings</button>
    </nav>
    <main>
      <section id="characters" class="page active" aria-label="Fighters">
        <div class="stage" id="stage">
          ${SCENE_HTML}
          <div class="power-flash" aria-hidden="true"></div>
          ${CHOOSER_HTML}
        </div>
        <div class="segmented" role="group" aria-label="Choose fighters">
          <button type="button" class="picker" data-fighter="goku">Goku</button>
          <button type="button" class="picker" data-fighter="both">Both</button>
          <button type="button" class="picker" data-fighter="vegeta">Vegeta</button>
        </div>
        <section class="stat-group" aria-label="Wellbeing">
          <div class="stat-row"><span class="stat-name">Mood</span><div class="track"><div id="moodFill" class="fill mood"></div></div><span class="stat-num" id="moodNum">85%</span></div>
          <div class="stat-row"><span class="stat-name">Energy</span><div class="track"><div id="energyFill" class="fill energy"></div></div><span class="stat-num" id="energyNum">70%</span></div>
          <div class="stat-row"><span class="stat-name">Hunger</span><div class="track"><div id="hungerFill" class="fill hunger"></div></div><span class="stat-num" id="hungerNum">40%</span></div>
        </section>
        <div class="actions">
          <button type="button" data-action="feed" class="action">${icon('feed')}Feed</button>
          <button type="button" data-action="play" class="action">${icon('play')}Play</button>
          <button type="button" data-action="rest" class="action">${icon('rest')}Rest</button>
          <button type="button" data-action="train" class="action primary">${icon('train')}Train</button>
        </div>
        <div class="event-note" id="eventNote">Watching your coding session</div>
      </section>
      <section id="stats" class="page" aria-label="Stats" hidden>
        <div class="level-head">
          <strong class="level-num" id="level">01</strong>
          <div class="level-meta"><span class="kicker">Level</span><span class="form-chip" id="formText">Base form</span></div>
        </div>
        <div class="progress"><div id="xpFill"></div></div>
        <div class="xp-line"><span id="xpText">0 XP</span><span id="nextFormText">Super Saiyan at Lv 5</span></div>
        <ol class="timeline" id="timeline">
          <li data-form="base"><span class="dot"></span>Base<small>Lv 1</small></li>
          <li data-form="ssj"><span class="dot"></span>SSJ<small>Lv 5</small></li>
          <li data-form="ssj2"><span class="dot"></span>SSJ2<small>Lv 10</small></li>
          <li data-form="god"><span class="dot"></span>God<small>Lv 20</small></li>
          <li data-form="blue"><span class="dot"></span>Blue<small>Lv 30</small></li>
        </ol>
        <div class="info-line"><span>Power level</span><strong id="powerDetail">416</strong></div>
        <div class="info-line"><span>Fighters</span><strong id="modeText">Goku + Vegeta</strong></div>
        <div class="info-line"><span>Dragon Balls</span><strong id="ballsDetail">0 of 7</strong></div>
        <div class="info-line"><span>Wishes granted</span><strong id="wishesDetail">0</strong></div>
        <div class="info-line"><span>Time Chamber</span><strong id="chamberDetail">Not yet</strong></div>
        <div class="info-line"><span>Mood</span><strong id="moodDetail">85%</strong></div>
        <div class="info-line"><span>Energy</span><strong id="energyDetail">70%</strong></div>
        <div class="info-line"><span>Hunger</span><strong id="hungerDetail">40%</strong></div>
        <p class="hint">Earn XP by typing code, saving files and training. Typing also uncovers Dragon Balls: find all seven and Shenron grants a wish.</p>
      </section>
      <section id="settings" class="page" aria-label="Settings" hidden>
        <label class="toggle-row"><input id="training" type="checkbox" checked/><span><strong>Sparring</strong><small>Goku and Vegeta spar while you code</small></span></label>
        <label class="toggle-row"><input id="tiny" type="checkbox" checked/><span><strong>Compact fighters</strong><small>Smaller sprites on the stage and in the arena</small></span></label>
        <label class="toggle-row"><input id="particles" type="checkbox" checked/><span><strong>Aura effects</strong><small>Flickering auras and lightning</small></span></label>
        <p class="hint">Save and error reactions, Dragon Balls, the scouter, the arena position and its background are in VS Code Settings under DBZ Companions.</p>
        <p class="hint">Unofficial fan project. Dragon Ball characters belong to their owners (Bird Studio, Shueisha, Toei Animation). Not for redistribution.</p>
      </section>
    </main>
  </div>
  ${scriptTags(a)}
</body></html>`;
}

function activate(context) {
  const provider=new CompanionProvider(context);
  // Errors that already exist at startup are not "new" errors.
  provider.onDiagnostics({uris:vscode.languages.getDiagnostics().map(([uri])=>uri)});
  provider.lastErrorAt=0;
  provider.tick();
  provider.updateChamber();
  provider.welcomeBall();
  // After an update, say so once: it also shows which version is running.
  if (context.globalState.get('arenaShown') && context.globalState.get('lastVersion') !== VERSION) {
    vscode.window.showInformationMessage(`DBZ Companions updated to ${VERSION}: the arenas are redrawn, and the Tenkaichi Budokai and Kami's Lookout are new.`, 'Pick an Arena')
      .then(pick => { if (pick) Promise.resolve(vscode.commands.executeCommand('dbzCompanions.start')).then(()=>vscode.commands.executeCommand('dbzCompanions.changeBackground')); }, ()=>{});
  }
  context.globalState.update('lastVersion', VERSION);
  const timer=setInterval(()=>provider.tick(),MINUTE);
  // Open the arena once after install so the fighters are visible straight away.
  if (!context.globalState.get('arenaShown')) {
    context.globalState.update('arenaShown', true);
    setTimeout(()=>vscode.commands.executeCommand('dbzCompanions.start').then(undefined,()=>{}), 1500);
  }
  context.subscriptions.push(
    {dispose:()=>clearInterval(timer)},
    provider,
    vscode.workspace.onDidChangeTextDocument(e=>provider.onTextChange(e)),
    vscode.workspace.onDidChangeConfiguration(e=>{
      if (['background','showHud','dragonBalls'].some(k=>e.affectsConfiguration('dbzCompanions.'+k))) provider.broadcast(provider.config());
    }),
    vscode.commands.registerCommand('dbzCompanions.start',()=>{
      const position=vscode.workspace.getConfiguration('dbzCompanions').get('position','panel');
      return vscode.commands.executeCommand(position==='explorer'?'dbzCompanions.arena.focus':'dbzCompanions.arenaPanel.focus');
    }),
    vscode.commands.registerCommand('dbzCompanions.changeBackground',()=>{
      const config=provider.config(), current=config.config.scene;
      const qp=vscode.window.createQuickPick();
      qp.placeholder='Arena background';
      qp.items=Object.entries(SCENES).map(([id,label])=>({label,id,description:id===current?'current':''}));
      qp.activeItems=qp.items.filter(i=>i.id===current);
      // The arena shows each background while it is highlighted; Escape puts the current one back.
      let picked=false;
      qp.onDidChangeActive(([item])=>{ if (item) provider.broadcast({...config,config:{...config.config,scene:item.id}}); });
      qp.onDidAccept(()=>{
        const [item]=qp.selectedItems; picked=!!item; qp.hide();
        if (item) vscode.workspace.getConfiguration('dbzCompanions').update('background',item.id,vscode.ConfigurationTarget.Global).then(undefined,()=>provider.broadcast(provider.config()));
      });
      qp.onDidHide(()=>{ if (!picked) provider.broadcast(provider.config()); qp.dispose(); });
      qp.show();
    }),
    vscode.window.registerWebviewViewProvider('dbzCompanions.arena',{resolveWebviewView:v=>provider.bindArena(v)},{webviewOptions:{retainContextWhenHidden:true}}),
    vscode.window.registerWebviewViewProvider('dbzCompanions.arenaPanel',{resolveWebviewView:v=>provider.bindArena(v)},{webviewOptions:{retainContextWhenHidden:true}}),
    vscode.commands.registerCommand('dbzCompanions.throwSenzu',()=>provider.toArena({type:'arena',action:'senzu'})),
    vscode.commands.registerCommand('dbzCompanions.kiBlast',()=>provider.toArena({type:'arena',action:'blast'})),
    vscode.commands.registerCommand('dbzCompanions.enterChamber',()=>provider.enterChamber()),
    vscode.commands.registerCommand('dbzCompanions.leaveChamber',()=>provider.leaveChamber()),
    vscode.window.registerWebviewViewProvider('dbzCompanions.view',{resolveWebviewView:v=>provider.bind(v)},{webviewOptions:{retainContextWhenHidden:true}}),
    vscode.commands.registerCommand('dbzCompanions.show',()=>vscode.commands.executeCommand('workbench.view.extension.dbzCompanions')),
    vscode.commands.registerCommand('dbzCompanions.openBeside',()=>provider.openBeside()),
    vscode.commands.registerCommand('dbzCompanions.chooseFighter',()=>provider.chooseFighter()),
    vscode.commands.registerCommand('dbzCompanions.addFighter',()=>provider.addFighter()),
    vscode.commands.registerCommand('dbzCompanions.removeFighter',()=>provider.removeFighter()),
    vscode.workspace.onWillSaveTextDocument(e=>provider.onWillSave(e)),
    vscode.workspace.onDidSaveTextDocument(d=>provider.onDidSave(d)),
    vscode.languages.onDidChangeDiagnostics(e=>provider.onDiagnostics(e))
  );
}
function deactivate(){}
module.exports={activate,deactivate,htmlDocument,arenaDocument,levelFor,formFor,saneState};
