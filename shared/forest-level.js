import {layoutRandom,groundHash,groundNoise} from './world-layout.js';
import {FOREST_TREE_TYPES} from './tree-shapes.js';
import {spendStamina} from './survival.js';
import {terrainHeight} from './physics.js';
import {forestTerrainHeight,forestSlope,forestStepAllowed,forestTrailDistance,FOREST_CYCLE_SECONDS} from './forest-terrain.js';
export {forestTerrainHeight} from './forest-terrain.js';
export const FOREST_CHUNK_SIZE=48;
export const biomeOf=p=>p?.biome==='forest'?'forest':'meadow';
export const sameBiome=(a,b)=>biomeOf(a)===biomeOf(b);
export function createForestLevel(seed){return{seed,active:false,phase:null,cycle:true,clock:0,occupants:0};}
export function activateForest(level){if(!level.active){level.active=true;level.phase=groundHash(7,13,level.seed)<.85?.84:.53;}return level;}
// Deterministic, bounded cache. The same chunks are used by clients and server.
export const forestChunkCache=new Map();
export function forestChunk(seed,cx,cz){
  const key=seed+':'+cx+','+cz;let c=forestChunkCache.get(key);if(c){forestChunkCache.delete(key);forestChunkCache.set(key,c);return c;}
  const r=layoutRandom((groundHash(cx,cz,seed)*0xffffffff)>>>0),trees=[],cells=new Map(),logs=[],rocks=[],details=[];
  for(let iz=0;iz<10;iz++)for(let ix=0;ix<10;ix++){
    const x=cx*48+(ix+.18+r()*.64)*4.8,z=cz*48+(iz+.18+r()*.64)*4.8;
    if(r()>.66+groundNoise(x/46,z/46,seed)*.33||Math.abs(x)<4.2&&z>-23&&z<14)continue;
    const kind=Math.floor(r()*FOREST_TREE_TYPES.length),type=FOREST_TREE_TYPES[kind],height=type.minHeight+2+r()*(type.maxHeight-type.minHeight);
    const t={x,z,kind,height,yaw:r()*Math.PI*2,radius:type.radius*height,shade:.72+r()*.28};t.ground=Math.min(forestTerrainHeight(x-t.radius,z),forestTerrainHeight(x+t.radius,z),forestTerrainHeight(x,z-t.radius),forestTerrainHeight(x,z+t.radius))-.06;trees.push(t);
    const cell=Math.floor(x/8)+','+Math.floor(z/8);if(!cells.has(cell))cells.set(cell,[]);cells.get(cell).push(t);
  }
  if(r()<.65){const x=(cx+.2+r()*.6)*48,z=(cz+.2+r()*.6)*48,a=r()*Math.PI*2,l=3+r()*4;const log={a:{x,z},b:{x:x+Math.cos(a)*l,z:z+Math.sin(a)*l},radius:.23+r()*.16};if(Math.hypot(x,z)>25&&trees.every(t=>Math.hypot(t.x-x,t.z-z)>2))logs.push(log);}
  // Large objects stay off the entry and winding footpath; small litter is passable.
  for(let i=0,n=3+Math.floor(r()*4);i<n;i++){
    const x=(cx+.12+r()*.76)*48,z=(cz+.12+r()*.76)*48,radius=.55+r()*1.35;
    if(Math.hypot(x,z+8)<24||forestTrailDistance(x,z)<radius+2.1||trees.some(t=>Math.hypot(t.x-x,t.z-z)<radius+t.radius+.6))continue;
    rocks.push({x,z,radius,height:radius*(.6+r()*.7),yaw:r()*6.283,shape:r(),y:forestTerrainHeight(x,z)});
  }
  for(let i=0,n=24+Math.floor(r()*12);i<n;i++){
    const x=(cx+r())*48,z=(cz+r())*48;
    if(Math.hypot(x,z+8)<10||forestTrailDistance(x,z)<1.5||forestSlope(x,z)>1.15||rocks.some(b=>Math.hypot(b.x-x,b.z-z)<b.radius+.4))continue;
    details.push({x,z,y:forestTerrainHeight(x,z),kind:i%7===0?'stump':i%5===0?'branch':i%6===0?'mushroom':'fern',size:.45+r()*.65,yaw:r()*6.283,shade:.7+r()*.3});
  }
  c={key,x:(cx+.5)*48,z:(cz+.5)*48,cx,cz,trees,cells,logs,rocks,details};forestChunkCache.set(key,c);if(forestChunkCache.size>192)forestChunkCache.delete(forestChunkCache.keys().next().value);return c;
}
export function forestView(seed,x,z,radius){const chunks=[];for(let cz=Math.floor((z-radius)/48);cz<=Math.floor((z+radius)/48);cz++)for(let cx=Math.floor((x-radius)/48);cx<=Math.floor((x+radius)/48);cx++)chunks.push(forestChunk(seed,cx,cz));return{chunks,trees:chunks.flatMap(c=>c.trees),logs:chunks.flatMap(c=>c.logs)};}
export function forestObstacles(seed,x,z){const trees=[],logs=[],rocks=[],gx=Math.floor(x/8),gz=Math.floor(z/8);for(let cz=Math.floor((z-8)/48);cz<=Math.floor((z+8)/48);cz++)for(let cx=Math.floor((x-8)/48);cx<=Math.floor((x+8)/48);cx++){const c=forestChunk(seed,cx,cz);logs.push(...c.logs);rocks.push(...c.rocks);for(let iz=-1;iz<=1;iz++)for(let ix=-1;ix<=1;ix++)trees.push(...(c.cells.get((gx+ix)+','+(gz+iz))||[]));}return{trees,logs,rocks};}
export function collideEndlessForest(p,seed){const obstacles=forestObstacles(seed,p.x,p.z);for(const t of obstacles.trees){const dx=p.x-t.x,dz=p.z-t.z,d=Math.hypot(dx,dz),r=t.radius+.29;if(d<r){p.x=t.x+(d>.001?dx/d:1)*r;p.z=t.z+(d>.001?dz/d:0)*r;}}
  for(const b of obstacles.rocks){const dx=p.x-b.x,dz=p.z-b.z,d=Math.hypot(dx,dz),r=b.radius+.29;if(d<r){p.x=b.x+(d>.001?dx/d:1)*r;p.z=b.z+(d>.001?dz/d:0)*r;}}
  for(const log of obstacles.logs){const dx=log.b.x-log.a.x,dz=log.b.z-log.a.z,t=Math.max(0,Math.min(1,((p.x-log.a.x)*dx+(p.z-log.a.z)*dz)/(dx*dx+dz*dz))),x=log.a.x+dx*t,z=log.a.z+dz*t,px=p.x-x,pz=p.z-z,d=Math.hypot(px,pz),r=log.radius+.29;if(d<r){p.x=x+(d>.001?px/d:1)*r;p.z=z+(d>.001?pz/d:0)*r;}}
}
export function forestPathClear(seed,a,b,padding=.4){
  const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.65));let previous=a;
  for(let i=0;i<=n;i++){
    const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n,p={x,z},o=forestObstacles(seed,x,z);
    if(i&&!forestStepAllowed(previous,p))return false;previous=p;
    if(o.trees.some(t=>Math.hypot(t.x-x,t.z-z)<t.radius+padding)||o.rocks.some(r=>Math.hypot(r.x-x,r.z-z)<r.radius+padding))return false;
    for(const l of o.logs){const dx=l.b.x-l.a.x,dz=l.b.z-l.a.z,t=Math.max(0,Math.min(1,((x-l.a.x)*dx+(z-l.a.z)*dz)/(dx*dx+dz*dz)));if(Math.hypot(x-l.a.x-dx*t,z-l.a.z-dz*t)<l.radius+padding)return false;}
  }return true;
}
export function forestLineOfSight(seed,a,b){
  const dx=b.x-a.x,dz=b.z-a.z,distance=Math.hypot(dx,dz),n=Math.max(1,Math.ceil(distance/.65)),seen=new Set();
  const ay=forestTerrainHeight(a.x,a.z)+(a.crouching?.72:1.65),by=forestTerrainHeight(b.x,b.z)+(b.crouching?.72:1.65);
  // Intersect the full sight line with each object. Point samples alone can skip thin trunks.
  const intersects=(q,radius,top)=>{
    const t=distance>0?Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.z-a.z)*dz)/(distance*distance))):0;
    return Math.hypot(q.x-a.x-dx*t,q.z-a.z-dz*t)<radius&&ay+(by-ay)*t<top;
  };
  for(let i=0;i<=n;i++){
    const t=i/n,x=a.x+dx*t,z=a.z+dz*t,y=ay+(by-ay)*t,ground=forestTerrainHeight(x,z);
    if(i>0&&i<n&&y<ground+.12)return false;
    const o=forestObstacles(seed,x,z);
    for(const q of o.trees)if(!seen.has(q)){seen.add(q);if(intersects(q,q.radius+.08,q.ground+q.height))return false;}
    for(const q of o.rocks)if(!seen.has(q)){seen.add(q);if(intersects(q,q.radius,q.y+q.height))return false;}
  }return true;
}
export function moveForestActor(p,input,dt,seed,stamina=p){
  const ox=p.x,oz=p.z;let x=input.x||0,z=input.z||0,l=Math.hypot(x,z);if(l>1){x/=l;z/=l;}
  p.crouching=!!input.crouch;p.sprinting=spendStamina(stamina,!!input.sprint&&!p.crouching&&l>.05,dt);p.yaw=input.yaw;p.pitch=input.pitch||0;
  const ux=x*Math.cos(p.yaw)-z*Math.sin(p.yaw),uz=-x*Math.sin(p.yaw)-z*Math.cos(p.yaw);
  const grade=(forestTerrainHeight(p.x+ux*.8,p.z+uz*.8)-forestTerrainHeight(p.x,p.z))/.8;
  const pace=Math.max(.58,Math.min(1.10,1-grade*.3));
  const speed=(p.crouching?1.35:p.sprinting?6.6:3)*(p.boost>0?1.4:1)*(p.slow>0?.5:1)*pace,dx=ux*speed*dt,dz=uz*speed*dt,n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.16));
  for(let i=0;i<n;i++){
    const before={x:p.x,z:p.z},next={x:p.x+dx/n,z:p.z+dz/n};
    if(forestStepAllowed(before,next)){p.x=next.x;p.z=next.z;}
    else{if(forestStepAllowed(before,{x:next.x,z:p.z}))p.x=next.x;if(forestStepAllowed(p,{x:p.x,z:next.z}))p.z=next.z;}
    collideEndlessForest(p,seed);
    if(!forestStepAllowed(before,p)){p.x=before.x;p.z=before.z;}
  }
  p.y=forestTerrainHeight(p.x,p.z)+(p.crouching?.72:1.7);p.vx=(p.x-ox)/Math.max(.001,dt);p.vz=(p.z-oz)/Math.max(.001,dt);return Math.hypot(p.x-ox,p.z-oz);
}
export function enterForest(p,layout,level){const f=layout.forest;let dx=p.x-f.x,dz=p.z-f.z;if(Math.hypot(dx,dz)<.01){dx=f.entrance.x-f.x;dz=f.entrance.z-f.z;}const d=Math.hypot(dx,dz)||1;p.meadowReturn={x:f.x+dx/d*(f.radius+7),z:f.z+dz/d*(f.radius+7),yaw:Math.atan2(-dx,-dz)};activateForest(level);Object.assign(p,{biome:'forest',x:0,z:-16,y:forestTerrainHeight(0,-16)+1.7,yaw:0,pitch:0,vx:0,vz:0,levelCooldown:2,teleportSeq:(p.teleportSeq||0)+1});}
export function leaveForest(p){Object.assign(p,p.meadowReturn||{x:128,z:-34,yaw:0},{biome:'meadow',pitch:0,vx:0,vz:0,levelCooldown:3,teleportSeq:(p.teleportSeq||0)+1});p.y=terrainHeight(p.x,p.z)+(p.crouching?.72:1.7);}
export function tickForestBoundary(p,layout,level,dt){p.levelCooldown=Math.max(0,(p.levelCooldown||0)-dt);if(p.levelCooldown||p.alive===false||p.connected===false)return false;if(biomeOf(p)==='forest'){if(Math.abs(p.x)<4.2&&p.z>2&&p.z<14){leaveForest(p);return true;}}else if(Math.hypot(p.x-layout.forest.x,p.z-layout.forest.z)<layout.forest.radius-16){enterForest(p,layout,level);return true;}return false;}
export function tickForestLevel(level,players,dt){level.occupants=players.filter(p=>p.alive!==false&&p.connected!==false&&biomeOf(p)==='forest').length;if(level.active&&level.occupants){level.clock+=dt;if(level.cycle)level.phase=(level.phase+dt/FOREST_CYCLE_SECONDS)%1;}}
