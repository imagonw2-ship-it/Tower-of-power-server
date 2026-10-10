import {hostDestination} from '../shared/forest-haunts.js';
import {floorHeight} from '../shared/physics.js';
import {collideForest} from '../shared/world-layout.js';
import {biomeOf,enterForest,activateForest,forestTerrainHeight,collideEndlessForest} from '../shared/forest-level.js';
import {summonItem} from './items.js';
import {setTrafficLightsStopped} from '../shared/traffic-light.js';
function settle(p,w){if(biomeOf(p)==='forest'){activateForest(w.forestLevel);collideEndlessForest(p,w.seed);p.y=forestTerrainHeight(p.x,p.z)+(p.crouching?.72:1.7);}else{collideForest(p,w.layout);p.y=floorHeight(p.x,p.z)+(p.crouching?.72:1.7);}p.pitch=0;p.teleportSeq=(p.teleportSeq||0)+1;p.levelCooldown=3;Object.assign(p.input,{x:0,z:0,yaw:p.yaw,pitch:0,sprint:false});p.vx=p.vz=0;p.sprinting=false;}
export function hostCommand(room,p,value){
  if(room.ownerId!==p.id||room.phase!=='playing'||!p.alive||!p.connected||!value||typeof value!=='object')return false;
  const w=room.world;
  if(value.command==='traffic'){if(typeof value.enabled!=='boolean')return false;w.trafficStopped=value.enabled;setTrafficLightsStopped(w.trafficLights,value.enabled);return true;}
  if(value.command==='tablet'&&typeof value.enabled==='boolean'){p.tabletOpen=value.enabled;p.input.x=p.input.z=p.vx=p.vz=0;p.sprinting=false;return true;}
  if(value.command==='god'||value.command==='sprint'){if(typeof value.enabled!=='boolean')return false;p[value.command==='god'?'godMode':'infiniteSprint']=value.enabled;if(p.infiniteSprint){p.stamina=100;p.staminaDelay=0;p.exhausted=false;}return true;}
  if(value.command==='teleport'){const target=hostDestination(w.layout,value.destination);if(!target)return false;if(value.destination==='forest')enterForest(p,w.layout,w.forestLevel);else Object.assign(p,target,{biome:'meadow'});settle(p,w);return true;}
  if(value.command==='playerTeleport'){const target=room.players.get(value.targetId),destination=room.players.get(value.destinationId);if(!target?.alive||!target.connected||!destination?.alive||!destination.connected||target.id===destination.id)return false;Object.assign(target,{x:destination.x+Math.cos(destination.yaw)*1.8,z:destination.z-Math.sin(destination.yaw)*1.8,yaw:destination.yaw,biome:biomeOf(destination),meadowReturn:destination.meadowReturn?{...destination.meadowReturn}:undefined});settle(target,w);return true;}
  if(value.command==='playerEffect'){const target=room.players.get(value.targetId);if(!target?.alive||!target.connected)return false;switch(value.effect){case 'god':case 'sprint':if(typeof value.enabled!=='boolean')return false;target[value.effect==='god'?'godMode':'infiniteSprint']=value.enabled;break;case 'boost':target.boost=30;target.slow=0;break;case 'slow':target.slow=20;target.boost=0;break;case 'freeze':target.frozen=10;target.input.x=target.input.z=target.vx=target.vz=0;break;case 'clear':target.boost=target.slow=target.frozen=0;target.godMode=target.infiniteSprint=false;break;default:return false;}return true;}
  if(value.command==='item')return summonItem(w,p,value.kind);
  if(value.command==='mimic')return w.mimic.spawn(p,[...room.players.values()],w.voiceMemory);
  if(value.command==='clearMimic'){w.mimic.clear();return true;}
  if(value.command==='wake'){w.turbineStopped=w.powerStopped=false;for(const target of room.players.values())if(biomeOf(target)==='meadow')w.sim.noise(target,10000);return true;}
  return false;
}
