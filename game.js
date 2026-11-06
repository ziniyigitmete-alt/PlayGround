(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const ui = { time:$('timeValue'), rings:$('ringValue'), score:$('scoreValue'), speed:$('speedFill'), speedLabel:$('speedLabel'), start:$('startOverlay'), pause:$('pauseOverlay'), end:$('endOverlay'), toast:$('toast') };
  let W=innerWidth,H=innerHeight,DPR=1, last=0, elapsed=0, camera=0, score=0, rings=0, toastTimer=0;
  const WORLD=6500;
  const keys={left:false,right:false,jump:false,boost:false};
  const player={x:100,y:0,vx:0,vy:0,r:18,onGround:false,face:1,spin:0,invuln:0,anim:0,dead:false};
  let mode='ready';
  const ringList=[], enemies=[], springs=[], particles=[];
  const pits=[[1820,1945],[3210,3350],[4660,4795],[5570,5685]];
  const rampList=[[560,890,-42],[1060,1360,28],[1450,1660,-54],[2180,2480,-68],[2720,2970,22],[3500,3800,-60],[4100,4380,30],[4930,5240,-74],[5850,6130,-38]];
  function resize(){W=innerWidth;H=innerHeight;DPR=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0)}
  addEventListener('resize',resize,{passive:true});resize();
  const baseGround=()=>H*.77;
  function groundAt(x){let y=baseGround();for(const [a,b,d] of rampList){if(x>=a&&x<=b){let t=(x-a)/(b-a);y+=d*Math.sin(Math.PI*t)}}return y}
  function inPit(x){return pits.some(([a,b])=>x>a&&x<b)}
  function initWorld(){
    ringList.length=0;enemies.length=0;springs.length=0;particles.length=0;
    for(let start=230;start<WORLD-200;start+=190){
      const count=3+(Math.floor(start/190)%4);const arc=(Math.floor(start/190)%3===1);const pitNear=pits.some(([a,b])=>start>a-100&&start<b+20);if(pitNear)continue;
      for(let j=0;j<count;j++){let t=count===1?0:j/(count-1);let x=start+j*25;let y=groundAt(x)-43-(arc?Math.sin(t*Math.PI)*58:0);ringList.push({x,y,got:false,phase:Math.random()*6.28})}
    }
    for(const x of [740,1510,2440,2870,3900,4370,5180,6040])enemies.push({x,y:0,alive:true,phase:Math.random()*6});
    for(const x of [1260,2650,3770,5100])springs.push({x,y:0,active:true});
  }
  initWorld();
  function reset(){player.x=100;player.y=groundAt(100)-player.r;player.vx=player.vy=0;player.onGround=true;player.face=1;player.spin=0;player.invuln=0;player.dead=false;camera=0;elapsed=0;score=0;rings=0;initWorld();updateHUD()}
  function start(){if(mode==='ready'||mode==='over'){reset()}mode='play';ui.start.classList.add('hidden');ui.pause.classList.add('hidden');ui.end.classList.add('hidden');last=performance.now()}
  function pause(){if(mode==='play'){mode='pause';ui.pause.classList.remove('hidden')}else if(mode==='pause'){mode='play';ui.pause.classList.add('hidden');last=performance.now()}}
  $('startBtn').addEventListener('click',start);$('resumeBtn').addEventListener('click',pause);$('restartBtn').addEventListener('click',start);$('pauseBtn').addEventListener('click',pause);
  function setKey(code,value){if(code==='ArrowLeft'||code==='KeyA')keys.left=value;if(code==='ArrowRight'||code==='KeyD')keys.right=value;if(code==='Space'||code==='ArrowUp'||code==='KeyW')keys.jump=value;if(code==='ShiftLeft'||code==='ShiftRight'||code==='KeyX')keys.boost=value}
  addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','Space'].includes(e.code))e.preventDefault();if(e.code==='Escape'||e.code==='KeyP'){pause();return}setKey(e.code,true);if(mode==='ready'&&e.code==='Enter')start()});addEventListener('keyup',e=>setKey(e.code,false));
  document.querySelectorAll('[data-control]').forEach(btn=>{const control=btn.dataset.control;const down=e=>{e.preventDefault();keys[control]=true;btn.classList.add('pressed');try{btn.setPointerCapture(e.pointerId)}catch(_){}};const up=e=>{e.preventDefault();keys[control]=false;btn.classList.remove('pressed')};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('lostpointercapture',up)});
  function showToast(text){ui.toast.textContent=text;ui.toast.classList.add('show');toastTimer=1.2}
  function updateHUD(){ui.time.textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;ui.rings.textContent=String(rings).padStart(2,'0');ui.score.textContent=String(score).padStart(6,'0');const sp=Math.min(1,Math.abs(player.vx)/520);ui.speed.style.width=`${sp*100}%`;ui.speedLabel.textContent=String(Math.round(sp*100))}
  function endGame(won){mode='over';$('endTitle').textContent=won?'NICE RUN!':'TRY AGAIN';$('endCopy').textContent=won?'The coast is yours. You kept the island in motion.':'Every great run has a reset. The coast is still waiting.';$('endRings').textContent=String(rings).padStart(2,'0');$('endScore').textContent=String(score).padStart(6,'0');ui.end.classList.remove('hidden')}
  function addParticle(x,y,color,n=8,speed=180){for(let i=0;i<n;i++){let a=Math.random()*Math.PI*2,v=40+Math.random()*speed;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-40,life:.45+Math.random()*.55,max:.9,size:2+Math.random()*4,color})}}
  let jumpLatch=false;
  function update(dt){if(mode!=='play')return;elapsed+=dt;if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)ui.toast.classList.remove('show')}
    const p=player;const input=(keys.right?1:0)-(keys.left?1:0);const boosting=keys.boost&&Math.abs(p.vx)>80;
    if(input){p.face=input;p.vx+=input*(p.onGround?1500:700)*dt}else if(p.onGround){p.vx*=Math.pow(.0007,dt)}
    const maxSpeed=boosting?650:470;p.vx=Math.max(-maxSpeed,Math.min(maxSpeed,p.vx));if(boosting){p.vx+=p.face*380*dt;addParticle(p.x-p.face*19,p.y+5,'#ffda69',1,20)}
    const wantsJump=keys.jump;if(wantsJump&&!jumpLatch&&p.onGround){p.vy=-570-(Math.abs(p.vx)>330?45:0);p.onGround=false;p.spin=1;addParticle(p.x,p.y+16,'#fff0b0',5,90)}jumpLatch=wantsJump;
    p.vy+=1500*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.anim+=dt*(5+Math.abs(p.vx)*.025);p.spin=Math.max(0,p.spin-dt*.42);if(p.invuln>0)p.invuln-=dt;
    p.x=Math.max(30,Math.min(WORLD-30,p.x));let gy=groundAt(p.x);
    if(p.y+p.r>=gy&&!inPit(p.x)&&p.vy>=0){p.y=gy-p.r;p.vy=0;p.onGround=true;p.spin=0}else p.onGround=false;
    if(p.y>H+170){p.x=Math.max(100,p.x-260);p.y=groundAt(p.x)-120;p.vx=0;p.vy=0;p.invuln=2;score=Math.max(0,score-250);showToast('BACK IN THE RUN')}
    // Ring pickup, spring launches and friendly stomp interactions.
    for(const r of ringList){if(!r.got&&Math.hypot(p.x-r.x,p.y-r.y)<30){r.got=true;rings++;score+=100;addParticle(r.x,r.y,'#ffe16a',5,100);if(rings%10===0)showToast('10 RINGS — KEEP IT UP!')}}
    for(const s of springs){if(s.active&&Math.abs(p.x-s.x)<25&&p.y+p.r>=groundAt(s.x)-6&&p.vy>=0){p.y=groundAt(s.x)-p.r-2;p.vy=-790;p.vx+=p.face*90;p.onGround=false;s.active=false;addParticle(s.x,groundAt(s.x)-12,'#ffca65',12,180);showToast('SPRING BOOST!')}}
    for(const e of enemies){if(!e.alive)continue;e.y=groundAt(e.x)-18;if(Math.abs(p.x-e.x)<31&&Math.abs(p.y-e.y)<30){if(p.vy>80&&p.y<e.y){e.alive=false;p.vy=-370;score+=500;addParticle(e.x,e.y,'#f77c66',12,170);showToast('NICE STOMP +500')}else if(p.invuln<=0){p.invuln=1.35;if(rings>0){const lost=Math.min(10,rings);rings-=lost;showToast(`RING SPILL −${lost}`);for(let n=0;n<lost;n++)addParticle(p.x,p.y,'#ffd85c',1,100)}else{p.vx=-p.face*250;p.vy=-300;showToast('WATCH YOUR STEP')}}}}
    if(p.x>WORLD-150){score+=Math.max(0,Math.floor(rings*50));endGame(true)}
    camera=Math.max(0,Math.min(WORLD-W,p.x-W*.36));for(const q of particles){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=400*dt;q.life-=dt}for(let i=particles.length-1;i>=0;i--)if(particles[i].life<=0)particles.splice(i,1);
    score+=Math.floor(Math.abs(p.vx)*dt*.035);updateHUD();
  }
  function roundedRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
  function drawBackground(){let sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#53bfe5');sky.addColorStop(.52,'#9be5df');sky.addColorStop(1,'#e1f3cb');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
    const sunX=W*.78-camera*.035,sunY=H*.25;let glow=ctx.createRadialGradient(sunX,sunY,5,sunX,sunY,Math.min(W,H)*.29);glow.addColorStop(0,'#fff4c8aa');glow.addColorStop(1,'#fff4c800');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#ffe9a8';ctx.beginPath();ctx.arc(sunX,sunY,Math.min(W,H)*.075,0,Math.PI*2);ctx.fill();
    // Wind-swept cloud ribbons
    for(let i=0;i<6;i++){let x=((i*230-camera*.14)%(W+260)+W+260)%(W+260)-90,y=H*(.15+(i%3)*.1);ctx.fillStyle='#effff2aa';ctx.beginPath();ctx.ellipse(x,y,48,8,0,0,Math.PI*2);ctx.ellipse(x+25,y-3,27,9,0,0,Math.PI*2);ctx.fill()}
    drawDistantIslands('#5db4bf',.13,H*.52,90,42);drawDistantIslands('#4da398',.25,H*.61,115,52);
  }
  function drawDistantIslands(color,rate,y,spacing,amp){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,H);for(let x=-spacing;x<=W+spacing;x+=spacing/2){let wx=x+camera*rate;let h=Math.sin(wx*.008)*amp+Math.sin(wx*.021)*amp*.3;ctx.lineTo(x,y-h)}ctx.lineTo(W,H);ctx.closePath();ctx.fill()}
  function drawGround(){const bottom=H+120;ctx.beginPath();ctx.moveTo(0,bottom);for(let sx=0;sx<=W+12;sx+=12){let wx=camera+sx;let y=groundAt(wx);if(inPit(wx))y=bottom;ctx.lineTo(sx,y)}ctx.lineTo(W,bottom);ctx.closePath();let g=ctx.createLinearGradient(0,H*.68,0,H);g.addColorStop(0,'#79cf6b');g.addColorStop(.14,'#399f66');g.addColorStop(.15,'#87533b');g.addColorStop(1,'#593d43');ctx.fillStyle=g;ctx.fill();
    ctx.beginPath();for(let sx=0;sx<=W+12;sx+=12){let wx=camera+sx,y=inPit(wx)?bottom:groundAt(wx);if(sx===0)ctx.moveTo(sx,y);else ctx.lineTo(sx,y)}ctx.strokeStyle='#c2ed85';ctx.lineWidth=7;ctx.stroke();
    // Checkerboard soil strata and bright grass dashes.
    for(let sx=-((camera%42)+42)%42;sx<W;sx+=42){let wx=camera+sx;if(inPit(wx))continue;let y=groundAt(wx);ctx.fillStyle=((Math.floor(wx/42)%2)===0)?'#9a6040':'#80513e';ctx.fillRect(sx,y+20,21,17);ctx.fillStyle='#b17748';ctx.fillRect(sx+21,y+20,21,17);ctx.fillStyle='#60bd67';ctx.fillRect(sx,y+10,42,10);ctx.fillStyle='#d5f17e';ctx.fillRect(sx+7,y+8,15,2);ctx.fillRect(sx+30,y+11,7,2)}
    // Pit warning lip stripes
    for(const [a,b] of pits){for(const x of [a,b]){let sx=x-camera;if(sx>-20&&sx<W+20){ctx.fillStyle='#ffbd56';ctx.fillRect(sx-8,groundAt(x)-7,16,6);ctx.fillStyle='#fff0b5';ctx.fillRect(sx-6,groundAt(x)-7,5,6)}}}
  }
  function drawPalm(x,y,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.strokeStyle='#79563c';ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(-11,-35,2,-77);ctx.stroke();ctx.fillStyle='#328b69';for(let i=0;i<7;i++){let a=-Math.PI*.95+i*Math.PI*.3;ctx.beginPath();ctx.ellipse(2+Math.cos(a)*28,-79+Math.sin(a)*18,29,7,a,0,Math.PI*2);ctx.fill()}ctx.fillStyle='#5cab68';ctx.beginPath();ctx.arc(2,-79,7,0,Math.PI*2);ctx.fill();ctx.restore()}
  function drawScenery(){for(let i=0;i<14;i++){let wx=240+i*440;let sx=wx-camera*.73;if(sx>-100&&sx<W+100){let gy=groundAt(wx);if(!inPit(wx))drawPalm(sx,gy+4,.72+(.18*Math.sin(i*8)))}}}
  function drawRing(r,t){let sx=r.x-camera,sy=r.y+Math.sin(t*4+r.phase)*3;if(sx<-30||sx>W+30)return;ctx.save();ctx.translate(sx,sy);ctx.rotate(Math.sin(t*3+r.phase)*.22);ctx.strokeStyle='#fff0a0';ctx.lineWidth=6;ctx.beginPath();ctx.ellipse(0,0,8,12,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#edae32';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,0,5,9,0,0,Math.PI*2);ctx.stroke();ctx.restore()}
  function drawSpring(s){let x=s.x-camera;if(x<-30||x>W+30)return;let y=groundAt(s.x);ctx.fillStyle='#e65d51';roundedRect(x-15,y-20,30,18,3);ctx.fillStyle='#ffcf61';ctx.fillRect(x-13,y-17,26,4);ctx.strokeStyle='#f9ebbf';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-9,y-2);ctx.lineTo(x+7,y-8);ctx.lineTo(x-7,y-13);ctx.lineTo(x+9,y-19);ctx.stroke()}
  function drawEnemy(e,t){if(!e.alive)return;let x=e.x-camera,y=groundAt(e.x)-17+Math.sin(t*5+e.phase)*2;if(x<-40||x>W+40)return;ctx.fillStyle='#793e64';ctx.beginPath();ctx.ellipse(x,y,18,14,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f16f6c';ctx.beginPath();ctx.arc(x-4,y-4,9,Math.PI,0);ctx.fill();ctx.fillStyle='white';ctx.beginPath();ctx.ellipse(x+5,y-2,4,6,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#112843';ctx.beginPath();ctx.arc(x+6,y-1,2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f3cb78';ctx.fillRect(x-13,y+10,8,4);ctx.fillRect(x+6,y+10,8,4)}
  function drawPlayer(t){const p=player,x=p.x-camera,y=p.y;ctx.save();ctx.translate(x,y);if(p.invuln>0&&Math.floor(t*13)%2===0)ctx.globalAlpha=.4;if((Math.abs(p.vx)>340||!p.onGround)&&p.spin>0){ctx.rotate(t*18*p.face);ctx.fillStyle='#238dde';ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.fill();ctx.fillStyle='#74ecf2';ctx.beginPath();ctx.arc(-4,-5,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,22,-.6,.6);ctx.stroke()}else{
      ctx.scale(p.face,1);const run=Math.sin(p.anim)*4;ctx.fillStyle='#238dde';ctx.beginPath();ctx.moveTo(-13,-7);ctx.lineTo(-29,-18);ctx.lineTo(-18,-1);ctx.lineTo(-32,4);ctx.lineTo(-14,7);ctx.lineTo(-20,19);ctx.lineTo(-3,12);ctx.lineTo(7,16);ctx.lineTo(15,9);ctx.lineTo(15,-9);ctx.lineTo(5,-16);ctx.closePath();ctx.fill();
      ctx.fillStyle='#34b9ed';ctx.beginPath();ctx.ellipse(1,-1,15,18,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffdfb4';ctx.beginPath();ctx.ellipse(9,5,10,8,-.25,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(7,-9,6,9,-.15,0,Math.PI*2);ctx.ellipse(14,-7,4.5,7,-.15,0,Math.PI*2);ctx.fill();ctx.fillStyle='#142d4b';ctx.beginPath();ctx.arc(9,-7,2.4,0,Math.PI*2);ctx.arc(15,-6,2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ed6a55';roundedRect(-10,14+Math.max(0,run),18,7,3);roundedRect(3,14-Math.max(0,run),18,7,3);ctx.fillStyle='#ffe49a';ctx.fillRect(0,14+Math.max(0,run),5,2);ctx.fillRect(12,14-Math.max(0,run),5,2)
    }ctx.restore()}
  function render(now){const t=now/1000;ctx.setTransform(DPR,0,0,DPR,0,0);drawBackground();drawScenery();drawGround();for(const r of ringList)if(!r.got)drawRing(r,t);for(const s of springs)drawSpring(s);for(const e of enemies)drawEnemy(e,t);for(const q of particles){ctx.globalAlpha=Math.max(0,q.life/q.max);ctx.fillStyle=q.color;ctx.beginPath();ctx.arc(q.x-camera,q.y,q.size,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1;drawPlayer(t);requestAnimationFrame(frame)}
  function frame(now){let dt=Math.min(.033,(now-last)/1000||0);last=now;if(mode==='play')update(dt);else if(mode==='ready'){player.y=groundAt(player.x)-player.r+Math.sin(now*.003)*3}render(now)}
  player.y=groundAt(player.x)-player.r;requestAnimationFrame(frame);
})();
