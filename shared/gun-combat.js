import {GUN_MAGAZINE,GUN_SHOT_SECONDS,GUN_RANGE} from './equipment-rules.js';
import {biomeOf,forestTerrainHeight,forestObstacles} from './forest-level.js';
// Hits are calculated from the authoritative shooter pose, never a client target ID.
export function raySphere(origin,dir,center,radius){
  const v=origin.map((x,i)=>x-center[i]),b=v.reduce((s,x,i)=>s+x*dir[i],0),c=v.reduce((s,x)=>s+x*x,0)-radius*radius,h=b*b-c;
  if(h<0)return Infinity;const t=-b-Math.sqrt(h);return t>=0?t:-b+Math.sqrt(h)>=0?0:Infinity;
}
export function mimicRayHit(p,m){
  if(!m?.active||!m.isMimic||!m.alive||biomeOf(p)!=='forest'||biomeOf(m)!=='forest')return null;
  const origin=[p.x,p.y,p.z],dir=[-Math.sin(p.yaw)*Math.cos(p.pitch),Math.sin(p.pitch),-Math.cos(p.yaw)*Math.cos(p.pitch)];
  const ground=forestTerrainHeight(m.x,m.z),height=m.crouching?1.04:1.8;
  let distance=raySphere(origin,dir,[m.x,ground+height-.17,m.z],.21),head=true;
  for(let y=.27;y<height-.55;y+=.18){const t=raySphere(origin,dir,[m.x,ground+y,m.z],m.crouching?.30:.27);if(t<distance){distance=t;head=false;}}
  return distance<=GUN_RANGE?{distance,head,origin,dir,point:origin.map((v,i)=>v+dir[i]*distance)}:null;
}
export function clearBulletPath(seed,origin,end){
  const dx=end[0]-origin[0],dy=end[1]-origin[1],dz=end[2]-origin[2],d=Math.hypot(dx,dz),seen=new Set(),steps=Math.max(1,Math.ceil(Math.hypot(dx,dy,dz)/.3));
  const blocked=(q,radius,bottom,top)=>{const t=d>1e-6?Math.max(0,Math.min(1,((q.x-origin[0])*dx+(q.z-origin[2])*dz)/(d*d))):0,y=origin[1]+dy*t;return y>bottom&&y<top&&Math.hypot(q.x-origin[0]-dx*t,q.z-origin[2]-dz*t)<radius;};
  for(let i=1;i<steps;i++){
    const t=i/steps,x=origin[0]+dx*t,y=origin[1]+dy*t,z=origin[2]+dz*t;
    if(y<forestTerrainHeight(x,z)+.025)return false;
    const o=forestObstacles(seed,x,z);
    for(const q of o.trees)if(!seen.has(q)){seen.add(q);if(blocked(q,q.radius,q.ground,q.ground+q.height))return false;}
    for(const q of o.rocks)if(!seen.has(q)){seen.add(q);if(blocked(q,q.radius,q.y,q.y+q.height))return false;}
    for(const q of o.logs){const lx=q.b.x-q.a.x,lz=q.b.z-q.a.z,u=Math.max(0,Math.min(1,((x-q.a.x)*lx+(z-q.a.z)*lz)/(lx*lx+lz*lz)));if(Math.hypot(x-q.a.x-lx*u,z-q.a.z-lz*u)<q.radius+.04&&y<forestTerrainHeight(x,z)+q.radius*2+.1)return false;}
  }return true;
}
export function shootMimic(p,m,seed,occlusion=clearBulletPath){
  if(!p.alive||p.heldItem!=='gun'||!p.inventory.gun||!Number.isFinite(p.inventory.ammo)||p.inventory.ammo<=0||p.inventory.ammo>GUN_MAGAZINE||p.gunCooldown>0||p.gunReload>0||p.tabletOpen||p.inventoryOpen||p.frozen>0||p.sprinting)return null;
  if(![p.x,p.y,p.z,p.yaw,p.pitch].every(Number.isFinite))return null;
  p.inventory.ammo--;p.gunCooldown=GUN_SHOT_SECONDS;p.gunFlash=.11;
  const hit=mimicRayHit(p,m),result={hit:false,killed:false,ammo:p.inventory.ammo};
  if(hit&&occlusion(seed,hit.origin,hit.point)){
    result.hit=true;result.target=m.id;m.health=(m.health??2)-(hit.head?2:1);
    if(m.health<=0){m.alive=false;m.state='dead';m.deathTime=0;m.playing=null;m.vx=m.vz=0;m.sprinting=false;m.torch=false;m.route=[];result.killed=true;}
    else{m.playing=null;m.changeState('charge',8);m.targetId=p.id;}
  }return result;
}
