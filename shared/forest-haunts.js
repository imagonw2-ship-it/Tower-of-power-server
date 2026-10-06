import {biomeOf,collideEndlessForest,forestTerrainHeight,forestPathClear,moveForestActor} from './forest-level.js';
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
export class ForestMimic {
  constructor(layout,random=Math.random){this.layout=layout;this.random=random;this.active=false;this.clock=0;this.next=12;this.sequence=0;this.serial=0;this.playing=null;}
  chooseIdentity(players,memory,target){const others=players.filter(p=>p.id!==target.id&&p.alive!==false&&p.connected!==false),recorded=others.filter(p=>memory?.clips.some(c=>c.id===p.id)),pool=recorded.length?recorded:others;return pool.length?pool[Math.floor(this.random()*pool.length)]:target;}
  spawn(focus,players=[focus],memory=null){const near=players.filter(p=>p&&p.alive!==false&&p.connected!==false&&biomeOf(p)==='forest');if(!near.length)return false;let target=near.find(p=>p.id===focus?.id)||near[Math.floor(this.random()*near.length)];const recorded=players.filter(p=>p.alive!==false&&p.connected!==false&&memory?.clips.some(c=>c.id===p.id));if(recorded.length&&!recorded.some(p=>p.id!==target.id)){const other=near.find(p=>p.id!==recorded[0].id);if(other)target=other;}const source=this.chooseIdentity(players,memory,target),d=8+this.random()*5;
    Object.assign(this,{active:true,id:'mimic-'+(++this.serial),isMimic:true,biome:'forest',sourceId:source.id,targetId:target.id,username:source.username||'YOU',heldItem:source.heldItem||'none',torch:!!source.torch,x:target.x+Math.sin(target.yaw||0)*d,z:target.z+Math.cos(target.yaw||0)*d,yaw:target.yaw||0,pitch:0,vx:0,vz:0,crouching:false,sprinting:false,stamina:100,staminaDelay:0,exhausted:false,alive:true,state:'follow',stateUntil:this.clock+12+this.random()*10,expires:this.clock+95+this.random()*25,echoAt:this.clock+2+this.random()*3,playing:null,steps:0});collideEndlessForest(this,this.layout.seed);this.y=forestTerrainHeight(this.x,this.z)+1.7;return true;
  }
  clear(){this.active=false;this.playing=null;this.next=this.clock+25+this.random()*35;}
  forget(id){if(this.playing?.clip.id===id)this.playing=null;}
  snapshot(){if(!this.active)return{active:false};return Object.fromEntries(['active','id','isMimic','biome','sourceId','targetId','username','heldItem','torch','x','y','z','yaw','pitch','vx','vz','crouching','sprinting','alive','state'].map(k=>[k,this[k]]));}
  steer(goal,target,dt,moving=true){let desired=Math.atan2(this.x-goal.x,this.z-goal.z);const d=Math.hypot(goal.x-this.x,goal.z-this.z);if(moving&&d>.6){for(const offset of [0,.5,-.5,.95,-.95,1.5,-1.5,2.2,-2.2]){const a=desired+offset,p={x:this.x-Math.sin(a)*2.2,z:this.z-Math.cos(a)*2.2};if(forestPathClear(this.layout.seed,this,p,.37)){desired=a;break;}}}const turn=Math.atan2(Math.sin(desired-this.yaw),Math.cos(desired-this.yaw)),limit=(this.state==='charge'?5:2.8)*dt;this.yaw+=Math.max(-limit,Math.min(limit,turn));moveForestActor(this,{x:0,z:moving&&d>.65?1:0,yaw:this.yaw,pitch:target.pitch||0,crouch:this.state!=='charge'&&!!target.crouching,sprint:this.state==='charge'||d>12&&target.sprinting},dt,this.layout.seed);}
  step(dt,players,memory){this.clock+=dt;memory.tick(this.clock);const near=players.filter(p=>p.alive!==false&&p.connected!==false&&biomeOf(p)==='forest');if(!this.active&&this.clock>=this.next){this.next=this.clock+12;if(near.length&&this.random()<.28)this.spawn(near[Math.floor(this.random()*near.length)],players,memory);}if(!this.active)return [];
    const target=near.find(p=>p.id===this.targetId),source=players.find(p=>p.id===this.sourceId&&p.alive!==false&&p.connected!==false);if(!target||!source||this.clock>=this.expires||Math.hypot(target.x-this.x,target.z-this.z)>75){this.clear();return [];}
    this.heldItem=source.heldItem||'none';this.torch=!!source.torch;const d=Math.hypot(target.x-this.x,target.z-this.z);
    if(this.clock>=this.stateUntil){if(this.state==='follow'){this.state='lure';this.stateUntil=this.clock+10+this.random()*12;const a=target.yaw+(this.random()-.5)*1.3;this.lureGoal={x:target.x-Math.sin(a)*18,z:target.z-Math.cos(a)*18};}else if(this.state==='lure'){this.state='tell';this.stateUntil=this.clock+1.25;}else if(this.state==='tell'){this.state='charge';this.stateUntil=this.clock+15;}else{this.clear();return [];}}
    if(this.state==='follow'){const a=target.yaw||0,side=Math.sin(this.clock*.7)*1.2;this.steer({x:target.x+Math.sin(a)*4.5+Math.cos(a)*side,z:target.z+Math.cos(a)*4.5-Math.sin(a)*side},target,dt,d>3);}
    else if(this.state==='lure')this.steer(d>17?target:this.lureGoal,target,dt,d<17);
    else this.steer({x:target.x+(target.vx||0)*.22,z:target.z+(target.vz||0)*.22},target,dt,this.state==='charge');
    if(this.state==='charge'&&d<1.15&&forestPathClear(this.layout.seed,this,target,.2)){if(!target.godMode){target.alive=false;target.health=0;target.killedBy='mimic';}this.clear();return [];}
    if(!this.playing&&this.clock>=this.echoAt){const clips=memory.clips.filter(c=>c.id===this.sourceId&&this.clock-c.at>1.5);if(clips.length)this.playing={clip:clips[Math.floor(this.random()*clips.length)],index:0,at:this.clock};this.echoAt=this.clock+(clips.length?7+this.random()*8:.5);}
    const frames=[];let p=this.playing;while(p&&this.clock>=p.at&&frames.length<5){if(!memory.clips.includes(p.clip)){this.playing=null;break;}frames.push({bytes:p.clip.frames[p.index++],sequence:this.sequence++&65535,x:this.x,z:this.z,biome:'forest',sourceId:this.sourceId,targetId:this.targetId,solo:players.length===1});p.at+=.05;if(p.index>=p.clip.frames.length){this.playing=null;p=null;}}return frames;
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
