// The DBZ Arena view (bottom panel or Explorer): only the stage, kept in sync with the extension.
(()=>{
  'use strict';
  const api=typeof acquireVsCodeApi==='function'?acquireVsCodeApi():{postMessage(m){console.info('preview message:',m);}};
  let art={};
  try{art=JSON.parse(document.body.dataset.art||'{}');}catch{art={};}
  const stage=document.getElementById('stage');
  const world=window.DBZ.World(stage,{api,art,heightRatio:.55,groundRatio:.12,small:84,large:110,
    onPick:fighter=>api.postMessage({type:'set',key:'fighter',value:fighter}),
    onFeed:()=>api.postMessage({type:'action',action:'feed'})});
  window.addEventListener('message',e=>{
    const m=e.data;if(!m||typeof m!=='object')return;
    if(m.type==='state'&&m.state&&typeof m.state==='object')world.apply(m.state);
    if(m.type==='config'&&m.config&&typeof m.config==='object')world.setConfig(m.config);
    if(m.type==='reaction'&&typeof m.reaction==='string')world.react(m.reaction);
    if(m.type==='arena')world.arenaAction(m.action);
  });
  new ResizeObserver(()=>world.layout()).observe(stage);
  api.postMessage({type:'ready'});
})();
