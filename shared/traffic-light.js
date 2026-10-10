// Shared by the authoritative server and offline game. Metres, seconds, radians.
export const SIGNAL_HEIGHT=6.1,SIGNAL_HALF_SPAN=5.2;
export const SIGNAL_TIMING={red:4.6,green:3.4,yellow:1.35};
export const SIGNAL_SPEED={red:0,green:15.4,yellow:2.6};
const signalClamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function createTrafficLights(layout,height){
  return(layout.roadside?.signals||[]).map(p=>{
    const s={...p,phase:'red',phaseTime:0,active:false,targetId:null,lost:0,clock:0,vx:0,vz:0,leanX:0,leanZ:0,heading:p.heading,feet:[],nextFoot:0,swingX:0,swingZ:0,swingVX:0,swingVZ:0,headRoll:0};
    for(const sign of [-1,1]){const x=p.x+Math.cos(p.heading)*SIGNAL_HALF_SPAN*sign,z=p.z-Math.sin(p.heading)*SIGNAL_HALF_SPAN*sign,pos=[x,height(x,z),z];s.feet.push({position:pos,start:pos.slice(),target:pos.slice(),progress:1});}
    return s;
  });
}
export function trafficLightGeometry(s){
  const tops=s.feet.map(f=>[f.position[0]-(s.leanX||0),f.position[1]+SIGNAL_HEIGHT,f.position[2]-(s.leanZ||0)]);
  const mid=[0,1,2].map(k=>(tops[0][k]+tops[1][k])*.5),span=Math.hypot(tops[0][0]-tops[1][0],tops[0][2]-tops[1][2]);
  const sag=.34+Math.max(0,10.4-span)*.10,anchor=[mid[0],mid[1]-sag,mid[2]];
  const length=.68,head=[anchor[0]+Math.sin(s.swingX)*length,anchor[1]-length*Math.cos(Math.hypot(s.swingX,s.swingZ)),anchor[2]+Math.sin(s.swingZ)*length];
  return{tops,anchor,head,sag};
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
  s.clock+=dt;
  const candidates=players.filter(p=>p.alive!==false&&p.connected!==false&&p.biome!=='forest'&&!obstacles.some(o=>o.shelter&&Math.hypot(p.x-o.x,p.z-o.z)<o.r));
  let p=candidates.find(p=>p.id===s.targetId);
  if(!p||Math.hypot(p.x-s.x,p.z-s.z)>155)p=candidates.reduce((a,b)=>!a||Math.hypot(b.x-s.x,b.z-s.z)<Math.hypot(a.x-s.x,a.z-s.z)?b:a,null);
  const distance=p?Math.hypot(p.x-s.x,p.z-s.z):Infinity;
  if(!s.active&&distance<70){s.active=true;s.phase='yellow';s.phaseTime=0;}
  if(s.active){
    s.targetId=distance<155?p.id:null;s.lost=s.targetId?0:s.lost+dt;s.phaseTime+=dt;
    if(s.phaseTime>=SIGNAL_TIMING[s.phase]){s.phaseTime-=SIGNAL_TIMING[s.phase];s.phase=s.phase==='red'?'green':s.phase==='green'?'yellow':'red';}
    if(s.lost>9){s.active=false;s.phase='red';s.phaseTime=0;s.targetId=null;}
  }
  const oldVX=s.vx,oldVZ=s.vz,oldFeet=s.feet.map(f=>f.position.slice());
  if(!s.active||s.phase==='red'||!s.targetId){s.vx=0;s.vz=0;}
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
    if(!moving){f.position[1]+=(height(f.position[0],f.position[2])-f.position[1])*(1-Math.exp(-18*dt));f.progress=1;continue;}
    if(f.progress>=1)continue;
    swinging=true;f.progress=Math.min(1,f.progress+dt/.24);const t=f.progress,e=t*t*t*(t*(t*6-15)+10);
    f.position=f.start.map((v,k)=>v+(f.target[k]-v)*e);f.position[1]+=Math.sin(t*Math.PI)*1.55;
  }
  if(moving&&!swinging){
    for(let j=0;j<2;j++){
      const i=(s.nextFoot+j)%2,sign=i?1:-1,f=s.feet[i],x=s.x+Math.cos(s.heading)*SIGNAL_HALF_SPAN*sign+s.vx*.15,z=s.z-Math.sin(s.heading)*SIGNAL_HALF_SPAN*sign+s.vz*.15;
      if(Math.hypot(f.position[0]-x,f.position[2]-z)<.55)continue;
      f.start=f.position.slice();f.target=[x,height(x,z),z];f.progress=0;s.nextFoot=1-i;break;
    }
  }
  // A damped pendulum reacts to acceleration, braking, and the uneven pole gait.
  const ax=signalClamp((s.vx-oldVX)/dt,-55,55),az=signalClamp((s.vz-oldVZ)/dt,-55,55);
  s.swingVX+=(-9.81/.68*Math.sin(s.swingX)-1.75*s.swingVX-ax*.13+Math.sin(s.clock*1.3)*.09)*dt;
  s.swingVZ+=(-9.81/.68*Math.sin(s.swingZ)-1.75*s.swingVZ-az*.13)*dt;
  s.swingX=signalClamp(s.swingX+s.swingVX*dt,-.62,.62);s.swingZ=signalClamp(s.swingZ+s.swingVZ*dt,-.62,.62);
  s.headRoll+=(signalClamp((s.feet[1].position[1]-s.feet[0].position[1])*.10,-.18,.18)-s.headRoll)*(1-Math.exp(-6*dt));
  if(moving)for(const victim of candidates){
    if(victim.godMode||victim.alive===false)continue;
    if(s.feet.some((f,i)=>{
      const a=oldFeet[i],b=f.position,dx=b[0]-a[0],dz=b[2]-a[2],t=signalClamp(((victim.x-a[0])*dx+(victim.z-a[2])*dz)/(dx*dx+dz*dz||1),0,1);
      return Math.hypot(victim.x-a[0]-dx*t,victim.z-a[2]-dz*t)<.88;
    })){victim.alive=false;victim.health=0;if(victim.input)victim.input.x=victim.input.z=0;onCatch?.(victim,s);}
  }
}
export function stepTrafficLights(signals,dt,players,height,obstacles=[],onCatch){
  // Bounded substeps keep cable physics and swept catches stable on slow phones.
  const duration=Math.min(.25,Math.max(0,dt)),steps=Math.max(1,Math.ceil(duration*120));if(!duration)return;
  for(let i=0;i<steps;i++)for(const s of signals)signalStep(s,duration/steps,players,height,obstacles,onCatch);
}
export function snapshotTrafficLights(signals){
  return signals.map(s=>Object.fromEntries(['id','x','z','heading','phase','phaseTime','active','vx','vz','leanX','leanZ','clock','swingX','swingZ','headRoll','feet'].map(k=>[k,k==='feet'?s.feet.map(f=>({position:f.position.slice(),progress:f.progress})):s[k]])));
}
export function trafficPoleObstacles(signals){return signals.flatMap(s=>s.feet.map(f=>({x:f.position[0],z:f.position[2],r:.45})));}
export function collideTrafficPoles(p,signals){
  if(p.biome==='forest')return;
  for(const o of trafficPoleObstacles(signals)){
    const dx=p.x-o.x,dz=p.z-o.z,d=Math.hypot(dx,dz);
    if(d<o.r){p.x=o.x+(d>.0001?dx/d:1)*o.r;p.z=o.z+(d>.0001?dz/d:0)*o.r;}
  }
}
