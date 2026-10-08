import {biomeOf,collideEndlessForest,forestTerrainHeight,forestPathClear,forestLineOfSight,moveForestActor} from './forest-level.js';
// Voice ownership comes from the authenticated socket. Short clips stay in RAM only.
export class MimicMemory {
  constructor(){this.pending=new Map();this.clips=[];}
  record(id,packet,now){
    let p=this.pending.get(id);
    if(p&&now-p.at>.3){this.finish(id,now);p=null;}
    if(!p){p={frames:[],at:now};this.pending.set(id,p);}
    p.at=now;
    if(p.frames.length<48)p.frames.push(new Uint8Array(packet));
  }
  finish(id,now){
    const p=this.pending.get(id);this.pending.delete(id);
    if(!p||p.frames.length<4)return;
    const mine=this.clips.filter(c=>c.id===id);if(mine.length>=2)this.clips.splice(this.clips.indexOf(mine[0]),1);
    this.clips.push({id,frames:p.frames,at:now});if(this.clips.length>8)this.clips.shift();
  }
  tick(now){for(const [id,p] of this.pending)if(now-p.at>.3)this.finish(id,now);this.clips=this.clips.filter(c=>now-c.at<90);}
  forget(id){this.pending.delete(id);this.clips=this.clips.filter(c=>c.id!==id);}
  clear(){this.pending.clear();this.clips.length=0;}
}
// A bounded local search runs only when the direct route is obstructed.
export function findForestPath(seed,start,goal,budget=180){
  if(forestPathClear(seed,start,goal,.36))return[{x:goal.x,z:goal.z}];
  const first={x:start.x,z:start.z,ix:0,iz:0,g:0,h:Math.hypot(goal.x-start.x,goal.z-start.z),parent:null},open=[first],known=new Map([['0,0',first]]),closed=new Set();let best=first,found=false;
  const offsets=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  while(open.length&&closed.size<budget){
    let at=0;for(let i=1;i<open.length;i++)if(open[i].g+open[i].h*1.12<open[at].g+open[at].h*1.12)at=i;
    const node=open.splice(at,1)[0],key=node.ix+','+node.iz;closed.add(key);
    if(node.h<best.h)best=node;
    if(node.h<2.6&&forestPathClear(seed,node,goal,.36)){best=node;found=true;break;}
    for(const [dx,dz] of offsets){
      const ix=node.ix+dx,iz=node.iz+dz,k=ix+','+iz;if(closed.has(k)||Math.abs(ix)>22||Math.abs(iz)>22)continue;
      const point={x:start.x+ix*2,z:start.z+iz*2};if(!forestPathClear(seed,node,point,.36))continue;
      const g=node.g+Math.hypot(dx,dz)*2+Math.max(0,forestTerrainHeight(point.x,point.z)-forestTerrainHeight(node.x,node.z))*.6,old=known.get(k);
      if(old&&g>=old.g)continue;
      const next=old||{...point,ix,iz,h:Math.hypot(goal.x-point.x,goal.z-point.z)};Object.assign(next,{g,parent:node});if(!old){known.set(k,next);open.push(next);}
    }
  }
  const result=[];for(let p=best;p.parent;p=p.parent)result.push({x:p.x,z:p.z});result.reverse();if(found)result.push({x:goal.x,z:goal.z});return result;
}
export class ForestMimic {
  constructor(layout,random=Math.random){this.layout=layout;this.random=random;this.active=false;this.clock=0;this.next=12;this.sequence=0;this.serial=0;this.playing=null;}
  chooseIdentity(players,memory,target){const others=players.filter(p=>p.id!==target.id&&p.alive!==false&&p.connected!==false),recorded=others.filter(p=>memory?.clips.some(c=>c.id===p.id)),pool=recorded.length?recorded:others;return pool.length?pool[Math.floor(this.random()*pool.length)]:target;}
  spawn(focus,players=[focus],memory=null){
    const near=players.filter(p=>p&&p.alive!==false&&p.connected!==false&&biomeOf(p)==='forest');if(!near.length)return false;
    let target=near.find(p=>p.id===focus?.id)||near[Math.floor(this.random()*near.length)];
    const recorded=players.filter(p=>p.alive!==false&&p.connected!==false&&memory?.clips.some(c=>c.id===p.id));
    if(recorded.length&&!recorded.some(p=>p.id!==target.id)){const other=near.find(p=>p.id!==recorded[0].id);if(other)target=other;}
    const source=this.chooseIdentity(players,memory,target),d=10+this.random()*5,a=(target.yaw||0)+(this.random()-.5)*.55;
    Object.assign(this,{active:true,id:'mimic-'+(++this.serial),isMimic:true,biome:'forest',sourceId:source.id,targetId:target.id,username:source.username||'YOU',heldItem:source.heldItem||'none',torch:!!source.torch,x:target.x+Math.sin(a)*d,z:target.z+Math.cos(a)*d,yaw:target.yaw||0,pitch:0,vx:0,vz:0,crouching:false,sprinting:false,stamina:100,staminaDelay:0,exhausted:false,alive:true,state:'follow',stateUntil:this.clock+12+this.random()*10,expires:this.clock+140,echoAt:this.clock+2+this.random()*3,playing:null,steps:0,route:[],routeAt:0,routeGoal:null,perceiveAt:0,seen:false,watched:false,stare:0,unwatched:0,flankAfter:this.clock+3,spawnAt:this.clock,lastSeenAt:this.clock,lastHeardAt:-99,searchPoint:0,stuck:0});
    collideEndlessForest(this,this.layout.seed);this.y=forestTerrainHeight(this.x,this.z)+1.7;
    this.lastKnown={x:target.x,z:target.z,yaw:target.yaw||0,pitch:target.pitch||0,crouching:!!target.crouching,vx:0,vz:0};return true;
  }
  clear(){this.active=false;this.playing=null;this.route=[];this.next=this.clock+25+this.random()*35;}
  forget(id){if(this.playing?.clip.id===id)this.playing=null;}
  snapshot(){if(!this.active)return{active:false};return Object.fromEntries(['active','id','isMimic','biome','sourceId','targetId','username','heldItem','torch','x','y','z','yaw','pitch','vx','vz','crouching','sprinting','alive','state'].map(k=>[k,this[k]]));}
  changeState(state,duration){this.state=state;this.stateUntil=this.clock+duration;this.route=[];this.routeAt=0;}
  observe(target,dt){
    if(this.clock>=this.perceiveAt){
      this.perceiveAt=this.clock+.18;
      const dx=target.x-this.x,dz=target.z-this.z,d=Math.hypot(dx,dz);
      this.seen=d<42&&forestLineOfSight(this.layout.seed,this,target);
      this.watched=this.seen&&d<30&&(dx*Math.sin(target.yaw||0)+dz*Math.cos(target.yaw||0))/Math.max(.01,d)>.65&&Math.abs(target.pitch||0)<1.1;
      if(this.seen){this.lastSeenAt=this.clock;this.lastKnown={x:target.x,z:target.z,yaw:target.yaw||0,pitch:target.pitch||0,crouching:!!target.crouching,vx:target.vx||0,vz:target.vz||0};}
      else if(!target.crouching&&Math.hypot(target.vx||0,target.vz||0)>.7&&d<(target.sprinting?26:12)){
        this.lastHeardAt=this.clock;this.lastKnown={...this.lastKnown,x:target.x+Math.sin(this.clock*1.7)*1.3,z:target.z+Math.cos(this.clock*1.3)*1.3,vx:0,vz:0};
      }
    }
    this.stare=this.watched?this.stare+dt:Math.max(0,this.stare-dt*2);this.unwatched=this.watched?0:this.unwatched+dt;
  }
  steer(goal,target,dt,moving=true){
    const distance=Math.hypot(goal.x-this.x,goal.z-this.z);let waypoint=goal;
    if(moving&&distance>.65){
      if(this.clock>=this.routeAt||!this.routeGoal||Math.hypot(goal.x-this.routeGoal.x,goal.z-this.routeGoal.z)>3){
        this.routeGoal={...goal};this.route=findForestPath(this.layout.seed,this,goal);this.routeAt=this.clock+(this.state==='charge'?.7:1.25);
      }
      while(this.route.length&&Math.hypot(this.route[0].x-this.x,this.route[0].z-this.z)<.65)this.route.shift();
      waypoint=this.route[0]||goal;
      if(!this.route.length&&!forestPathClear(this.layout.seed,this,goal,.35))moving=false;
    }
    const desired=Math.atan2(this.x-waypoint.x,this.z-waypoint.z),turn=Math.atan2(Math.sin(desired-this.yaw),Math.cos(desired-this.yaw)),limit=(this.state==='charge'?5.5:2.6)*dt;
    this.yaw+=Math.max(-limit,Math.min(limit,turn));const go=moving&&distance>.65&&Math.abs(turn)<1.35;
    const moved=moveForestActor(this,{x:0,z:go?1:0,yaw:this.yaw,pitch:target.pitch||0,crouch:this.state!=='charge'&&!!target.crouching,sprint:this.state==='charge'||distance>12&&target.sprinting},dt,this.layout.seed);
    this.stuck=go&&moved<dt*.25?this.stuck+dt:0;if(this.stuck>.8){this.routeAt=0;this.stuck=0;}
  }
  step(dt,players,memory){
    this.clock+=dt;memory.tick(this.clock);
    const near=players.filter(p=>p.alive!==false&&p.connected!==false&&biomeOf(p)==='forest');
    if(!this.active&&this.clock>=this.next){this.next=this.clock+12;if(near.length&&this.random()<.28)this.spawn(near[Math.floor(this.random()*near.length)],players,memory);}if(!this.active)return [];
    const target=near.find(p=>p.id===this.targetId),source=players.find(p=>p.id===this.sourceId&&p.alive!==false&&p.connected!==false);
    if(!target||!source||this.clock>=this.expires||Math.hypot(target.x-this.x,target.z-this.z)>85){this.clear();return [];}
    this.heldItem=source.heldItem||'none';this.torch=!!source.torch;this.observe(target,dt);
    const known=this.lastKnown,d=Math.hypot(known.x-this.x,known.z-this.z),observed=this.seen?target:known;
    if(this.state==='charge'&&!this.seen&&this.clock-Math.max(this.lastSeenAt,this.lastHeardAt)>2.7){this.changeState('search',9);this.searchPoint=0;this.searchGoal={x:known.x,z:known.z};}
    if(this.state==='search'&&this.seen){this.changeState('tell',.9);}
    if(this.state==='follow'&&this.stare>1.8&&d>4&&this.clock>this.flankAfter){
      this.changeState('flank',3.5);this.flankAfter=this.clock+11;const side=this.random()<.5?-1:1,a=known.yaw;
      this.flankGoal={x:known.x+Math.sin(a)*7+Math.cos(a)*side*5,z:known.z+Math.cos(a)*7-Math.sin(a)*side*5};
    }
    if(this.state==='follow'&&this.seen&&d<4.7&&this.unwatched>5&&this.clock-this.spawnAt>8&&!near.some(p=>p.id!==target.id&&Math.hypot(p.x-target.x,p.z-target.z)<10))this.changeState('tell',1.25);
    if(this.clock>=this.stateUntil){
      if(this.state==='follow'){
        this.changeState('lure',10+this.random()*8);const a=known.yaw+(this.random()-.5)*1.1;this.lureGoal={x:known.x-Math.sin(a)*16,z:known.z-Math.cos(a)*16};
      }else if(this.state==='lure')this.changeState('tell',1.25);
      else if(this.state==='tell')this.changeState('charge',18);
      else if(this.state==='flank')this.changeState('follow',7+this.random()*5);
      else{this.clear();return [];}
    }
    if(this.state==='follow'){
      const a=known.yaw,side=Math.sin(this.clock*.55)*.9,goal={x:known.x+Math.sin(a)*4.2+Math.cos(a)*side,z:known.z+Math.cos(a)*4.2-Math.sin(a)*side};
      this.steer(this.watched?known:goal,observed,dt,d>3.5&&(!this.watched||this.stare<.6));
    }else if(this.state==='flank')this.steer(this.flankGoal,observed,dt,true);
    else if(this.state==='lure')this.steer(d>12?known:this.lureGoal,observed,dt,d<12);
    else if(this.state==='search'){
      if(Math.hypot(this.x-this.searchGoal.x,this.z-this.searchGoal.z)<1.4){const a=++this.searchPoint*2.399;this.searchGoal={x:known.x+Math.cos(a)*(2+this.searchPoint),z:known.z+Math.sin(a)*(2+this.searchPoint)};}
      this.steer(this.searchGoal,{pitch:Math.sin(this.clock)*.08,crouching:false},dt,true);
    }else this.steer({x:known.x+(this.seen?known.vx*.34:0),z:known.z+(this.seen?known.vz*.34:0)},observed,dt,this.state==='charge');
    if(this.state==='charge'&&Math.hypot(target.x-this.x,target.z-this.z)<1.15&&forestPathClear(this.layout.seed,this,target,.2)){
      if(!target.godMode){target.alive=false;target.health=0;target.killedBy='mimic';}this.clear();return [];
    }
    if(!this.playing&&this.clock>=this.echoAt&&this.state!=='charge'&&!this.watched){
      const clips=memory.clips.filter(c=>c.id===this.sourceId&&this.clock-c.at>1.5);
      if(clips.length)this.playing={clip:clips[Math.floor(this.random()*clips.length)],index:0,at:this.clock};
      this.echoAt=this.clock+(clips.length?7+this.random()*8:.5);
    }
    const frames=[];let p=this.playing;
    while(p&&this.clock>=p.at&&frames.length<5){
      if(!memory.clips.includes(p.clip)){this.playing=null;break;}
      frames.push({bytes:p.clip.frames[p.index++],sequence:this.sequence++&65535,x:this.x,z:this.z,biome:'forest',sourceId:this.sourceId,targetId:this.targetId,solo:players.length===1});p.at+=.05;
      if(p.index>=p.clip.frames.length){this.playing=null;p=null;}
    }return frames;
  }
}

export function hostDestination(layout,name){
  if(name==='forest'){
    const f=layout.forest,e=f.entrance,d=Math.hypot(f.x-e.x,f.z-e.z);
    return{x:e.x+(f.x-e.x)/d*8,z:e.z+(f.z-e.z)/d*8,yaw:Math.atan2(e.x-f.x,e.z-f.z)};
  }
  if(name==='shed')return{x:128,z:-34,yaw:0};
  if(name==='power'){const p=layout.power;return{x:p.x+30,z:p.z+35,yaw:Math.atan2(30,35)};}
  return null;
}
