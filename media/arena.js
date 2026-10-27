// Arena engine: Goku and Vegeta live on a stage and act on their own, like
// vscode-pets. Used by both the main view and the Explorer arena view.
(()=>{
  'use strict';
  const RATIO={goku:92/112,vegeta:64/112};
  const SPEED={walk:34,run:92,dash:190,fly:26};
  const GRAVITY=900;
  const LINES={
    goku:{hello:['Hey!','Hi there!','Let\'s train!'],blast:'Kamehameha!',power:'Haaaaa!',hungry:'I\'m starving...',eat:'Mmm, senzu!',idle:['Hey Vegeta!','Nice code!','Let\'s go!']},
    vegeta:{hello:['Hmph.','What?','Don\'t touch me.'],blast:'Galick Gun!',power:'Raaaah!',hungry:'Feed me, now.',eat:'Hmph. Not bad.',idle:['Kakarot!','I\'m the prince!','Hmph.']}
  };
  const pick=a=>Array.isArray(a)?a[Math.floor(Math.random()*a.length)]:a;
  const rand=(lo,hi)=>lo+Math.random()*(hi-lo);
  const reducedMotion=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function DBZArena(stage,opts={}){
    const art=opts.art||{};
    let look={fighters:['goku','vegeta'],form:'base'};
    let mood={energy:70,hunger:40,training:true};
    const fighters=new Map();
    const beans=[];
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
        if(!f.placed){f.x=fighters.size===1?(W-f.w)/2:(i===0?W*.22:W*.78-f.w);f.placed=true;}
        f.x=Math.max(0,Math.min(W-f.w,f.x));i++;
      }
    }
    function setLook(next){
      look={...look,...next};
      for(const [name,f] of fighters) if(!look.fighters.includes(name)){f.el.remove();fighters.delete(name);}
      look.fighters.forEach((name,i)=>{if(!fighters.has(name))fighters.set(name,makeFighter(name,i));});
      for(const f of fighters.values()){
        const src=art[f.name]&&(art[f.name][look.form]||art[f.name].base);
        if(src&&f.img.getAttribute('src')!==src)f.img.setAttribute('src',src);
      }
      layout();
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

    // Pick what to do next, weighted by how the fighter feels.
    function choose(f){
      if(reducedMotion){setState(f,Math.random()<.2?'meditate':'idle',rand(3,6));return;}
      const o=other(f),tired=mood.energy<25,hungry=mood.hunger>=80;
      if(beans.length){goChase(f);return;}
      const w={idle:3,walk:4,run:1.3,jump:.8,fly:1,meditate:.7,power:look.form==='base'?.4:.9,blast:.6,sleep:tired?4:.05,chat:.5};
      if(tired){w.run=.2;w.fly=.2;w.blast=.1;w.jump=.2;}
      if(o&&mood.training&&o.state!=='sleep'&&!busy(o))w.spar=tired?.3:2.4;
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
        case 'spar':startSpar(f,o);break;
        default:setState(f,'idle',rand(1.2,3));
      }
    }
    const busy=f=>['spar','dash','recoil','hit','blast','power','eat','chase'].includes(f.state);
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
      if(other(f)&&mood.training&&left>.3&&!beans.length)setState(f,'spar',left);else choose(f);
    }
    function poke(f){
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
          setTimeout(()=>{if(fighters.has(o.name)){o.knock=f.facing;setState(o,'hit',.45);}},180);
        }
      }
      if(f.t>=f.dur&&f.ki){f.ki.remove();f.ki=null;}
    }

    function goChase(f){
      if(!beans.length)return;
      setState(f,'chase',30);
      say(f,mood.hunger>=60?pick(LINES[f.name].hungry):'Senzu!',1200);
    }
    function dropBean(x,fromUser){
      size();
      if(x==null)x=rand(W*.15,W*.85);
      const el=document.createElement('span');el.className='senzu';
      el.style.left=Math.max(4,Math.min(W-12,x))+'px';el.style.bottom=H+'px';
      stage.appendChild(el);
      requestAnimationFrame(()=>{el.style.bottom=groundY()+'px';});
      beans.push({x,el,fromUser});
      setTimeout(()=>{for(const f of fighters.values())if(['idle','walk','run','fly','meditate','spar','jump'].includes(f.state))goChase(f);},500);
    }
    function eatBean(f,i){
      const b=beans.splice(i,1)[0];b.el.remove();
      setState(f,'eat',1.4);say(f,LINES[f.name].eat,1400);
      if(b.fromUser&&opts.onFeed)opts.onFeed();
      for(const g of fighters.values())if(g.state==='chase'&&!beans.length)setState(g,'idle',1);
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
          if(f.t>=f.dur){f.y=0;setState(f,'idle',1);}break;
        }
        case 'chase':{
          if(!beans.length){setState(f,'idle',1);break;}
          let best=0;for(let i=1;i<beans.length;i++)if(Math.abs(beans[i].x-f.x)<Math.abs(beans[best].x-f.x))best=i;
          const tx=beans[best].x-f.w/2;face(f,beans[best].x);
          f.x+=Math.sign(tx-f.x)*Math.min(Math.abs(tx-f.x),SPEED.run*dt);
          if(f.y>0)f.y=Math.max(0,f.y-120*dt);
          if(Math.abs(tx-f.x)<4&&f.y===0)eatBean(f,best);
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
          if(f.y>0)f.y=Math.max(0,f.y-200*dt);
          if(f.t>=f.dur)backToSpar(f);break;
        }
        case 'blast':updateBlast(f);if(f.t>=f.dur)(f.sparEnd>performance.now()?backToSpar(f):choose(f));break;
        default:if(f.t>=f.dur)choose(f);
      }
      if(f.sayUntil&&performance.now()>f.sayUntil){f.el.classList.remove('saying');f.sayUntil=0;}
    }
    // Fighters standing around shouldn't stack on top of each other.
    function separate(dt){
      const [a,b]=[...fighters.values()];
      if(!a||!b)return;
      const free=f=>!['dash','chase','eat','hit'].includes(f.state);
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
      for(const f of fighters.values())render(f);
      requestAnimationFrame(frame);
    }

    // Events from VS Code or the controls.
    function react(kind){
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
      }
    }
    stage.addEventListener('click',e=>{
      if(e.target.closest('.fighter'))return;
      const r=stage.getBoundingClientRect();
      dropBean(e.clientX-r.left,true);
    });
    window.addEventListener('resize',layout);
    setLook(look);
    requestAnimationFrame(frame);
    return {setLook,setMood,react,dropBean,say:(name,text)=>{const f=fighters.get(name);if(f)say(f,text);},layout};
  }
  window.DBZArena=DBZArena;
})();
