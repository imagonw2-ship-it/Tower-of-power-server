// Forest mimics have no body. Speech stays in a short, bounded RAM buffer only.
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
  constructor(layout,random=Math.random){this.layout=layout;this.random=random;this.active=false;this.clock=0;this.next=12;this.sequence=0;this.playing=null;}
  spawn(focus){
    const f=this.layout.forest,r=this.random,a=r()*Math.PI*2;
    const base=focus&&Math.hypot(focus.x-f.x,focus.z-f.z)<f.radius?focus:f;
    let x=base.x+Math.cos(a)*(10+r()*13),z=base.z+Math.sin(a)*(10+r()*13),d=Math.hypot(x-f.x,z-f.z);
    if(d>f.radius-14){x=f.x+(x-f.x)/d*(f.radius-14);z=f.z+(z-f.z)/d*(f.radius-14);}
    Object.assign(this,{active:true,x,z,expires:this.clock+45+r()*25,echoAt:this.clock+3+r()*4,playing:null});return true;
  }
  clear(){this.active=false;this.playing=null;this.next=this.clock+25+this.random()*35;}
  forget(id){if(this.playing?.clip.id===id)this.playing=null;}
  step(dt,players,memory){
    this.clock+=dt;memory.tick(this.clock);
    const f=this.layout.forest,near=players.filter(p=>p.alive!==false&&p.connected!==false&&Math.hypot(p.x-f.x,p.z-f.z)<f.radius);
    if(!this.active&&this.clock>=this.next){this.next=this.clock+12;if(near.length&&this.random()<.28)this.spawn(near[Math.floor(this.random()*near.length)]);}
    if(!this.active)return [];
    if(this.clock>=this.expires){this.clear();return [];}
    if(!this.playing&&near.length&&this.clock>=this.echoAt){
      const clips=memory.clips.filter(c=>this.clock-c.at>1.5);
      if(clips.length){this.playing={clip:clips[Math.floor(this.random()*clips.length)],index:0,at:this.clock};}
      this.echoAt=this.clock+9+this.random()*9;
    }
    const frames=[];let p=this.playing;
    while(p&&this.clock>=p.at&&frames.length<5){
      if(!memory.clips.includes(p.clip)){this.playing=null;break;}
      frames.push({bytes:p.clip.frames[p.index++],sequence:this.sequence++&65535,x:this.x,z:this.z});p.at+=.05;
      if(p.index>=p.clip.frames.length){this.playing=null;p=null;}
    }
    return frames;
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
