// Arena engine: Goku and Vegeta live on a stage and act on their own, like
// vscode-pets. Used by both the full view and the DBZ Arena view (see world.js).
(()=>{
  'use strict';
  const RATIO={goku:92/112,vegeta:64/112};
  const SPEED={walk:34,run:92,dash:190,fly:26};
  const GRAVITY=900;
  const FALL=150; // px/s: how fast someone left in the air floats back down
  const AUTO_FETCH=40; // seconds a Dragon Ball waits before a fighter fetches it anyway
  const LINES={
    goku:{join:'Hey, I\'m here!',greet:'Hey Vegeta!',hello:['Hey!','Hi there!','Let\'s train!'],blast:'Kamehameha!',power:'Haaaaa!',eat:'Mmm, senzu!',idle:['Hey Vegeta!','Nice code!','Let\'s go!'],
      hungry:'I\'m starving... drop a senzu!',tired:'So sleepy...',bored:'I\'m bored... poke me!',spot:'A Dragon Ball!',got:n=>`Got the ${n}-star ball!`,done:'What a workout!',enter:'Let\'s train!'},
    vegeta:{join:'Kakarot! Fight me!',greet:'Kakarot!',hello:['Hmph.','What?','Don\'t touch me.'],blast:'Galick Gun!',power:'Raaaah!',eat:'Hmph. Not bad.',idle:['Kakarot!','I\'m the prince!','Hmph.'],
      hungry:'Feed me a senzu. Now.',tired:'Even a prince needs rest.',bored:'Hmph. This is boring.',spot:'A Dragon Ball...',got:n=>`The ${n}-star ball is mine.`,done:'Again. Harder.',enter:'Finally, real training.'}
  };
  const pick=a=>Array.isArray(a)?a[Math.floor(Math.random()*a.length)]:a;
  const rand=(lo,hi)=>lo+Math.random()*(hi-lo);
  const reducedMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Dragon Ball: an orange sphere (CSS) with 1 to 7 red stars and a shine.
  const STAR_SPOTS={1:[[10,10]],2:[[7,10],[13,10]],3:[[10,6.6],[6.8,12.4],[13.2,12.4]],4:[[7,7],[13,7],[7,13],[13,13]],
    5:[[10,5.4],[5.7,8.9],[14.3,8.9],[7.4,14.2],[12.6,14.2]],6:[[6.4,7],[10,5.4],[13.6,7],[6.4,12.6],[10,14.4],[13.6,12.6]],
    7:[[10,10],[10,4.8],[14.5,7.4],[14.5,12.6],[10,15.2],[5.5,12.6],[5.5,7.4]]};
  function starPath(cx,cy,r){
    let d='';
    for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.42:r;d+=(i?'L':'M')+(cx+rr*Math.cos(a)).toFixed(2)+' '+(cy+rr*Math.sin(a)).toFixed(2);}
    return d+'Z';
  }
  function ballSvg(star){
    const r=star===1?3.8:star<=4?2.7:2.15;
    return `<svg viewBox="0 0 20 20" aria-hidden="true"><path class="db-stars" d="${(STAR_SPOTS[star]||[]).map(([x,y])=>starPath(x,y,r)).join('')}"/><ellipse class="db-shine" cx="6.6" cy="5.6" rx="2.8" ry="1.6" transform="rotate(-35 6.6 5.6)"/></svg>`;
  }

  function DBZArena(stage,opts={}){
    const art=opts.art||{};
    let look={fighters:[],form:'base',frozen:false};
    let mood={energy:70,hunger:40,training:true,chamber:false};
    const fighters=new Map();
    const beans=[];
    let ball=null,held=null;
    let W=0,H=0,last=performance.now();

    function size(){W=stage.clientWidth;H=stage.clientHeight;}
    function spriteHeight(){return Math.max(44,Math.min(look.maxHeight||opts.maxHeight||100,Math.round(H*(opts.heightRatio||.5))));}
    function groundY(){return Math.round(H*(opts.groundRatio||.11));}

    function makeFighter(name,index){
      const el=document.createElement('div');
      el.className=`fighter fighter-${name}`;
      el.innerHTML='<div class="fighter-flip"><div class="fighter-pose"><img draggable="false" alt=""></div></div><span class="fighter-shadow"></span><span class="say"></span>';
      const img=el.querySelector('img');img.alt=name==='goku'?'Goku':'Vegeta';
      stage.appendChild(el);
      const f={name,el,img,flip:el.querySelector('.fighter-flip'),sayEl:el.querySelector('.say'),
        x:0,y:0,vy:0,facing:index===0?1:-1,state:'idle',t:0,dur:rand(1,2.5),cls:'',w:0,h:0,sayUntil:0};
      el.addEventListener('click',e=>{e.stopPropagation();poke(f);});
      return f;
    }
    function layout(){
      size();
      const h=spriteHeight();
      let i=0;
      for(const f of fighters.values()){
        f.h=h;f.w=Math.round(h*RATIO[f.name]);
        f.el.style.width=f.w+'px';f.el.style.height=h+'px';f.el.style.bottom=groundY()+'px';
        // A hidden view has no size yet: wait until it has one before placing anyone.
        if(!f.placed&&W>0){
          const o=other(f);
          // A fighter who joins later lands on the side away from the one already here.
          if(f.dropIn&&o&&o.placed)f.x=o.x+o.w/2<W/2?W*.75-f.w/2:W*.25-f.w/2;
          else f.x=fighters.size===1?(W-f.w)/2:(i===0?W*.22:W*.78-f.w);
          f.placed=true;
        }
        f.x=Math.max(0,Math.min(W-f.w,f.x));i++;
      }
      placeBall();
    }
    function setLook(next){
      look={...look,...next};
      for(const [name,f] of fighters) if(!look.fighters.includes(name))removeFighter(f);
      // Only a fighter added later drops in from the sky, not both on every reload.
      const arriving=fighters.size>0;
      const joined=[];
      look.fighters.forEach((name,i)=>{
        if(fighters.has(name))return;
        const f=makeFighter(name,i);
        f.dropIn=arriving;
        fighters.set(name,f);
        if(arriving)joined.push(f);
      });
      for(const f of fighters.values()){
        const src=art[f.name]&&(art[f.name][look.form]||art[f.name].base);
        if(src&&f.img.getAttribute('src')!==src)f.img.setAttribute('src',src);
      }
      layout();
      for(const f of joined){
        f.y=Math.max(70,H*.8);f.vy=0;setState(f,'jump',9);say(f,LINES[f.name].join,2200);
        const o=other(f);if(o){face(o,f.x+f.w/2);setTimeout(()=>{if(fighters.has(o.name))say(o,LINES[o.name].greet,1600);},900);}
      }
    }
    function removeFighter(f){
      if(f.ki)f.ki.remove();
      if(held&&held.f===f){held.el.remove();held=null;}
      f.el.remove();fighters.delete(f.name);
    }
    function setMood(next){mood={...mood,...next};}

    const other=f=>{for(const g of fighters.values())if(g!==f)return g;return null;};
    function setState(f,state,dur){
      if(f.ki&&state!=='blast'){f.ki.remove();f.ki=null;}
      f.state=state;f.t=0;f.dur=dur;
      const cls='is-'+state;
      if(f.cls!==cls){if(f.cls)f.el.classList.remove(f.cls);f.el.classList.add(cls);f.cls=cls;}
    }
    function say(f,text,ms=1800){
      if(!text)return;
      f.sayEl.textContent=text;f.el.classList.add('saying');f.sayUntil=performance.now()+ms;
    }
    function face(f,x){if(Math.abs(x-(f.x+f.w/2))>2)f.facing=x>f.x+f.w/2?1:-1;}
    function nearest(x,ok=()=>true){
      let best=null;
      for(const f of fighters.values())if(ok(f)&&(!best||Math.abs(f.x+f.w/2-x)<Math.abs(best.x+best.w/2-x)))best=f;
      return best;
    }

    // Pick what to do next, weighted by how the fighter feels.
    function choose(f){
      if(look.frozen){setState(f,'idle',99);face(f,W/2);return;}
      if(reducedMotion){setState(f,Math.random()<.2?'meditate':'idle',rand(3,6));return;}
      const o=other(f),tired=mood.energy<25&&!mood.chamber,hungry=mood.hunger>=80;
      if(beans.length){goChase(f);return;}
      const w={idle:3,walk:4,run:1.3,jump:.8,fly:1,meditate:.7,power:look.form==='base'?.4:.9,blast:.6,sleep:tired?4:.05,chat:.5,train:o?.3:.9};
      if(tired){w.run=.2;w.fly=.2;w.blast=.1;w.jump=.2;w.train=.1;}
      // Inside the Hyperbolic Time Chamber nobody naps: it's all training.
      if(mood.chamber)Object.assign(w,{idle:1,walk:1.5,run:2,sleep:0,chat:.2,meditate:1.4,power:1.4,blast:1.1,train:o?1:3.5});
      if(o&&mood.training&&o.state!=='sleep'&&!busy(o))w.spar=tired?.3:mood.chamber?4:2.4;
      let total=0;for(const k in w)total+=w[k];
      let r=Math.random()*total,choice='idle';
      for(const k in w){r-=w[k];if(r<=0){choice=k;break;}}
      switch(choice){
        case 'walk':if(Math.random()<.4)f.facing*=-1;setState(f,'walk',rand(2,5));break;
        case 'run':if(Math.random()<.5)f.facing*=-1;setState(f,'run',rand(1,2.2));break;
        case 'jump':jump(f);break;
        case 'fly':setState(f,'fly',rand(3,6));break;
        case 'meditate':setState(f,'meditate',rand(3,6));break;
        case 'power':powerUp(f);break;
        case 'blast':blast(f);break;
        case 'sleep':setState(f,'sleep',rand(5,9));say(f,'Zzz...',2500);break;
        case 'chat':say(f,pick(hungry?LINES[f.name].hungry:LINES[f.name].idle));setState(f,'idle',rand(1.5,3));break;
        case 'train':setState(f,'train',rand(2,4));break;
        case 'spar':startSpar(f,o);break;
        default:setState(f,'idle',rand(1.2,3));
      }
    }
    const busy=f=>['spar','dash','recoil','hit','blast','power','eat','chase','fetch','cheer'].includes(f.state);
    function jump(f,power=1){f.vy=rand(260,330)*power;setState(f,'jump',9);}
    function powerUp(f){setState(f,'power',2);say(f,LINES[f.name].power,1600);}
    function startSpar(a,b){
      const dur=rand(4,8);
      a.sparEnd=b.sparEnd=performance.now()+dur*1000;
      setState(a,'spar',dur);setState(b,'spar',dur);
    }
    // After a hit or a punch, go back to sparring until the round is over.
    function backToSpar(f){
      const left=((f.sparEnd||0)-performance.now())/1000;
      if(other(f)&&mood.training&&left>.3&&!beans.length&&!look.frozen)setState(f,'spar',left);else choose(f);
    }
    function poke(f){
      if(look.frozen)return;
      if(f.state==='sleep'){say(f,'Huh?!');}
      else say(f,pick(LINES[f.name].hello));
      jump(f,.8);
      if(opts.onPoke)opts.onPoke(f.name);
    }

    // Ki blasts: charge a glowing ball, then fire a beam across the stage.
    function blast(f){
      setState(f,'blast',1.5);f.fired=false;
      f.ki=document.createElement('span');f.ki.className=`ki ki-${f.name}`;
      stage.appendChild(f.ki);
      say(f,LINES[f.name].blast,1500);
    }
    function updateBlast(f){
      const handX=f.x+(f.facing>0?f.w*.82:f.w*.18),handY=groundY()+f.y+f.h*.42;
      if(f.ki){f.ki.style.left=handX+'px';f.ki.style.bottom=handY+'px';f.ki.style.setProperty('--charge',Math.min(1,f.t/.7));}
      if(!f.fired&&f.t>.7){
        f.fired=true;
        const beam=document.createElement('span');
        beam.className=`beam beam-${f.name}`;
        const o=other(f),reach=f.facing>0?W-handX:handX;
        beam.style.bottom=handY+'px';
        beam.style.left=(f.facing>0?handX:0)+'px';
        beam.style.width=reach+'px';
        beam.style.transformOrigin=f.facing>0?'left center':'right center';
        stage.appendChild(beam);
        setTimeout(()=>beam.remove(),700);
        if(o&&o.y<f.h*.6&&Math.sign(o.x-f.x)===f.facing){
          setTimeout(()=>{if(fighters.has(o.name)&&!look.frozen){o.knock=f.facing;setState(o,'hit',.45);}},180);
        }
      }
      if(f.t>=f.dur&&f.ki){f.ki.remove();f.ki=null;}
    }

    function goChase(f){
      if(!beans.length)return;
      setState(f,'chase',30);
      say(f,mood.hunger>=60?LINES[f.name].hungry:'Senzu!',1200);
    }
    function dropBean(x,fromUser){
      if(!fighters.size||look.frozen)return;
      size();
      x=Math.max(8,Math.min(W-8,x==null?rand(W*.15,W*.85):x));
      const el=document.createElement('span');el.className='senzu';
      el.style.left=x+'px';el.style.bottom=H+'px';
      stage.appendChild(el);
      requestAnimationFrame(()=>{el.style.bottom=groundY()+'px';});
      beans.push({x,el,fromUser});
      setTimeout(()=>{for(const f of fighters.values())if(['idle','walk','run','fly','meditate','spar','jump','train'].includes(f.state))goChase(f);},500);
    }
    function eatBean(f,i){
      const b=beans.splice(i,1)[0];b.el.remove();
      setState(f,'eat',1.4);say(f,LINES[f.name].eat,1400);
      if(b.fromUser&&opts.onFeed)opts.onFeed();
      for(const g of fighters.values())if(g.state==='chase'&&!beans.length)setState(g,'idle',1);
    }

    // Dragon Balls: one waits on the ground until it is clicked (or for a while),
    // then the nearest fighter runs over, holds it up and it joins the collection.
    function setBall(star){
      if(ball&&ball.star===star)return;
      if(ball){ball.el.remove();ball=null;}
      if(!star)return;
      const el=document.createElement('button');
      el.type='button';el.className='dball';
      el.title=`${star}-star Dragon Ball: click to collect it`;el.setAttribute('aria-label',`${star}-star Dragon Ball`);
      el.innerHTML=ballSvg(star);
      el.addEventListener('click',e=>{e.stopPropagation();if(ball&&ball.el===el)ball.wanted=true;});
      stage.appendChild(el);
      ball={star,el,rx:rand(.12,.88),x:0,age:0,wanted:false,by:null};
      placeBall();
      setTimeout(()=>{
        if(!ball||ball.el!==el)return;
        const f=nearest(ball.x,g=>g.state!=='sleep');
        if(f){face(f,ball.x);say(f,LINES[f.name].spot,1600);}
      },1200);
    }
    function placeBall(){
      if(!ball)return;
      ball.x=ball.rx*W;ball.el.style.left=ball.x+'px';ball.el.style.bottom=groundY()+'px';
    }
    const canFetch=f=>!['hit','dash','recoil','eat','jump','blast','power','cheer'].includes(f.state);
    function updateBall(dt){
      if(held){
        held.t+=dt;const f=held.f;
        held.el.style.left=(f.x+f.w/2)+'px';held.el.style.bottom=(groundY()+f.y+f.h+2)+'px';
        if(held.t>1.5){const el=held.el;el.classList.add('gone');setTimeout(()=>el.remove(),450);held=null;}
      }
      if(!ball||look.frozen)return;
      ball.age+=dt;
      if(ball.age>AUTO_FETCH)ball.wanted=true;
      if(ball.by&&(ball.by.state!=='fetch'||!fighters.has(ball.by.name)))ball.by=null;
      if(ball.wanted&&!ball.by){
        const f=nearest(ball.x,canFetch);
        if(f){ball.by=f;if(f.state==='sleep')say(f,'Huh?!',900);setState(f,'fetch',30);}
      }
    }
    function pickUp(f){
      const b=ball;ball=null;
      b.el.disabled=true;b.el.classList.add('held');
      held={el:b.el,f,t:0};
      setState(f,'cheer',1.6);say(f,LINES[f.name].got(b.star),1700);
      if(opts.onBall)opts.onBall(b.star);
    }

    function step(f,dt){
      f.t+=dt;
      const min=0,max=W-f.w;
      switch(f.state){
        case 'walk':case 'run':{
          f.x+=f.facing*SPEED[f.state]*dt;
          if(f.x<=min||f.x>=max){f.x=Math.max(min,Math.min(max,f.x));f.facing*=-1;}
          if(f.t>=f.dur)choose(f);break;
        }
        case 'jump':{
          f.y+=f.vy*dt;f.vy-=GRAVITY*dt;
          if(f.y<=0){f.y=0;setState(f,'idle',rand(.6,1.5));}
          break;
        }
        case 'fly':{
          const target=f.t<f.dur-.6?Math.min(H*.32,f.h*.5):0;
          f.y+=(target-f.y)*Math.min(1,dt*2.5);
          f.x+=f.facing*SPEED.fly*dt;
          if(f.x<=min||f.x>=max){f.x=Math.max(min,Math.min(max,f.x));f.facing*=-1;}
          if(f.t>=f.dur)setState(f,'idle',1);break;
        }
        case 'chase':{
          if(!beans.length){setState(f,'idle',1);break;}
          let best=0;for(let i=1;i<beans.length;i++)if(Math.abs(beans[i].x-f.x)<Math.abs(beans[best].x-f.x))best=i;
          const tx=Math.max(min,Math.min(max,beans[best].x-f.w/2));face(f,beans[best].x);
          f.x+=Math.sign(tx-f.x)*Math.min(Math.abs(tx-f.x),SPEED.run*dt);
          if(Math.abs(tx-f.x)<4&&f.y<1)eatBean(f,best);
          break;
        }
        case 'fetch':{
          if(!ball||ball.by!==f){setState(f,'idle',1);break;}
          const tx=Math.max(min,Math.min(max,ball.x-f.w/2));face(f,ball.x);
          f.x+=Math.sign(tx-f.x)*Math.min(Math.abs(tx-f.x),SPEED.run*dt);
          if(Math.abs(tx-f.x)<3&&f.y<1)pickUp(f);
          break;
        }
        case 'spar':{
          const o=other(f);
          if(!o||o.state==='sleep'||!mood.training){setState(f,'idle',1);break;}
          if(beans.length){goChase(f);break;}
          face(f,o.x+o.w/2);
          const gap=Math.abs((o.x+o.w/2)-(f.x+f.w/2))-(f.w+o.w)/2;
          if(gap>36)f.x+=f.facing*SPEED.run*.7*dt;
          else if(gap<16)f.x-=f.facing*SPEED.run*.6*dt;
          f.x=Math.max(min,Math.min(max,f.x));
          // Take turns: the one who has waited longer attacks.
          if(gap<=40&&f.t>.8&&Math.random()<dt*1.6&&o.state==='spar'){
            if(Math.random()<.18&&f.t>1.5){blast(f);break;}
            setState(f,'dash',.25);
          }
          if(f.t>=f.dur)choose(f);break;
        }
        case 'dash':{
          const o=other(f);
          f.x+=f.facing*SPEED.dash*dt;f.x=Math.max(min,Math.min(max,f.x));
          if(o&&Math.abs((o.x+o.w/2)-(f.x+f.w/2))<(f.w+o.w)/2*.8&&o.state!=='hit'){
            o.knock=f.facing;setState(o,'hit',.35);setState(f,'recoil',.3);
          }else if(f.t>=f.dur)setState(f,'recoil',.25);
          break;
        }
        case 'recoil':{
          f.x-=f.facing*60*dt;f.x=Math.max(min,Math.min(max,f.x));
          if(f.t>=f.dur)backToSpar(f);break;
        }
        case 'hit':{
          f.x+=(f.knock||-f.facing)*110*dt*(1-f.t/f.dur);f.x=Math.max(min,Math.min(max,f.x));
          if(f.t>=f.dur)backToSpar(f);break;
        }
        case 'blast':updateBlast(f);if(f.t>=f.dur)(f.sparEnd>performance.now()?backToSpar(f):choose(f));break;
        default:if(f.t>=f.dur)choose(f);
      }
      // Anyone left in the air by something else (a blast, a nap, a reaction) floats back down.
      if(f.y>0&&f.state!=='jump'&&f.state!=='fly')f.y=Math.max(0,f.y-FALL*dt);
      if(f.sayUntil&&performance.now()>f.sayUntil){f.el.classList.remove('saying');f.sayUntil=0;}
    }
    // Fighters standing around shouldn't stack on top of each other.
    function separate(dt){
      const [a,b]=[...fighters.values()];
      if(!a||!b)return;
      const free=f=>!['dash','chase','eat','hit','fetch'].includes(f.state);
      const overlap=(a.w+b.w)/2*.9-Math.abs((a.x+a.w/2)-(b.x+b.w/2));
      if(overlap<=0||!free(a)||!free(b))return;
      const dir=(a.x+a.w/2)<=(b.x+b.w/2)?1:-1,push=Math.min(overlap,90*dt)/2;
      a.x=Math.max(0,Math.min(W-a.w,a.x-dir*push));b.x=Math.max(0,Math.min(W-b.w,b.x+dir*push));
    }
    function render(f){
      f.el.style.transform=`translate(${f.x.toFixed(1)}px,${(-f.y).toFixed(1)}px)`;
      f.flip.style.transform=`scaleX(${f.facing})`;
      f.el.classList.toggle('airborne',f.y>2);
      // Keep speech bubbles inside the stage near the edges.
      const mid=f.x+f.w/2;
      f.el.classList.toggle('say-left',mid>W-55);f.el.classList.toggle('say-right',mid<55);
    }
    function frame(now){
      const dt=Math.min(.05,(now-last)/1000);last=now;
      for(const f of fighters.values())step(f,dt);
      separate(dt);
      updateBall(dt);
      for(const f of fighters.values())render(f);
      requestAnimationFrame(frame);
    }

    // While Shenron is out everyone stops and looks up.
    function setFrozen(on){
      if(look.frozen===on)return;
      look.frozen=on;
      for(const b of beans.splice(0))b.el.remove();
      for(const f of fighters.values()){setState(f,'idle',on?99:rand(.4,1.2));if(on)face(f,W/2);}
    }
    // A fighter says how they feel, unless they are already talking.
    function murmur(kind){
      const free=[...fighters.values()].filter(f=>!f.sayUntil&&f.state!=='sleep');
      const f=free[Math.floor(Math.random()*free.length)];
      if(f)say(f,LINES[f.name][kind],2600);
    }

    // Events from VS Code or the controls.
    function react(kind){
      if(look.frozen)return;
      const all=[...fighters.values()];
      switch(kind){
        case 'save':all.forEach(f=>{if(f.state!=='sleep')jump(f,.9);});break;
        case 'error':all.forEach(f=>{f.knock=-f.facing;setState(f,'hit',.4);say(f,'!',1200);});break;
        case 'play':all.forEach(f=>{f.facing*=-1;setState(f,'run',rand(1.2,2));});setTimeout(()=>all.forEach(f=>jump(f)),900);break;
        case 'rest':all.forEach(f=>{setState(f,'sleep',7);say(f,'Zzz...',2500);});break;
        case 'train':{const o=all[1];if(o&&mood.training)startSpar(all[0],o);else all.forEach(blast);break;}
        case 'feed':dropBean(null,false);break;
        case 'levelup':all.forEach(f=>{jump(f,1.1);});setTimeout(()=>all.forEach(powerUp),600);break;
        case 'transform':all.forEach(f=>{f.y=0;setState(f,'power',4.4);say(f,LINES[f.name].power,2500);});break;
        case 'blast':all.forEach(blast);break;
        case 'enter':all.forEach(f=>{setState(f,'power',1.6);say(f,LINES[f.name].enter,2000);});break;
        case 'chamber':all.forEach(f=>{jump(f,1.1);});setTimeout(()=>all.forEach(f=>{setState(f,'power',2);say(f,LINES[f.name].done,2200);}),600);break;
      }
    }
    stage.addEventListener('click',e=>{
      if(e.target.closest('.fighter,.dball'))return;
      const r=stage.getBoundingClientRect();
      dropBean(e.clientX-r.left,true);
    });
    window.addEventListener('resize',layout);
    setLook(look);
    requestAnimationFrame(frame);
    return {setLook,setMood,react,dropBean,setBall,setFrozen,murmur,layout,
      say:(name,text,ms)=>{const f=fighters.get(name);if(f)say(f,text,ms);},
      lines:name=>LINES[name],names:()=>[...fighters.keys()]};
  }
  DBZArena.ballSvg=ballSvg;
  // "Choose your fighter" overlay shown until the first fighter is picked.
  function DBZChooser(el,art,onPick){
    el.querySelectorAll('img[data-art]').forEach(img=>{const a=art[img.dataset.art];if(a)img.setAttribute('src',a.base);});
    el.addEventListener('click',e=>e.stopPropagation());
    el.querySelectorAll('[data-pick]').forEach(b=>b.addEventListener('click',()=>onPick(b.dataset.pick)));
    return {show(visible){el.hidden=!visible;}};
  }
  window.DBZArena=DBZArena;
  window.DBZChooser=DBZChooser;
})();
