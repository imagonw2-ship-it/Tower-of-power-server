// Shared by the authoritative server and offline game. Metres, seconds, radians.
export const SIGNAL_HEIGHT=6.1,SIGNAL_HALF_SPAN=5.2;
export const SIGNAL_HEAD_SCALE=1.65,SIGNAL_ATTACH_HEIGHT=5.55,SIGNAL_HANGER_LENGTH=.92;
export const SIGNAL_STOMP={windup:.82,strike:.22,hold:.16,recover:.48,lift:3,reach:4.8,radius:1.05,cooldown:1.8};
export const SIGNAL_TIMING={red:4.6,green:3.4,yellow:1.35};
export const SIGNAL_SPEED={red:0,green:15.4,yellow:2.6};
const signalClamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createTrafficLights(layout,height){
  return(layout.roadside?.signals||[]).map(p=>{
    const s={...p,phase:'red',phaseTime:0,active:false,paused:false,targetId:null,lost:0,clock:0,vx:0,vz:0,leanX:0,leanZ:0,heading:p.heading,feet:[],nextFoot:0,swingX:0,swingZ:0,swingVX:0,swingVZ:0,headRoll:0,stomp:null,stompCooldown:0,impactSerial:0};
    for(const sign of [-1,1]){const x=p.x+Math.cos(p.heading)*SIGNAL_HALF_SPAN*sign,z=p.z-Math.sin(p.heading)*SIGNAL_HALF_SPAN*sign,pos=[x,height(x,z),z];s.feet.push({position:pos,start:pos.slice(),target:pos.slice(),progress:1});}
    return s;
  });
}
export function trafficLightGeometry(s){
  const tops=s.feet.map(f=>[f.position[0]-(s.leanX||0),f.position[1]+SIGNAL_HEIGHT,f.position[2]-(s.leanZ||0)]);
  const attachments=tops.map((top,i)=>top.map((v,k)=>s.feet[i].position[k]+(v-s.feet[i].position[k])*SIGNAL_ATTACH_HEIGHT/SIGNAL_HEIGHT));
  const span=Math.hypot(attachments[0][0]-attachments[1][0],attachments[0][2]-attachments[1][2]);
  for(let i=0;i<2;i++)for(const k of [0,2])attachments[i][k]+=(tops[1-i][k]-tops[i][k])/Math.max(.01,span)*.15;
  const mid=[0,1,2].map(k=>(attachments[0][k]+attachments[1][k])*.5);
  const sag=.46+Math.max(0,10.4-span)*.10,anchor=[mid[0],mid[1]-sag,mid[2]];
  const length=SIGNAL_HANGER_LENGTH,head=[anchor[0]+Math.sin(s.swingX)*length,anchor[1]-length*Math.cos(Math.hypot(s.swingX,s.swingZ)),anchor[2]+Math.sin(s.swingZ)*length];
  return{tops,attachments,anchor,head,sag};
}
export function setTrafficLightsStopped(signals,enabled){
  for(const s of signals){s.paused=enabled;if(enabled)s.vx=s.vz=0;}
}
const signalEase=t=>{t=signalClamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
function beginSignalStomp(s,p,height){
  if(s.phase!=='green'||s.stompCooldown>0)return;
  const choices=s.feet.map((f,i)=>({i,d:Math.hypot(p.x-f.position[0],p.z-f.position[2])})).filter(c=>s.feet[1-c.i].progress>=1&&c.d<SIGNAL_STOMP.reach).sort((a,b)=>a.d-b.d);
  if(!choices.length)return;
  const foot=choices[0].i,f=s.feet[foot],sign=foot?1:-1;
  const x=s.x+Math.cos(s.heading)*SIGNAL_HALF_SPAN*sign,z=s.z-Math.sin(s.heading)*SIGNAL_HALF_SPAN*sign;
  // Lock the landing point at the start of the raised-pole warning. No homing on descent.
  s.stomp={foot,time:0,phase:'windup',start:f.position.slice(),target:[p.x,height(p.x,p.z),p.z],return:[x,height(x,z),z],impacted:false};
  for(const f of s.feet)f.progress=1;
}
function tickSignalStomp(s,dt,candidates,height,onCatch){
  const a=s.stomp;if(!a)return;
  const c=SIGNAL_STOMP,f=s.feet[a.foot];a.time+=dt;
  if(a.time<c.windup){
    const t=signalEase(a.time/(c.windup-.16));f.position=a.start.map((v,k)=>v+(a.target[k]-v)*t);f.position[1]+=c.lift*t;
  }else if(a.time<c.windup+c.strike){
    a.phase='strike';const t=(a.time-c.windup)/c.strike;f.position=a.target.slice();f.position[1]+=c.lift*(1-t*t);
  }else{
    if(!a.impacted){
      a.impacted=true;a.phase='recover';s.impactSerial++;s.lastImpact=a.target.slice();s.swingVX+=(a.foot?1:-1)*.16;s.swingVZ+=.22;
      for(const p of candidates){
        const ground=(p.y??height(p.x,p.z)+(p.crouching?.72:1.7))-(p.crouching?.72:1.7);
        if(p.alive===false||p.godMode||Math.hypot(p.x-a.target[0],p.z-a.target[2])>c.radius||Math.abs(ground-a.target[1])>1.2)continue;
        p.alive=false;p.health=0;if(p.input)p.input.x=p.input.z=0;onCatch?.(p,s);
      }
    }
    const t=signalClamp((a.time-c.windup-c.strike-c.hold)/c.recover,0,1),e=signalEase(t);
    f.position=a.target.map((v,k)=>v+(a.return[k]-v)*e);f.position[1]+=Math.sin(t*Math.PI)*.9;
    if(t===1){f.position=a.return.slice();s.stomp=null;s.stompCooldown=c.cooldown;}
  }
}
function signalRoute(s,p,obstacles){
  const direct=Math.atan2(p.x-s.x,p.z-s.z),side=Math.cos(direct),forward=Math.sin(direct);
  // The right pole tracks the victim; the suspended head is not an invisible hitbox.
  let x=p.x-side*SIGNAL_HALF_SPAN,z=p.z+forward*SIGNAL_HALF_SPAN;
  for(const o of obstacles){
    const dx=x-s.x,dz=z-s.z,l=dx*dx+dz*dz,t=signalClamp(((o.x-s.x)*dx+(o.z-s.z)*dz)/(l||1),0,1);
    if(Math.hypot(s.x+dx*t-o.x,s.z+dz*t-o.z)<o.r+6){
      const a=Math.atan2(s.z-o.z,s.x-o.x),b=Math.atan2(z-o.z,x-o.x),turn=Math.atan2(Math.sin(b-a),Math.cos(b-a));
      const angle=a+Math.sign(turn||1)*.6;x=o.x+Math.cos(angle)*(o.r+8);z=o.z+Math.sin(angle)*(o.r+8);break;
    }
  }
  return{x,z};
}
function signalStep(s,dt,players,height,obstacles,onCatch){
  if(s.paused)return;
  s.clock+=dt;
  s.stompCooldown=Math.max(0,s.stompCooldown-dt);
  const candidates=players.filter(p=>p.alive!==false&&p.connected!==false&&p.biome!=='forest'&&!obstacles.some(o=>o.shelter&&Math.hypot(p.x-o.x,p.z-o.z)<o.r));
  let p=candidates.find(p=>p.id===s.targetId);
  if(!p||Math.hypot(p.x-s.x,p.z-s.z)>155)p=candidates.reduce((a,b)=>!a||Math.hypot(b.x-s.x,b.z-s.z)<Math.hypot(a.x-s.x,a.z-s.z)?b:a,null);
  const distance=p?Math.hypot(p.x-s.x,p.z-s.z):Infinity;
  if(!s.active&&distance<70){s.active=true;s.phase='yellow';s.phaseTime=0;}
  if(s.active){
    s.targetId=distance<155?p.id:null;s.lost=s.targetId?0:s.lost+dt;if(!s.stomp)s.phaseTime+=dt;
    if(s.phaseTime>=SIGNAL_TIMING[s.phase]){s.phaseTime-=SIGNAL_TIMING[s.phase];s.phase=s.phase==='red'?'green':s.phase==='green'?'yellow':'red';}
    if(s.lost>9){s.active=false;s.phase='red';s.phaseTime=0;s.targetId=null;}
  }
  const oldVX=s.vx,oldVZ=s.vz;
  if(s.active&&s.targetId&&!s.stomp)beginSignalStomp(s,p,height);
  const attacking=!!s.stomp;
  if(!s.active||s.phase==='red'||!s.targetId||attacking){s.vx=0;s.vz=0;}
  else{
    const goal=signalRoute(s,p,obstacles),desired=Math.atan2(goal.x-s.x,goal.z-s.z),delta=Math.atan2(Math.sin(desired-s.heading),Math.cos(desired-s.heading));
    s.heading+=signalClamp(delta,-2.2*dt,2.2*dt);
    const speed=SIGNAL_SPEED[s.phase]*signalClamp(Math.hypot(goal.x-s.x,goal.z-s.z)/2,.20,1),blend=1-Math.exp(-5*dt);
    s.vx+=(Math.sin(s.heading)*speed-s.vx)*blend;s.vz+=(Math.cos(s.heading)*speed-s.vz)*blend;
    s.x+=s.vx*dt;s.z+=s.vz*dt;
    for(const o of obstacles){const dx=s.x-o.x,dz=s.z-o.z,d=Math.hypot(dx,dz),r=o.r+5.6;if(d<r){s.x=o.x+(d>.001?dx/d:1)*r;s.z=o.z+(d>.001?dz/d:0)*r;}}
  }
  const moving=Math.hypot(s.vx,s.vz)>.05;
  s.leanX+=(s.vx*.045-s.leanX)*(1-Math.exp(-7*dt));s.leanZ+=(s.vz*.045-s.leanZ)*(1-Math.exp(-7*dt));
  let swinging=false;
  for(const f of s.feet){
    if(attacking)continue;
    if(!moving){f.position[1]+=(height(f.position[0],f.position[2])-f.position[1])*(1-Math.exp(-18*dt));f.progress=1;continue;}
    if(f.progress>=1)continue;
    swinging=true;f.progress=Math.min(1,f.progress+dt/.24);const t=f.progress,e=t*t*t*(t*(t*6-15)+10);
    f.position=f.start.map((v,k)=>v+(f.target[k]-v)*e);f.position[1]+=Math.sin(t*Math.PI)*1.55;
  }
  if(moving&&!swinging&&!attacking){
    for(let j=0;j<2;j++){
      const i=(s.nextFoot+j)%2,sign=i?1:-1,f=s.feet[i],x=s.x+Math.cos(s.heading)*SIGNAL_HALF_SPAN*sign+s.vx*.15,z=s.z-Math.sin(s.heading)*SIGNAL_HALF_SPAN*sign+s.vz*.15;
      if(Math.hypot(f.position[0]-x,f.position[2]-z)<.55)continue;
      f.start=f.position.slice();f.target=[x,height(x,z),z];f.progress=0;s.nextFoot=1-i;break;
    }
  }
  tickSignalStomp(s,dt,candidates,height,onCatch);
  // A damped pendulum reacts to acceleration, braking, and the uneven pole gait.
  const ax=signalClamp((s.vx-oldVX)/dt,-55,55),az=signalClamp((s.vz-oldVZ)/dt,-55,55);
  s.swingVX+=(-9.81/SIGNAL_HANGER_LENGTH*Math.sin(s.swingX)-1.75*s.swingVX-ax*.13+Math.sin(s.clock*1.3)*.09)*dt;
  s.swingVZ+=(-9.81/SIGNAL_HANGER_LENGTH*Math.sin(s.swingZ)-1.75*s.swingVZ-az*.13)*dt;
  s.swingX=signalClamp(s.swingX+s.swingVX*dt,-.62,.62);s.swingZ=signalClamp(s.swingZ+s.swingVZ*dt,-.62,.62);
  s.headRoll+=(signalClamp((s.feet[1].position[1]-s.feet[0].position[1])*.10,-.18,.18)-s.headRoll)*(1-Math.exp(-6*dt));
}
export function stepTrafficLights(signals,dt,players,height,obstacles=[],onCatch){
  // Bounded substeps keep cable physics and stomp impact timing stable on slow phones.
  const duration=Math.min(.25,Math.max(0,dt)),steps=Math.max(1,Math.ceil(duration*120));if(!duration)return;
  for(let i=0;i<steps;i++)for(const s of signals)signalStep(s,duration/steps,players,height,obstacles,onCatch);
}
export function snapshotTrafficLights(signals){
  return signals.map(s=>({...Object.fromEntries(['id','x','z','heading','phaseTime','active','paused','vx','vz','leanX','leanZ','clock','swingX','swingZ','headRoll','impactSerial'].map(k=>[k,s[k]])),phase:s.paused?'red':s.phase,feet:s.feet.map(f=>({position:f.position.slice(),progress:f.progress})),stomp:s.stomp?{foot:s.stomp.foot,time:s.stomp.time,phase:s.stomp.phase,target:s.stomp.target.slice()}:null,lastImpact:s.lastImpact?.slice()}));
}
export function trafficPoleObstacles(signals){return signals.flatMap(s=>s.feet.map(f=>({x:f.position[0],y:f.position[1],z:f.position[2],r:.45})));}
export function collideTrafficPoles(p,signals){
  if(p.biome==='forest')return;
  for(const o of trafficPoleObstacles(signals)){
    if(Number.isFinite(p.y)&&p.y<o.y-.1)continue;
    const dx=p.x-o.x,dz=p.z-o.z,d=Math.hypot(dx,dz);
    if(d<o.r){p.x=o.x+(d>.0001?dx/d:1)*o.r;p.z=o.z+(d>.0001?dz/d:0)*o.r;}
  }
}
