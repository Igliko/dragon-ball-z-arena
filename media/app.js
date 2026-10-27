(()=>{
  'use strict';
  const $=sel=>document.querySelector(sel);
  const $$=sel=>Array.from(document.querySelectorAll(sel));
  const api=typeof acquireVsCodeApi==='function' ? acquireVsCodeApi() : {
    postMessage(message){console.info('preview message:',message);},getState(){return undefined;},setState(){}
  };
  const defaults={fighter:'both',tiny:true,training:true,particles:true,mood:85,energy:70,hunger:40,xp:0};
  let state={...defaults,...(api.getState()||{})};
  let reactionTimeout;
  function idleLabel(){
    if(state.hunger>=80) return 'So hungry... feed us!';
    if(state.energy<=15) return 'Too tired... need rest';
    return state.fighter==='both'&&state.training?'Training together!':'Ready to code!';
  }
  function render(){
    document.body.classList.toggle('tiny',state.tiny);
    document.body.classList.toggle('no-particles',!state.particles);
    document.body.classList.toggle('single-goku',state.fighter==='goku');
    document.body.classList.toggle('single-vegeta',state.fighter==='vegeta');
    document.body.classList.toggle('training',state.training && state.fighter==='both' && document.body.dataset.reaction!=='rest');
    $$('.picker').forEach(b=>{b.classList.toggle('selected',b.dataset.fighter===state.fighter);b.setAttribute('aria-pressed',String(b.dataset.fighter===state.fighter));});
    for(const id of ['mood','energy','hunger']){
      const value=Math.max(0,Math.min(100,Math.round(state[id])));
      $(`#${id}Num`).textContent=value+'%';$(`#${id}Fill`).style.width=value+'%';$(`#${id}Detail`).textContent=value+'%';
    }
    $('#training').checked=state.training;$('#tiny').checked=state.tiny;$('#particles').checked=state.particles;
    const level=1+Math.floor(state.xp/50);$('#level').textContent=String(level).padStart(2,'0');
    $('#xpText').textContent=`${state.xp} XP earned`;$('#xpFill').style.width=(state.xp%50)*2+'%';
    $('#modeText').textContent=({both:'Goku + Vegeta',goku:'Goku',vegeta:'Vegeta'})[state.fighter]||'Goku + Vegeta';
    if(!document.body.dataset.reaction || document.body.dataset.reaction==='idle') $('#sceneLabel').textContent=idleLabel();
    api.setState(state);
  }
  function selected(tab){
    $$('.nav-item').forEach(b=>{const is=b.dataset.tab===tab;b.classList.toggle('is-active',is);b.setAttribute('aria-selected',String(is));});
    $$('.page').forEach(p=>{const is=p.id===tab;p.classList.toggle('active',is);p.hidden=!is;});
  }
  const reactions={save:['✨','File saved! Nice work!'],error:['❗','There is an error to fix!'],feed:['🍜','Snack time!'],play:['💙','Let’s have fun!'],rest:['💤','Taking a power nap'],train:['⚔','Training session!']};
  function react(kind){
    const [symbol,label]=reactions[kind]||['✦','Ready to code!'];
    clearTimeout(reactionTimeout);
    document.body.classList.remove('reacting');document.body.dataset.reaction='idle';
    // Restart CSS animations for repeated events.
    void document.body.offsetWidth;
    document.body.dataset.reaction=kind;
    document.body.classList.add('reacting');
    $('#bubble').textContent=symbol;$('#sceneLabel').textContent=label;$('#eventNote').textContent=label;
    render();
    reactionTimeout=setTimeout(()=>{
      document.body.classList.remove('reacting'); document.body.dataset.reaction='idle';
      $('#eventNote').textContent='Watching your coding session';render();
    },kind==='rest'?6000:2700);
  }
  const clamp=n=>Math.max(0,Math.min(100,n));
  function localAction(kind){
    if(kind==='feed'){state.hunger=clamp(state.hunger-24);state.mood=clamp(state.mood+4);}
    if(kind==='play'){state.mood=clamp(state.mood+14);state.energy=clamp(state.energy-7);state.xp+=5;}
    if(kind==='rest'){state.energy=clamp(state.energy+20);state.mood=clamp(state.mood+3);}
    if(kind==='train'){state.energy=clamp(state.energy-5);state.xp+=4;}
    render(); react(kind);api.postMessage({type:'action',action:kind});
  }
  $$('.nav-item').forEach(b=>b.addEventListener('click',()=>selected(b.dataset.tab)));
  $$('.picker').forEach(b=>b.addEventListener('click',()=>{state.fighter=b.dataset.fighter;render();api.postMessage({type:'set',key:'fighter',value:state.fighter});}));
  $$('.action').forEach(b=>b.addEventListener('click',()=>localAction(b.dataset.action)));
  $('#trainButton').addEventListener('click',()=>localAction('train'));
  for(const name of ['training','tiny','particles']) $('#'+name).addEventListener('change',event=>{state[name]=event.target.checked;render();api.postMessage({type:'set',key:name,value:state[name]});});
  window.addEventListener('message',event=>{
    const m=event.data; if(!m||typeof m!=='object') return;
    if(m.type==='state'&&m.state&&typeof m.state==='object'){state={...defaults,...m.state};render();}
    if(m.type==='reaction'&&reactions[m.reaction])react(m.reaction);
  });
  render();selected('characters');api.postMessage({type:'ready'});
})();
