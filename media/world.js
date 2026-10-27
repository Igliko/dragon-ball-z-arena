// The arena world, shared by the full view and the DBZ Arena view: the fighters,
// a scouter HUD, Dragon Balls and Shenron, the Time Chamber and life in the sky.
(()=>{
  'use strict';
  // Keep in sync with FORMS in extension.js. `art` is the sprite suffix.
  const FORMS=[
    {id:'base',name:'Base form',level:1,art:'base'},
    {id:'ssj',name:'Super Saiyan',level:5,art:'ssj'},
    {id:'ssj2',name:'Super Saiyan 2',level:10,art:'ssj'},
    {id:'god',name:'Super Saiyan God',level:20,art:'god'},
    {id:'blue',name:'Super Saiyan Blue',level:30,art:'blue'}
  ];
  const ALL_BALLS=127;
  const levelFor=xp=>1+Math.floor((xp||0)/50);
  const formFor=level=>FORMS.filter(f=>level>=f.level).pop();
  // Power level as a scouter would read it: 416 at level 1, over 9000 at level 20.
  const powerFor=level=>Math.round(416*Math.pow(1.18,level-1));
  const ballCount=bits=>{let n=0;for(let i=0;i<7;i++)if(bits&1<<i)n++;return n;};
  const inChamber=s=>(s.chamberUntil||0)>Date.now();
  const rand=(lo,hi)=>lo+Math.random()*(hi-lo);
  const clock=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
  const reducedMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const WISHES=[['power','Make me stronger','+1 level'],['restore','Restore my fighters','Full energy and mood']];

  const HUD_HTML=`<div class="hud" aria-label="Scouter">
      <div class="hud-row">PWR<b class="hud-power">416</b></div>
      <div class="hud-row">LV<b class="hud-level">1</b><span class="hud-form">Base form</span></div>
      <div class="hud-row hud-chamber" hidden>Time chamber<b class="hud-clock">0:00</b></div>
      <i class="hud-xp"><i></i></i>
    </div>
    <div class="balls" hidden>${[1,2,3,4,5,6,7].map(n=>`<i data-star="${n}"></i>`).join('')}</div>
    <div class="sky-life" aria-hidden="true"></div>
    <div class="warp" aria-hidden="true"></div>`;
  const BIRDS='<svg viewBox="0 0 64 26"><path class="bird" d="M2 12q5-6 10 0q5-6 10 0"/><path class="bird b2" d="M26 4q4-5 8 0q4-5 8 0"/><path class="bird b3" d="M44 16q4-5 8 0q4-5 8 0"/></svg>';
  const NIMBUS='<svg viewBox="0 0 70 28"><g class="nimbus-body"><path class="nimbus-trail" d="M2 15h20M8 21h15M11 9h12"/><path class="nimbus-cloud" d="M27 21c-5 0-6-6-1-7 0-5 6-7 9-4 2-5 10-5 12 0 4-2 9 1 8 5 5 0 6 6 1 6Z"/></g></svg>';

  function DBZWorld(stage,opts){
    const api=opts.api;
    let state={},config={scene:document.body.dataset.scene||'wasteland',hud:true,dragonBalls:true};
    let known=false,summon=null,wish=null,leaving=null,later=null,clockTimer=0,flashTimer=0;
    const arena=window.DBZArena(stage,{art:opts.art,heightRatio:opts.heightRatio,groundRatio:opts.groundRatio,
      onFeed:opts.onFeed,
      onPoke:()=>api.postMessage({type:'action',action:'poke'}),
      onBall:()=>api.postMessage({type:'collect'})});
    const chooser=window.DBZChooser(stage.querySelector('.chooser'),opts.art,opts.onPick);
    stage.insertAdjacentHTML('beforeend',HUD_HTML);
    stage.style.setProperty('--ground',(opts.groundRatio*100)+'%');
    const q=sel=>stage.querySelector(sel);
    const tracker=q('.balls'),slots=[...tracker.children],life=q('.sky-life'),warpEl=q('.warp');

    // live=false for a cached copy shown before the extension's state arrives:
    // nothing is celebrated until two real updates can be compared.
    function apply(next,live=true){
      const prev=state;state={...next};
      const level=levelFor(state.xp),form=formFor(level),chosen=!!state.fighterChosen;
      for(const f of FORMS)document.body.classList.toggle('form-'+f.id,f===form);
      document.body.classList.toggle('no-particles',state.particles===false);
      document.body.classList.toggle('unchosen',!chosen);
      chooser.show(!chosen);
      arena.setLook({fighters:!chosen?[]:state.fighter==='both'?['goku','vegeta']:[state.fighter],form:form.art,maxHeight:state.tiny===false?opts.large:opts.small});
      arena.setMood({energy:state.energy,hunger:state.hunger,training:state.training!==false,chamber:inChamber(state)});
      hud(level,form);
      balls(known?prev:state);
      // Celebrate what changed since the last update (not on the first one).
      if(known&&live){
        const before=levelFor(prev.xp);
        if(level>before){
          const kind=formFor(before)!==form?'transform':'levelup';
          celebrate(kind);
          if(opts.onProgress)opts.onProgress(kind,level,form,before);
        }
        if(!prev.chamberUntil!==!state.chamberUntil){warp();if(state.chamberUntil)arena.react('enter');}
      }
      scene();
      if(live)known=true;
    }
    function setConfig(next){
      config={...config,...next};
      document.body.classList.toggle('no-hud',config.hud===false);
      scene();balls(state);
    }
    function scene(){document.body.dataset.scene=inChamber(state)?'chamber':config.scene;}

    // Scouter: power level, level and form, XP to the next level, Time Chamber countdown.
    function hud(level,form){
      q('.hud-power').textContent=powerFor(level).toLocaleString('en-US');
      q('.hud-level').textContent=String(level);
      q('.hud-form').textContent=form.name;
      q('.hud-xp i').style.width=((state.xp||0)%50)*2+'%';
      document.body.classList.toggle('over9000',powerFor(level)>9000);
      const on=inChamber(state);
      q('.hud-chamber').hidden=!on;
      clearInterval(clockTimer);
      if(on){
        const tick=()=>{q('.hud-clock').textContent=clock(state.chamberUntil-Date.now());if(!inChamber(state)){clearInterval(clockTimer);scene();}};
        tick();clockTimer=setInterval(tick,1000);
      }
    }

    // Dragon Balls: the tracker, the ball waiting on the ground, and Shenron once all seven are found.
    function balls(prev){
      const on=config.dragonBalls!==false&&!!state.fighterChosen;
      const bits=state.balls||0;
      tracker.hidden=!on;
      tracker.title=`Dragon Balls: ${ballCount(bits)} of 7`;
      slots.forEach((el,i)=>{
        const got=!!(bits&1<<i);
        if(got&&!((prev.balls||0)&1<<i)){el.classList.remove('new');void el.offsetWidth;el.classList.add('new');}
        el.classList.toggle('got',got);
      });
      arena.setBall(on&&bits!==ALL_BALLS?state.ballOut||0:0);
      shenron(on&&bits===ALL_BALLS);
    }
    function shenron(show){
      if(show&&!summon){
        summon=document.createElement('div');summon.className='summon';
        summon.innerHTML='<div class="summon-sky"></div><div class="summon-beam"></div>'+(window.DBZShenronSvg||'')+
          '<div class="summon-balls">'+[1,2,3,4,5,6,7].map(n=>`<span class="sr-ball">${window.DBZArena.ballSvg(n)}</span>`).join('')+'</div>';
        wish=document.createElement('div');wish.className='wish';wish.hidden=true;
        wish.innerHTML='<p>Speak your wish</p><div class="wish-options">'+
          WISHES.map(([id,label,detail])=>`<button type="button" data-wish="${id}"><strong>${label}</strong><small>${detail}</small></button>`).join('')+'</div>'+
          '<p class="granted" hidden>Your wish has been granted.</p>';
        for(const el of [summon,wish]){el.addEventListener('click',e=>e.stopPropagation());stage.appendChild(el);}
        wish.querySelectorAll('[data-wish]').forEach(b=>b.addEventListener('click',()=>{
          wish.querySelectorAll('button').forEach(x=>{x.disabled=true;});
          api.postMessage({type:'wish',wish:b.dataset.wish});
        }));
        arena.setFrozen(true);
        const w=wish;
        setTimeout(()=>{for(const name of arena.names())arena.say(name,'Shenron!',1800);},1600);
        setTimeout(()=>{if(w.isConnected&&!w.classList.contains('done'))w.hidden=false;},reducedMotion?0:3300);
      }else if(!show&&summon){
        const s=summon,w=wish;summon=wish=null;
        // Hidden by the setting while the wish is still pending: just put it away.
        if((state.balls||0)===ALL_BALLS){s.remove();w.remove();arena.setFrozen(false);return;}
        w.hidden=false;w.classList.add('done');
        w.querySelector('.wish-options').hidden=true;w.querySelector('p').hidden=true;w.querySelector('.granted').hidden=false;
        s.classList.add('leaving');leaving=s;
        setTimeout(()=>w.remove(),1600);
        setTimeout(()=>{
          s.remove();leaving=null;arena.setFrozen(false);
          // A level-up from the wish is celebrated once the dragon is gone.
          if(later){const kind=later;later=null;setTimeout(()=>celebrate(kind),300);}
        },3400);
      }
    }

    function celebrate(kind){
      if(summon||leaving){if(later!=='transform')later=kind;return;}
      arena.react(kind);
      if(kind!=='transform')return;
      document.body.dataset.reaction='idle';void document.body.offsetWidth;document.body.dataset.reaction='transform';
      clearTimeout(flashTimer);
      flashTimer=setTimeout(()=>{document.body.dataset.reaction='idle';},4500);
    }
    // White flash when stepping into or out of the Hyperbolic Time Chamber.
    function warp(){warpEl.classList.remove('on');void warpEl.offsetWidth;warpEl.classList.add('on');}

    // Life in the sky: birds, the Flying Nimbus, shooting stars at night.
    function flyby(){
      setTimeout(flyby,rand(35000,80000));
      const scene=document.body.dataset.scene,w=stage.clientWidth;
      if(reducedMotion||scene==='chamber'||!w||summon)return;
      const kind=scene==='night'?'shoot':Math.random()<.35?'nimbus':'birds',rtl=Math.random()<.5;
      const el=document.createElement('div');
      el.className=`flyby ${kind}${rtl?' rtl':''}`;
      if(kind==='shoot'){
        const x=rand(w*.1,w*.7);
        el.style.top=rand(4,22)+'%';
        el.style.setProperty('--from',x+'px');el.style.setProperty('--to',(rtl?x-160:x+160)+'px');
      }else{
        el.innerHTML=kind==='birds'?BIRDS:NIMBUS;
        el.style.top=rand(6,kind==='nimbus'?34:24)+'%';
        el.style.setProperty('--from',(rtl?w+20:-90)+'px');el.style.setProperty('--to',(rtl?-90:w+20)+'px');
        el.style.animationDuration=(kind==='birds'?rand(14,20):rand(4,6))+'s';
      }
      el.addEventListener('animationend',e=>{if(e.target===el)el.remove();});
      life.appendChild(el);
    }
    setTimeout(flyby,rand(5000,10000));
    // Fighters tell you when they need something.
    setInterval(()=>{
      if(!state.fighterChosen||summon)return;
      if(state.hunger>=80)arena.murmur('hungry');
      else if(state.energy<=15)arena.murmur('tired');
      else if(state.mood<=20)arena.murmur('bored');
    },17000);

    return {apply,setConfig,layout:()=>arena.layout(),
      react:kind=>arena.react(kind),
      arenaAction:action=>{if(action==='senzu')arena.dropBean(null,true);if(action==='blast')arena.react('blast');}};
  }
  window.DBZ={FORMS,ALL_BALLS,levelFor,formFor,powerFor,ballCount,World:DBZWorld};
})();
