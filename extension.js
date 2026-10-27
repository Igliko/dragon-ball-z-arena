'use strict';
const vscode = require('vscode');
const path = require('path');
const crypto = require('crypto');

const INITIAL = Object.freeze({
  fighter: 'both', training: true, tiny: true, particles: true,
  mood: 85, energy: 70, hunger: 40, xp: 0, age: 0, lastTick: 0
});
const FIGHTERS = new Set(['both','goku','vegeta']);
const BOOLEAN_OPTIONS = new Set(['training','tiny','particles']);
const MINUTE = 60000;
const MAX_OFFLINE_MINUTES = 8 * 60; // Time away from VS Code counts, but only up to 8 hours.
const SAVE_XP_COOLDOWN = 10000;
const ERROR_REACTION_COOLDOWN = 15000;

function clamp(v, lo=0, hi=100) { return Math.max(lo, Math.min(hi, v)); }
function saneState(obj) {
  const state = { ...INITIAL };
  if (!obj || typeof obj !== 'object') return state;
  if (FIGHTERS.has(obj.fighter)) state.fighter = obj.fighter;
  for (const k of BOOLEAN_OPTIONS) if (typeof obj[k] === 'boolean') state[k] = obj[k];
  for (const k of ['mood','energy','hunger']) if (Number.isFinite(obj[k])) state[k] = clamp(Math.round(obj[k]));
  if (Number.isSafeInteger(obj.xp)) state.xp = clamp(obj.xp,0,1000000);
  for (const k of ['age','lastTick']) if (Number.isSafeInteger(obj[k]) && obj[k] >= 0) state[k] = obj[k];
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
    this.state = saneState(context.globalState.get('visualPetState'));
    this.webviews = new Set();
    this.lastErrorAt = 0;
    this.lastSaveXpAt = 0;
    this.manualSaves = new Set();
    this.errorCounts = new Map();
  }
  async tick(now=Date.now()) {
    if (!this.state.lastTick) { this.state.lastTick = now; await this.persist(); return; }
    const minutes = Math.floor((now - this.state.lastTick) / MINUTE);
    if (minutes <= 0) return;
    for (let i = 0; i < Math.min(minutes, MAX_OFFLINE_MINUTES); i++) liveMinute(this.state);
    this.state.lastTick += minutes * MINUTE;
    await this.persist();
  }
  bind(view) {
    view.webview.options = {enableScripts:true, localResourceRoots:[vscode.Uri.file(path.join(this.context.extensionPath,'media'))]};
    view.webview.html = this.html(view.webview);
    const listener = this.register(view.webview);
    view.onDidDispose(() => {this.webviews.delete(view.webview); listener.dispose();});
  }
  openBeside() {
    const panel=vscode.window.createWebviewPanel('dbzCompanions.large','DBZ Companions — Preview',vscode.ViewColumn.Beside,{
      enableScripts:true, retainContextWhenHidden:true, localResourceRoots:[vscode.Uri.file(path.join(this.context.extensionPath,'media'))]
    });
    panel.webview.html=this.html(panel.webview);
    const listener=this.register(panel.webview);
    panel.onDidDispose(()=>{this.webviews.delete(panel.webview); listener.dispose();});
  }
  register(webview) {
    this.webviews.add(webview);
    return webview.onDidReceiveMessage(async message=>{
      if (!message || typeof message !== 'object') return;
      if (message.type === 'ready') { await webview.postMessage({type:'state',state:this.state}); return; }
      if (message.type === 'set') {
        if (message.key === 'fighter' && FIGHTERS.has(message.value)) this.state.fighter=message.value;
        else if (BOOLEAN_OPTIONS.has(message.key) && typeof message.value === 'boolean') this.state[message.key]=message.value;
        else return;
        await this.persist();
      } else if (message.type === 'action') {
        const kind=message.action;
        if (!['feed','play','rest','train'].includes(kind)) return;
        if (kind === 'feed') {this.state.hunger=clamp(this.state.hunger-24);this.state.mood=clamp(this.state.mood+4);}
        if (kind === 'play') {this.state.mood=clamp(this.state.mood+14);this.state.energy=clamp(this.state.energy-7);this.state.xp+=5;}
        if (kind === 'rest') {this.state.energy=clamp(this.state.energy+20);this.state.mood=clamp(this.state.mood+3);}
        if (kind === 'train') {this.state.energy=clamp(this.state.energy-5);this.state.xp+=4;}
        await this.persist();
        // The webview that sent the action has already played its reaction.
        this.broadcast({type:'reaction',reaction:kind},webview);
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
    this.state.xp=Math.min(1000000,this.state.xp+1);
    await this.persist();
    this.broadcast({type:'reaction',reaction:'save'});
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
    this.broadcast({type:'reaction',reaction:'error'});
  }
  async persist() {
    this.state = saneState(this.state);
    await this.context.globalState.update('visualPetState',this.state);
    this.broadcast({type:'state',state:this.state});
  }
  broadcast(message, except) {for(const w of this.webviews) if (w!==except) w.postMessage(message).then(undefined,()=>{});}
  html(webview) {
    const nonce=crypto.randomBytes(16).toString('base64');
    const folder=vscode.Uri.file(path.join(this.context.extensionPath,'media'));
    const url=(p)=>webview.asWebviewUri(vscode.Uri.joinPath(folder,p)).toString();
    const csp=`default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}' ${webview.cspSource};`;
    return htmlDocument({style:url('style.css'),script:url('app.js'),goku:url('art/goku.png'),vegeta:url('art/vegeta.png'),nonce,csp});
  }
}
function htmlDocument(a) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="${a.csp}"/><link rel="stylesheet" href="${a.style}" />
    <title>DBZ Companions</title></head>
<body>
  <div class="shell">
    <header class="header"><span class="brand-icon" aria-hidden="true">✦</span><div class="brand-copy"><strong>DBZ Companions</strong><span>Your tiny coding partners</span></div><span class="version">v0.2</span></header>
    <nav class="nav" aria-label="Companion sections">
      <button type="button" class="nav-item is-active" data-tab="characters" aria-selected="true">Characters</button>
      <button type="button" class="nav-item" data-tab="stats" aria-selected="false">Stats</button>
      <button type="button" class="nav-item" data-tab="settings" aria-selected="false">Settings</button>
    </nav>
    <main>
      <section id="characters" class="page active" aria-label="Characters">
        <div class="stage-wrap">
          <div class="stage" id="stage">
            <div class="stage-grid"></div><div class="halo halo-a"></div><div class="halo halo-b"></div>
            <div class="fighting-ring"></div><div class="stage-stars" aria-hidden="true"><i>✦</i><i>✧</i><i>✦</i></div>
            <div class="fighter fighter-goku" id="goku"><div class="fighter-pose"><img draggable="false" alt="Chibi Goku" src="${a.goku}"/></div><span class="fighter-shadow"></span></div>
            <div class="fighter fighter-vegeta" id="vegeta"><div class="fighter-pose"><img draggable="false" alt="Chibi Vegeta" src="${a.vegeta}"/></div><span class="fighter-shadow"></span></div>
            <span class="reaction-bubble" id="bubble" aria-hidden="true">⚡</span>
            <span class="stage-label" id="sceneLabel">Ready to train!</span>
          </div>
        </div>
        <div class="fighter-picker" aria-label="Select characters">
          <button type="button" class="picker" data-fighter="goku"><img src="${a.goku}" alt=""/><span>Goku</span></button>
          <button type="button" class="picker" data-fighter="both"><span class="duo-thumbs"><img src="${a.goku}" alt=""/><img src="${a.vegeta}" alt=""/></span><span>Both</span></button>
          <button type="button" class="picker" data-fighter="vegeta"><img src="${a.vegeta}" alt=""/><span>Vegeta</span></button>
        </div>
        <section class="stat-group compact" aria-label="Character wellbeing">
          <div class="stat-row"><span class="stat-name">❤️ <span>Mood</span></span><div class="track"><div id="moodFill" class="fill blue"></div></div><span class="stat-num" id="moodNum">85%</span></div>
          <div class="stat-row"><span class="stat-name">⚡ <span>Energy</span></span><div class="track"><div id="energyFill" class="fill amber"></div></div><span class="stat-num" id="energyNum">70%</span></div>
          <div class="stat-row"><span class="stat-name">🍜 <span>Hunger</span></span><div class="track"><div id="hungerFill" class="fill orange"></div></div><span class="stat-num" id="hungerNum">40%</span></div>
        </section>
        <div class="actions"><button type="button" data-action="feed" class="action blue-action"><span>🍚</span> Feed</button><button type="button" data-action="play" class="action teal-action"><span>🎮</span> Play</button><button type="button" data-action="rest" class="action purple-action"><span>☾</span> Rest</button></div>
        <button type="button" id="trainButton" class="train-button"><span>⚔</span><span>Training session</span><span class="keyhint">GO</span></button>
        <div class="event-note"><span class="event-led"></span><span id="eventNote" aria-live="polite">Watching your coding session</span></div>
      </section>
      <section id="stats" class="page" aria-label="Stats" hidden>
        <div class="section-kicker">FIGHTER STATUS</div>
        <div class="level-card"><span>Current level</span><strong id="level">01</strong><span id="xpText">0 XP earned</span><div class="progress"><div id="xpFill"></div></div><small>Earn XP by saving files and training.</small></div>
        <div class="info-line"><span>🥋 Character mode</span><strong id="modeText">Goku + Vegeta</strong></div>
        <div class="info-line"><span>💙 Mood</span><strong id="moodDetail">85%</strong></div>
        <div class="info-line"><span>⚡ Energy</span><strong id="energyDetail">70%</strong></div>
        <div class="info-line"><span>🍜 Hunger</span><strong id="hungerDetail">40%</strong></div>
        <div class="info-note">This is a visual fan prototype. Stats are playful, not linked to code quality.</div>
      </section>
      <section id="settings" class="page" aria-label="Settings" hidden>
        <div class="section-kicker">APPEARANCE & BEHAVIOR</div>
        <label class="toggle-row"><span><strong>Training animations</strong><small>Friendly sparring while you code</small></span><input id="training" type="checkbox" checked/><span class="switch"></span></label>
        <label class="toggle-row"><span><strong>Tiny characters</strong><small>Keep companions compact</small></span><input id="tiny" type="checkbox" checked/><span class="switch"></span></label>
        <label class="toggle-row"><span><strong>Energy effects</strong><small>Sparks and light trails</small></span><input id="particles" type="checkbox" checked/><span class="switch"></span></label>
        <div class="settings-note">Save reactions and error reactions are configurable in VS Code Settings under <b>DBZ Companions</b>.</div>
        <div class="copyright-note">Unofficial local fan concept. Dragon Ball characters are the property of their respective owners. Not licensed, affiliated with, or endorsed by Toei Animation, Bird Studio or Shueisha. Do not redistribute this package.</div>
      </section>
    </main>
    <footer class="footer"><span>●</span> LOCAL FAN DEMO <span class="footer-spacer"></span> <span id="statusText">Online</span></footer>
  </div>
  <script nonce="${a.nonce}" src="${a.script}"></script>
</body></html>`;
}

function activate(context) {
  const provider=new CompanionProvider(context);
  // Errors that already exist at startup are not "new" errors.
  provider.onDiagnostics({uris:vscode.languages.getDiagnostics().map(([uri])=>uri)});
  provider.lastErrorAt=0;
  provider.tick();
  const timer=setInterval(()=>provider.tick(),MINUTE);
  context.subscriptions.push(
    {dispose:()=>clearInterval(timer)},
    vscode.window.registerWebviewViewProvider('dbzCompanions.view',{resolveWebviewView:v=>provider.bind(v)},{webviewOptions:{retainContextWhenHidden:true}}),
    vscode.commands.registerCommand('dbzCompanions.show',()=>vscode.commands.executeCommand('workbench.view.extension.dbzCompanions')),
    vscode.commands.registerCommand('dbzCompanions.openBeside',()=>provider.openBeside()),
    vscode.workspace.onWillSaveTextDocument(e=>provider.onWillSave(e)),
    vscode.workspace.onDidSaveTextDocument(d=>provider.onDidSave(d)),
    vscode.languages.onDidChangeDiagnostics(e=>provider.onDiagnostics(e))
  );
}
function deactivate(){}
module.exports={activate,deactivate,htmlDocument};
