import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrafficLights,stepTrafficLights,snapshotTrafficLights,trafficLightGeometry,setTrafficLightsStopped,collideTrafficPoles,SIGNAL_STOMP,SIGNAL_HEAD_SCALE} from '../shared/traffic-light.js';
import {hostCommand} from '../server/host-controls.js';
import {makeWorld,serializeWorld,tickWorld} from '../server/worlds.js';
import {makePlayer} from '../server/players.js';
import {Rooms} from '../server/rooms.js';
import {config} from '../server/config.js';
import {launch} from './game-harness.js';
const flat=()=>0,{run,document}=launch();
function scene(){
  const s=createTrafficLights({roadside:{signals:[{id:'signal',x:0,z:0,heading:0}]}},flat)[0];
  Object.assign(s,{active:true,phase:'green',targetId:'p'});
  const p={id:'p',x:5.2,z:2,y:1.7,alive:true,connected:true,biome:'meadow',godMode:false};
  return{s,p};
}
function advance(s,p,seconds,hit=()=>{}){for(let i=0;i<Math.round(seconds*120);i++)stepTrafficLights([s],1/120,[p],flat,[],hit);}
function room(){const world=makeWorld(config,0),p=makePlayer({id:'host',username:'HOST'},0);p.connected=p.alive=true;return{ownerId:'host',phase:'playing',world,players:new Map([[p.id,p]])};}

test('stomp lifts the near pole, plants the support pole, and locks its landing point',()=>{
  const {s,p}=scene(),support=s.feet[0].position.slice();advance(s,p,.55);
  assert.equal(s.stomp.foot,1);assert.equal(s.stomp.phase,'windup');assert.ok(s.feet[1].position[1]>2.6);assert.deepEqual(s.feet[0].position,support);
  const target=s.stomp.target.slice();p.z+=5;advance(s,p,.7);assert.deepEqual(s.stomp.target,target);assert.equal(p.alive,true);assert.equal(s.impactSerial,1);
});
test('stomp damage happens once at impact and recovery finishes without foot teleportation',()=>{
  const {s,p}=scene();let hits=0;advance(s,p,SIGNAL_STOMP.windup+.1,()=>hits++);assert.equal(hits,0);assert.equal(p.alive,true);
  advance(s,p,.25,()=>hits++);assert.equal(hits,1);assert.equal(p.alive,false);
  let maxStep=0;for(let i=0;i<100;i++){const before=s.feet[1].position.slice();advance(s,p,1/120,()=>hits++);maxStep=Math.max(maxStep,Math.hypot(...s.feet[1].position.map((v,k)=>v-before[k])));}
  assert.equal(hits,1);assert.equal(s.stomp,null);assert.ok(maxStep<.25);assert.equal(s.feet[1].position[1],0);
});
test('a dodged stomp does not home, hit elevated players, or repeat damage during cooldown',()=>{
  const {s,p}=scene();advance(s,p,.4);p.y=5;advance(s,p,1.4);assert.equal(p.alive,true);assert.equal(s.impactSerial,1);assert.ok(s.stompCooldown>1.5);
  p.y=1.7;advance(s,p,.8);assert.equal(s.impactSerial,1);assert.equal(p.alive,true);
});
test('paused traffic freezes a descending attack and its cables, then resumes normally',()=>{
  const {s,p}=scene();advance(s,p,.9);assert.equal(s.stomp.phase,'strike');setTrafficLightsStopped([s],true);
  const before=snapshotTrafficLights([s]);advance(s,p,5);assert.deepEqual(snapshotTrafficLights([s]),before);assert.equal(p.alive,true);assert.equal(before[0].phase,'red');
  setTrafficLightsStopped([s],false);advance(s,p,.3);assert.equal(s.impactSerial,1);assert.equal(p.alive,false);
});
test('god mode and biome or connection changes remain protected at impact',()=>{
  for(const changes of [{godMode:true},{biome:'forest'},{connected:false},{alive:false}]){
    const {s,p}=scene();advance(s,p,.5);Object.assign(p,changes);let hits=0;advance(s,p,.8,()=>hits++);assert.equal(hits,0);
  }
});
test('host traffic command validates permission and boolean input and affects only its room',()=>{
  const a=room(),b=room(),host=a.players.get('host'),guest=makePlayer({id:'guest',username:'GUEST'},1);guest.connected=guest.alive=true;
  assert.equal(hostCommand(a,guest,{command:'traffic',enabled:true}),false);assert.equal(hostCommand(a,host,{command:'traffic',enabled:'true'}),false);
  assert.equal(hostCommand(a,host,{command:'traffic',enabled:true}),true);assert.equal(a.world.trafficStopped,true);assert.ok(a.world.trafficLights.every(s=>s.paused));assert.equal(b.world.trafficStopped,false);
  assert.equal(serializeWorld(a.world).trafficStopped,true);assert.equal(Rooms.prototype.snapshot.call({},a).world.trafficStopped,true);
  assert.equal(hostCommand(a,host,{command:'traffic',enabled:false}),true);assert.ok(a.world.trafficLights.every(s=>!s.paused));
});
test('host pause survives world ticks and a new room starts with traffic enabled',()=>{
  const r=room(),p=r.players.get('host');r.world.started=true;const s=r.world.trafficLights[0];Object.assign(p,{x:s.x,z:s.z+25,godMode:true});
  hostCommand(r,p,{command:'traffic',enabled:true});const before=snapshotTrafficLights(r.world.trafficLights);for(let i=0;i<20;i++)tickWorld(r.world,[p],.05,Date.now());
  assert.deepEqual(snapshotTrafficLights(r.world.trafficLights),before);assert.equal(room().world.trafficStopped,false);
});
test('raised pole clearance lets players dodge beneath it and grounded poles remain solid',()=>{
  const {s}=scene(),p={x:5.2,z:0,y:1.7};s.feet[1].position[1]=3;collideTrafficPoles(p,[s]);assert.equal(p.x,5.2);
  s.feet[1].position[1]=0;collideTrafficPoles(p,[s]);assert.ok(Math.abs(p.x-5.2)>=.449);
});
test('rendered head is enlarged and both pole cable wraps follow the lifted pose',()=>{
  run("net.code='';resetWorld(true,0);setMode('playing');locked=true;const qaSignal=trafficLights[0];player.x=qaSignal.x;player.z=qaSignal.z+15;player.y=terrainHeight(player.x,player.z)+1.7;updateCamera(0);objectDraws.length=0;appendRoadside();");
  assert.equal(run('objectDraws.filter(o=>o.trafficWrap).length'),2);assert.equal(run('objectDraws.filter(o=>o.signalLens).length'),3);
  assert.ok(Math.abs(run('Math.hypot(...objectDraws.find(o=>o.signalHead).model.slice(0,3))')-SIGNAL_HEAD_SCALE)<1e-6);
  run('qaSignal.feet[1].position[1]+=2;objectDraws.length=0;appendRoadside();');
  assert.ok(run('objectDraws.every(o=>Array.from(o.model).every(Number.isFinite))'));assert.ok(run('Math.abs(objectDraws.filter(o=>o.trafficWrap)[1].model[13]-qaSignal.feet[1].position[1])<.000001'));
  const s=scene().s,g=trafficLightGeometry(s);assert.ok(g.head[1]<4.3);assert.ok(g.attachments[0][1]<g.tops[0][1]);
});
test('the complete stomp and suspended head stay stable across slow and fast frame rates',()=>{
  const a=scene(),b=scene();a.p.godMode=b.p.godMode=true;
  for(let i=0;i<30;i++)stepTrafficLights([a.s],1/20,[a.p],flat);
  for(let i=0;i<180;i++)stepTrafficLights([b.s],1/120,[b.p],flat);
  assert.deepEqual(snapshotTrafficLights([a.s]),snapshotTrafficLights([b.s]));
});
test('tablet stops and resumes solo traffic, resets cleanly, and is unavailable to guests',()=>{
  run("net.code='';resetWorld(true,0);setMode('playing');refreshTablet();");const button=document.getElementById('trafficToggle');button.click();
  assert.equal(run('world.trafficStopped'),true);assert.equal(button.getAttribute('aria-pressed'),'true');assert.equal(button.textContent,'RESUME TRAFFIC LIGHTS');assert.ok(run('trafficLights.every(s=>s.paused)'));
  button.click();assert.equal(run('world.trafficStopped'),false);assert.equal(button.textContent,'STOP TRAFFIC LIGHTS');
  run("hostAction('traffic',{enabled:true});resetWorld(true,0);refreshTablet();");assert.equal(run('world.trafficStopped'),false);
  run("net.code='QA';net.player={id:'guest'};net.snapshots=[{ownerId:'host',players:[],world:{}}];refreshTablet();");assert.equal(button.disabled,true);assert.equal(run("hostAction('traffic',{enabled:true})"),false);run("net.code='';");
});
