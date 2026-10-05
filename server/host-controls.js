import {hostDestination} from '../shared/forest-haunts.js';
import {floorHeight} from '../shared/physics.js';
import {collideForest} from '../shared/world-layout.js';
export function hostCommand(room,p,value){
  if(room.ownerId!==p.id||room.phase!=='playing'||!p.alive||!p.connected||!value||typeof value!=='object')return false;
  const w=room.world;
  if(value.command==='tablet'&&typeof value.enabled==='boolean'){
    p.tabletOpen=value.enabled;p.input.x=p.input.z=p.vx=p.vz=0;p.sprinting=false;return true;
  }
  if(value.command==='god'||value.command==='sprint'){
    if(typeof value.enabled!=='boolean')return false;
    p[value.command==='god'?'godMode':'infiniteSprint']=value.enabled;
    if(p.infiniteSprint){p.stamina=100;p.staminaDelay=0;p.exhausted=false;}return true;
  }
  if(value.command==='teleport'){
    const target=hostDestination(w.layout,value.destination);if(!target)return false;
    Object.assign(p,target);collideForest(p,w.layout);p.y=floorHeight(p.x,p.z)+(p.crouching?.72:1.7);p.pitch=0;
    Object.assign(p.input,{x:0,z:0,yaw:p.yaw,pitch:0,sprint:false});p.vx=p.vz=0;p.sprinting=false;return true;
  }
  if(value.command==='mimic')return w.mimic.spawn(p);
  if(value.command==='clearMimic'){w.mimic.clear();return true;}
  if(value.command==='wake'){
    w.turbineStopped=w.powerStopped=false;w.sim.noise(p,10000);return true;
  }
  return false;
}
