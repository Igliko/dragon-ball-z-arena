// The DBZ Arena view (bottom panel or Explorer): only the stage, kept in sync with the extension.
(()=>{
  'use strict';
  const api=typeof acquireVsCodeApi==='function'?acquireVsCodeApi():{postMessage(m){console.info('preview message:',m);}};
  const FORM_ART=[[30,'blue'],[20,'god'],[5,'ssj'],[1,'base']]; // Keep in sync with FORMS in extension.js.
  const FORM_IDS=[[30,'blue'],[20,'god'],[10,'ssj2'],[5,'ssj'],[1,'base']];
  let art={};
  try{art=JSON.parse(document.body.dataset.art||'{}');}catch{art={};}
  const stage=document.getElementById('stage');
  const arena=window.DBZArena(stage,{art,heightRatio:.55,maxHeight:90,groundRatio:.12,onFeed:()=>api.postMessage({type:'action',action:'feed'})});
  const speech=document.getElementById('sceneLabel');
  const chooser=window.DBZChooser(document.getElementById('chooser'),art,fighter=>api.postMessage({type:'set',key:'fighter',value:fighter}));
  let lastLevel=null;
  function apply(state){
    const level=1+Math.floor((state.xp||0)/50);
    const id=FORM_IDS.find(([l])=>level>=l)[1];
    for(const [,f] of FORM_IDS)document.body.classList.toggle('form-'+f,f===id);
    document.body.classList.toggle('no-particles',state.particles===false);
    // Start with one fighter; the second one is added later (Add Fighter).
    const fighters=!state.fighterChosen?[]:state.fighter==='both'?['goku','vegeta']:[state.fighter];
    chooser.show(!state.fighterChosen);
    arena.setLook({fighters,form:FORM_ART.find(([l])=>level>=l)[1]});
    arena.setMood({energy:state.energy,hunger:state.hunger,training:state.training!==false});
    const need=state.hunger>=80?'So hungry... drop a senzu!':state.energy<=15?'Too tired...':'';
    document.body.classList.toggle('needs',!!need&&state.fighterChosen);if(need)speech.textContent=need;
    if(lastLevel!==null&&level>lastLevel){
      const formChanged=FORM_IDS.find(([l])=>lastLevel>=l)[1]!==id;
      flash(formChanged?'transform':'levelup');
    }
    lastLevel=level;
  }
  let flashTimer;
  function flash(kind){
    arena.react(kind);
    if(kind!=='transform')return;
    clearTimeout(flashTimer);
    document.body.dataset.reaction='idle';void document.body.offsetWidth;document.body.dataset.reaction='transform';
    flashTimer=setTimeout(()=>{document.body.dataset.reaction='idle';},4500);
  }
  window.addEventListener('message',e=>{
    const m=e.data;if(!m||typeof m!=='object')return;
    if(m.type==='state'&&m.state)apply(m.state);
    if(m.type==='reaction'&&typeof m.reaction==='string')arena.react(m.reaction);
    if(m.type==='arena'&&m.action==='senzu')arena.dropBean(null,true);
    if(m.type==='arena'&&m.action==='blast')arena.react('blast');
    if(m.type==='scene'&&typeof m.scene==='string')document.body.dataset.scene=m.scene;
  });
  new ResizeObserver(()=>arena.layout()).observe(stage);
  api.postMessage({type:'ready'});
})();
