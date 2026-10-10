// Shared by the authoritative server and offline game. Metres, seconds, radians.
export const SIGNAL_HEIGHT=8.6,SIGNAL_HALF_SPAN=4.2;
export const SIGNAL_HEAD_SCALE=1.45,SIGNAL_ATTACH_HEIGHT=8,SIGNAL_HANGER_LENGTH=.22;
export const SIGNAL_HEAD_POINTS=[.23,.5,.77],SIGNAL_HEAD_DROP=.43*SIGNAL_HEAD_SCALE+SIGNAL_HANGER_LENGTH;
export const SIGNAL_STOMP={windup:.82,strike:.22,hold:.16,recover:.48,lift:3,reach:4.8,radius:1.05,cooldown:1.8};
export const SIGNAL_TIMING={red:4.6,green:3.4,yellow:1.35};
export const SIGNAL_SPEED={red:0,green:13.8,yellow:2.6};
const signalClamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createTrafficLights(layout,height){
  return(layout.roadside?.signals||[]).map(p=>{
    const s={...p,phase:'red',phaseTime:0,active:false,paused:false,targetId:null,lost:0,clock:0,vx:0,vz:0,leanX:0,leanZ:0,heading:p.heading,feet:[],nextFoot:0,swingX:0,swingZ:0,swingVX:0,swingVZ:0,headRoll:0,stomp:null,stompCooldown:0,impactSerial:0,heads:SIGNAL_HEAD_POINTS.map(()=>({swingX:0,swingZ:0,vx:0,vz:0,anchor:null,anchorVelocity:[0,0,0]}))};
    for(const sign of [-1,1]){const x=p.x+Math.cos(p.heading)*SIGNAL_HALF_SPAN*sign,z=p.z-Math.sin(p.heading)*SIGNAL_HALF_SPAN*sign,pos=[x,height(x,z),z];s.feet.push({position:pos,start:pos.slice(),target:pos.slice(),progress:1});}
    return s;
  });
}
export function trafficLightGeometry(s){
  // Each stiff pole pivots about its planted toe. Its length never stretches.
  // Narrower running footprints produce the reference's wide, scissoring V pose.
  const tops=s.feet.map((f,i)=>{
    const sign=i?1:-1;let dx=s.x+Math.cos(s.heading)*SIGNAL_HALF_SPAN*sign+(s.leanX||0)-f.position[0],dz=s.z-Math.sin(s.heading)*SIGNAL_HALF_SPAN*sign+(s.leanZ||0)-f.position[2];
    const distance=Math.hypot(dx,dz),limit=SIGNAL_HEIGHT*.63;if(distance>limit){dx*=limit/distance;dz*=limit/distance;}
    return[f.position[0]+dx,f.position[1]+Math.sqrt(SIGNAL_HEIGHT*SIGNAL_HEIGHT-dx*dx-dz*dz),f.position[2]+dz];
  });
  const attachments=tops.map((top,i)=>top.map((v,k)=>s.feet[i].position[k]+(v-s.feet[i].position[k])*SIGNAL_ATTACH_HEIGHT/SIGNAL_HEIGHT));
  const span=Math.hypot(attachments[0][0]-attachments[1][0],attachments[0][2]-attachments[1][2]);
  for(let i=0;i<2;i++)for(const k of [0,2])attachments[i][k]+=(tops[1-i][k]-tops[i][k])/Math.max(.01,span)*.15;
  const sag=signalClamp(2.35+(SIGNAL_HALF_SPAN*2-span)*.38,.8,3.8);
  const cablePoint=t=>{
    const bow=4*t*(1-t),p=attachments[0].map((v,k)=>v+(attachments[1][k]-v)*t);
    p[0]+=(s.swingX||0)*bow*.34;p[1]-=sag*bow;p[2]+=(s.swingZ||0)*bow*.34;return p;
  };
  const heads=SIGNAL_HEAD_POINTS.map((t,i)=>{
    const anchor=cablePoint(t),h=s.heads?.[i]||{swingX:0,swingZ:0},angle=Math.hypot(h.swingX,h.swingZ),factor=angle?Math.sin(angle)/angle:1,down=[h.swingX*factor,-Math.cos(angle),h.swingZ*factor];
    return{anchor,down,position:anchor.map((v,k)=>v+down[k]*SIGNAL_HEAD_DROP)};
  });
  return{tops,attachments,anchor:cablePoint(.5),head:heads[1].position,heads,cablePoint,sag};
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
  const x=s.x+Math.cos(s.heading)*SIGNAL_HALF_SPAN*.57*sign,z=s.z-Math.sin(s.heading)*SIGNAL_HALF_SPAN*.57*sign;
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
  let x=p.x-side*SIGNAL_HALF_SPAN*.57,z=p.z+forward*SIGNAL_HALF_SPAN*.57;
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
  s.leanX+=(s.vx*.07-s.leanX)*(1-Math.exp(-5*dt));s.leanZ+=(s.vz*.07-s.leanZ)*(1-Math.exp(-5*dt));
  let swinging=false;
  for(const f of s.feet){
    if(attacking)continue;
    if(!moving){const ground=height(f.position[0],f.position[2]);f.position[1]+=(ground-f.position[1])*(1-Math.exp(-14*dt));if(Math.abs(f.position[1]-ground)<.002)f.position[1]=ground;f.progress=1;continue;}
    if(f.progress>=1)continue;
    swinging=true;f.progress=Math.min(1,f.progress+dt/f.duration);const t=f.progress,e=signalEase(t);
    f.position=f.start.map((v,k)=>v+(f.target[k]-v)*e);f.position[1]+=Math.pow(Math.sin(t*Math.PI),1.4)*f.lift;
    if(t===1)f.position=f.target.slice();
  }
  if(moving&&!swinging&&!attacking){
    for(let j=0;j<2;j++){
      const i=(s.nextFoot+j)%2,sign=i?1:-1,f=s.feet[i],x=s.x+Math.cos(s.heading)*SIGNAL_HALF_SPAN*.57*sign+s.vx*.19,z=s.z-Math.sin(s.heading)*SIGNAL_HALF_SPAN*.57*sign+s.vz*.19;
      if(Math.hypot(f.position[0]-x,f.position[2]-z)<.55)continue;
      f.start=f.position.slice();f.target=[x,height(x,z),z];f.progress=0;const pace=signalClamp(Math.hypot(s.vx,s.vz)/SIGNAL_SPEED.green,0,1);f.duration=.46-.12*pace;f.lift=.75+.85*pace;s.nextFoot=1-i;break;
    }
  }
  tickSignalStomp(s,dt,candidates,height,onCatch);
  // A damped pendulum reacts to acceleration, braking, and the uneven pole gait.
  const ax=signalClamp((s.vx-oldVX)/dt,-55,55),az=signalClamp((s.vz-oldVZ)/dt,-55,55);
  s.swingVX+=(-8*Math.sin(s.swingX)-2.4*s.swingVX-ax*.065)*dt;
  s.swingVZ+=(-8*Math.sin(s.swingZ)-2.4*s.swingVZ-az*.065)*dt;
  s.swingX=signalClamp(s.swingX+s.swingVX*dt,-.62,.62);s.swingZ=signalClamp(s.swingZ+s.swingVZ*dt,-.62,.62);
  s.headRoll+=(signalClamp((s.feet[1].position[1]-s.feet[0].position[1])*.10,-.18,.18)-s.headRoll)*(1-Math.exp(-6*dt));
  // Three independent pendulums respond to their own moving point on the cable.
  // Forces come from the actual pole motion, so braking and stomping disturb them too.
  const geometry=trafficLightGeometry(s);
  s.heads.forEach((h,i)=>{
    const anchor=geometry.heads[i].anchor,velocity=h.anchor?anchor.map((v,k)=>(v-h.anchor[k])/dt):[0,0,0],acceleration=velocity.map((v,k)=>signalClamp((v-h.anchorVelocity[k])/dt,-55,55));
    const length=SIGNAL_HEAD_DROP*(1+(i-1)*.075),damping=1.6+i*.18,gravity=signalClamp(9.81+acceleration[1],3,22);
    h.vx+=(-gravity/length*Math.sin(h.swingX)-damping*h.vx-acceleration[0]/length*.55)*dt;
    h.vz+=(-gravity/length*Math.sin(h.swingZ)-damping*h.vz-acceleration[2]/length*.55)*dt;
    h.swingX=signalClamp(h.swingX+h.vx*dt,-1.35,1.35);h.swingZ=signalClamp(h.swingZ+h.vz*dt,-1.35,1.35);
    const angle=Math.hypot(h.swingX,h.swingZ);if(angle>1.35){h.swingX*=1.35/angle;h.swingZ*=1.35/angle;h.vx*=.95;h.vz*=.95;}
    h.anchor=anchor;h.anchorVelocity=velocity;
  });
}
export function stepTrafficLights(signals,dt,players,height,obstacles=[],onCatch){
  // Bounded substeps keep cable physics and stomp impact timing stable on slow phones.
  const duration=Math.min(.25,Math.max(0,dt)),steps=Math.max(1,Math.ceil(duration*120));if(!duration)return;
  for(let i=0;i<steps;i++)for(const s of signals)signalStep(s,duration/steps,players,height,obstacles,onCatch);
}
export function snapshotTrafficLights(signals){
  return signals.map(s=>({...Object.fromEntries(['id','x','z','heading','phaseTime','active','paused','vx','vz','leanX','leanZ','clock','swingX','swingZ','headRoll','impactSerial'].map(k=>[k,s[k]])),phase:s.paused?'red':s.phase,feet:s.feet.map(f=>({position:f.position.slice(),progress:f.progress})),heads:s.heads.map(h=>({swingX:h.swingX,swingZ:h.swingZ})),stomp:s.stomp?{foot:s.stomp.foot,time:s.stomp.time,phase:s.stomp.phase,target:s.stomp.target.slice()}:null,lastImpact:s.lastImpact?.slice()}));
}
export function trafficPoleObstacles(signals,player){return signals.flatMap(s=>{const g=trafficLightGeometry(s);return s.feet.map((f,i)=>{const t=signalClamp(((player?.y??f.position[1]+.7)-.7-f.position[1])/(g.tops[i][1]-f.position[1]),0,1);return{x:f.position[0]+(g.tops[i][0]-f.position[0])*t,y:f.position[1],z:f.position[2]+(g.tops[i][2]-f.position[2])*t,r:.48};});});}
export function collideTrafficPoles(p,signals){
  if(p.biome==='forest')return;
  for(const o of trafficPoleObstacles(signals,p)){
    if(Number.isFinite(p.y)&&p.y<o.y-.1)continue;
    const dx=p.x-o.x,dz=p.z-o.z,d=Math.hypot(dx,dz);
    if(d<o.r){p.x=o.x+(d>.0001?dx/d:1)*o.r;p.z=o.z+(d>.0001?dz/d:0)*o.r;}
  }
}
