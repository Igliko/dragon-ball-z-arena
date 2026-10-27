(()=>{
  'use strict';
  const $=sel=>document.querySelector(sel);
  const $$=sel=>Array.from(document.querySelectorAll(sel));
  const api=typeof acquireVsCodeApi==='function' ? acquireVsCodeApi() : {
    postMessage(message){console.info('preview message:',message);},getState(){return undefined;},setState(){}
  };
  const {FORMS,levelFor,formFor,powerFor,ballCount}=window.DBZ;
  const defaults={fighter:'goku',fighterChosen:false,tiny:true,training:true,particles:true,mood:85,energy:70,hunger:40,xp:0,
    balls:0,ballOut:0,wishes:0,chamberUntil:0,sessions:0,focusTotal:0};
  let state={...defaults,...(api.getState()||{})};
  let noteTimeout,live=false;
  const fighterName=()=>({both:'Goku & Vegeta',goku:'Goku',vegeta:'Vegeta'})[state.fighter]||'Goku & Vegeta';
  let art={};
  try{art=JSON.parse(document.body.dataset.art||'{}');}catch{art={};}
  const world=window.DBZ.World($('#stage'),{api,art,heightRatio:.5,groundRatio:.11,small:82,large:100,
    onPick:pickFighter,
    onFeed:()=>localAction('feed',false),
    onProgress:(kind,level,form,before)=>note(kind==='transform'?`${fighterName()} went ${form.name}!`
      :powerFor(level)>9000&&powerFor(before)<=9000?'It\'s over 9000!':`Level ${level}! Power rising!`,kind==='transform'?4500:2700)});
  function pickFighter(fighter){state.fighter=fighter;state.fighterChosen=true;render();api.postMessage({type:'set',key:'fighter',value:fighter});}
  function render(){
    world.apply(state,live);
    $$('.picker').forEach(b=>{b.classList.toggle('selected',state.fighterChosen&&b.dataset.fighter===state.fighter);b.setAttribute('aria-pressed',String(b.dataset.fighter===state.fighter));});
    for(const id of ['mood','energy','hunger']){
      const value=Math.max(0,Math.min(100,Math.round(state[id])));
      $(`#${id}Num`).textContent=value+'%';$(`#${id}Fill`).style.width=value+'%';$(`#${id}Detail`).textContent=value+'%';
    }
    $('#training').checked=state.training;$('#tiny').checked=state.tiny;$('#particles').checked=state.particles;
    const level=levelFor(state.xp),form=formFor(level),next=FORMS.find(f=>f.level>level);
    $('#level').textContent=String(level).padStart(2,'0');
    $('#formText').textContent=form.name;
    $('#nextFormText').textContent=next?`Next: ${next.name} at Lv ${next.level}`:'Maximum power!';
    $('#xpText').textContent=`${state.xp%50} / 50 XP`;$('#xpFill').style.width=(state.xp%50)*2+'%';
    $('#modeText').textContent=fighterName();
    $('#powerDetail').textContent=powerFor(level).toLocaleString('en-US');
    $$('#timeline li').forEach(li=>{
      const f=FORMS.find(x=>x.id===li.dataset.form);
      li.classList.toggle('reached',level>=f.level);li.classList.toggle('current',f===form);
    });
    $('#ballsDetail').textContent=`${ballCount(state.balls)} of 7`;
    $('#wishesDetail').textContent=String(state.wishes);
    $('#chamberDetail').textContent=state.sessions?`${state.sessions} ${state.sessions===1?'session':'sessions'} · ${state.focusTotal} min`:'Not yet';
    api.setState(state);
  }
  function selected(tab){
    $$('.nav-item').forEach(b=>{const is=b.dataset.tab===tab;b.classList.toggle('is-active',is);b.setAttribute('aria-selected',String(is));});
    $$('.page').forEach(p=>{const is=p.id===tab;p.classList.toggle('active',is);p.hidden=!is;});
  }
  function note(text,ms=2700){
    clearTimeout(noteTimeout);
    $('#eventNote').textContent=text;
    noteTimeout=setTimeout(()=>{$('#eventNote').textContent='Watching your coding session';},ms);
  }
  const labels={save:'Saved! Nice work.',error:'Hm, an error to fix.',feed:'Thanks for the food!',play:'That was fun!',rest:'Power nap...',train:'Hyaaa!',chamber:'Time Chamber training complete!'};
  function react(kind,animate=true){
    if(animate)world.react(kind);
    if(labels[kind])note(labels[kind],kind==='rest'?6000:2700);
  }
  const clamp=n=>Math.max(0,Math.min(100,n));
  // animate=false when the arena already showed it (a senzu bean clicked onto the stage).
  // XP is left to the extension, which decides whether the action earns any.
  function localAction(kind,animate=true){
    if(kind==='feed'){state.hunger=clamp(state.hunger-24);state.mood=clamp(state.mood+4);}
    if(kind==='play'){state.mood=clamp(state.mood+14);state.energy=clamp(state.energy-7);}
    if(kind==='rest'){state.energy=clamp(state.energy+20);state.mood=clamp(state.mood+3);}
    if(kind==='train'){state.energy=clamp(state.energy-5);}
    render();react(kind,animate);api.postMessage({type:'action',action:kind});
  }
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>selected(b.dataset.tab)));
  $$('.picker').forEach(b=>b.addEventListener('click',()=>pickFighter(b.dataset.fighter)));
  $$('.action').forEach(b=>b.addEventListener('click',()=>localAction(b.dataset.action)));
  for(const name of ['training','tiny','particles']) $('#'+name).addEventListener('change',event=>{state[name]=event.target.checked;render();api.postMessage({type:'set',key:name,value:state[name]});});
  window.addEventListener('message',event=>{
    const m=event.data; if(!m||typeof m!=='object') return;
    if(m.type==='state'&&m.state&&typeof m.state==='object'){state={...defaults,...m.state};live=true;render();}
    if(m.type==='reaction'&&typeof m.reaction==='string')react(m.reaction);
    if(m.type==='config'&&m.config&&typeof m.config==='object')world.setConfig(m.config);
    if(m.type==='arena')world.arenaAction(m.action);
  });
  render();selected('characters');api.postMessage({type:'ready'});
})();
