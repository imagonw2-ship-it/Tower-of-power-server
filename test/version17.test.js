import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLayout,nearestRoad} from '../shared/world-layout.js';
import {collideRoadside} from '../shared/roadside.js';
import {createTrafficLights,stepTrafficLights,trafficLightGeometry,snapshotTrafficLights,SIGNAL_SPEED} from '../shared/traffic-light.js';
import {advancePackMotion} from '../shared/prop-motion.js';
import {terrainHeight,movePlayer} from '../shared/physics.js';
import {makeWorld,tickWorld} from '../server/worlds.js';
import {makePlayer} from '../server/players.js';
import {Rooms} from '../server/rooms.js';
import {config} from '../server/config.js';
import {launch} from './game-harness.js';
const flat=()=>0,layout=makeLayout(0),{run,document}=launch();
function signal(){return createTrafficLights({roadside:{signals:[{id:'test',x:0,z:0,heading:0}]}},flat)[0];}
function target(overrides={}){return{id:'p',x:0,z:60,alive:true,connected:true,biome:'meadow',godMode:true,...overrides};}
function advance(s,seconds,p=target(),fps=60){for(let i=0;i<Math.round(seconds*fps);i++)stepTrafficLights([s],1/fps,[p],flat);}
function active(s,phase='green'){Object.assign(s,{active:true,phase,targetId:'p',phaseTime:0});return s;}
function local(){run("net.code='';resetWorld(true,0);setMode('playing');locked=true;player.yaw=0;player.pitch=0;updateCamera(0);");}

test('seeded fences and signal encounters agree across rebuilds, with seed-dependent placement',()=>{
  assert.deepEqual(makeLayout(0).roadside,layout.roadside);assert.notDeepEqual(makeLayout(1).roadside,layout.roadside);
  assert.ok(layout.roadside.signals.length>0&&layout.roadside.signals.length<=3);
  assert.notEqual(makeLayout(2).roadside.signals.length,layout.roadside.signals.length);
});
test('fences stay beside roads and leave the shed, forest edge, and junctions clear',()=>{
  for(const f of layout.roadside.fences)for(const p of [f.a,f.b,{x:(f.a.x+f.b.x)/2,z:(f.a.z+f.b.z)/2}]){
    const d=nearestRoad(p.x,p.z,layout).distance;assert.ok(d>5.4&&d<6.21);assert.ok(Math.hypot(p.x-134,p.z+43)>32);assert.ok(Math.hypot(p.x-layout.forest.x,p.z-layout.forest.z)>layout.forest.radius+15);
  }
});
test('fence collisions agree with authoritative movement and are absent in the forest',()=>{
  const l={bounds:[-1000,-1000,1000,1000],roadside:{fences:[{a:{x:0,z:-10},b:{x:0,z:10}}]}},p={x:.1,z:0};collideRoadside(p,l);assert.ok(p.x>=.399);
  const forest={x:.1,z:0,biome:'forest'};collideRoadside(forest,l);assert.equal(forest.x,.1);
  const actor=makePlayer({id:'x',username:'X'},0);Object.assign(actor,{x:.7,z:0,infiniteSprint:true});
  for(let i=0;i<30;i++)movePlayer(actor,{x:-1,z:0,yaw:0,pitch:0,sprint:true},.05,[],()=>{},l);assert.ok(actor.x>=.399);
});
test('import uses one horizontal head with a larger displayed size and a lower cable span',()=>{
  assert.equal(run('TRAFFIC_LIGHT_ASSET.headCount'),1);assert.equal(run('TRAFFIC_LIGHT_ASSET.lensDiameter'),.2032);
  const bounds=run(`(()=>{const p=TRAFFIC_LIGHT_ASSET.meshes.flatMap(m=>{const b=Uint8Array.from(atob(m.vertices),c=>c.charCodeAt(0)),v=new DataView(b.buffer);return Array.from({length:m.vertexCount},(_,i)=>[0,4,8].map(k=>v.getFloat32(i*32+k,true)));});return[0,1,2].map(k=>Math.max(...p.map(v=>v[k]))-Math.min(...p.map(v=>v[k])));})()`);
  assert.ok(bounds[0]>.8&&bounds[0]<.9&&bounds[1]<.34);const g=trafficLightGeometry(signal());assert.ok(g.head[1]>4&&g.head[1]<4.3);assert.equal(g.tops.length,2);assert.ok(g.attachments.every((p,i)=>p[1]<g.tops[i][1]-.5));
});
test('green accelerates beyond boosted sprint speed; yellow slows before the red stop',()=>{
  const s=active(signal());advance(s,1);assert.ok(Math.hypot(s.vx,s.vz)>9.24);s.phase='yellow';s.phaseTime=0;advance(s,1);assert.ok(Math.hypot(s.vx,s.vz)<3);assert.ok(SIGNAL_SPEED.green>9.24);
});
test('red freezes pole travel and allows the hanging head to settle independently',()=>{
  const s=active(signal());advance(s,1);s.phase='red';s.phaseTime=0;const old=[s.x,s.z,...s.feet.flatMap(f=>[f.position[0],f.position[2]])],before=trafficLightGeometry(s).head;
  advance(s,.5);assert.deepEqual([s.x,s.z,...s.feet.flatMap(f=>[f.position[0],f.position[2]])],old);assert.equal(s.vx,0);assert.equal(s.vz,0);assert.notDeepEqual(trafficLightGeometry(s).head,before);
});
test('poles alternate planted and lifted steps instead of translating as a rigid frame',()=>{
  const s=active(signal());let lifted=false,planted=false;
  for(let i=0;i<90;i++){const before=s.feet.map(f=>f.position.slice());advance(s,1/60);lifted||=s.feet.some(f=>f.position[1]>.2);planted||=s.feet.some((f,i)=>f.position[0]===before[i][0]&&f.position[2]===before[i][2]);}
  assert.ok(lifted&&planted);assert.ok(s.feet.every(f=>f.position[1]>=0));
});
test('movement and cable physics are stable at both 20 fps and 120 fps',()=>{
  const a=active(signal()),b=active(signal());advance(a,2,target(),20);advance(b,2,target(),120);
  for(const k of ['x','z','heading','swingX','swingZ'])assert.ok(Math.abs(a[k]-b[k])<1e-7,k);
  a.active=false;a.phase='red';for(let i=0;i<80;i++)stepTrafficLights([a],.1,[],flat);assert.ok(Math.abs(a.swingZ)<.01);assert.ok(trafficLightGeometry(a).head.every(Number.isFinite));
});
test('signals warn before chasing and ignore forest, dead, disconnected, and sheltered players',()=>{
  const s=signal();stepTrafficLights([s],.1,[target({biome:'forest'}),target({alive:false}),target({connected:false})],flat);assert.equal(s.active,false);
  stepTrafficLights([s],.1,[target()],flat,[{x:0,z:60,r:6,shelter:true}]);assert.equal(s.active,false);
  advance(s,.1);assert.equal(s.active,true);assert.equal(s.phase,'yellow');advance(s,1.4);assert.equal(s.phase,'red');advance(s,4.6);assert.equal(s.phase,'green');
});
test('poles warn before stomping; ordinary contact, red lights and god mode are safe',()=>{
  const victim=target({x:5.2,z:0,godMode:false}),s=active(signal());let caught=0;stepTrafficLights([s],.05,[victim],flat,[],()=>caught++);assert.equal(caught,0);assert.equal(victim.alive,true);assert.equal(s.stomp.phase,'windup');
  for(let i=0;i<70;i++)stepTrafficLights([s],1/60,[victim],flat,[],()=>caught++);assert.equal(caught,1);assert.equal(victim.alive,false);
  const safe=target({x:5.2,z:0}),t=active(signal());stepTrafficLights([t],.05,[safe],flat);assert.equal(safe.alive,true);
  const red=active(signal(),'red'),p=target({x:5.2,z:0,godMode:false});stepTrafficLights([red],.1,[p],flat);assert.equal(p.alive,true);
});
test('server snapshots carry every signal and vacant meadow simulation sleeps',()=>{
  const w=makeWorld(config,0);w.started=true;const before=snapshotTrafficLights(w.trafficLights);tickWorld(w,[],.05,Date.now());assert.deepEqual(snapshotTrafficLights(w.trafficLights),before);
  const r={code:'TEST',ownerId:'host',phase:'playing',players:new Map(),world:w};const snap=Rooms.prototype.snapshot.call({},r);assert.deepEqual(snap.world.trafficLights,before);assert.equal(snap.world.layoutVersion,9);
  local();run(`net.code='QA';net.snapshots=[{received:performance.now(),world:{trafficLights:${JSON.stringify(before)}}}];`);assert.equal(run('visibleTrafficLights().length'),before.length);run("net.code='';");
});
test('both server and local turbine awakening keep the resting heading and turn progressively',()=>{
  const w=makeWorld(config,0),s=w.sim,old=s.enemy.heading,p=target({x:s.turbine.x+25,z:s.turbine.z-20});s.noise(p,200);s.step(.05,[p]);assert.equal(s.enemy.state,'awakening');assert.ok(Math.abs(s.enemy.heading-old)<.01);
  const first=s.enemy.heading;for(let i=0;i<40;i++)s.step(.05,[p]);assert.ok(Math.abs(s.enemy.heading-first)>.1&&Math.abs(s.enemy.heading-first)<1.1);
  local();const h=run('enemy.heading');run('enemy.noise={position:[turbine.x+25,turbine.z-20],life:.3};updateEnemy(.05);');assert.ok(Math.abs(run('enemy.heading')-h)<.01);
});
test('hip-fire is horizontally centered and the dedicated mobile aim button changes sights',()=>{
  local();run("game.hasGun=true;game.ammo=17;equippedTool='gun';equipmentMotion.lower=0;updateGun(0);");
  assert.ok(run('(()=>{const m=heldGunMatrix();return Math.abs(dot([m[12]-cameraPosition[0],m[13]-cameraPosition[1],m[14]-cameraPosition[2]],right))<.0001;})()'));
  assert.equal(document.getElementById('touchGunAim').hidden,false);assert.equal(document.getElementById('touchAim').hidden,true);
  run("document.getElementById('touchGunAim').dispatchEvent(new Event('pointerdown'));for(let i=0;i<40;i++)updateGun(1/60);");assert.ok(run('gunMotion.aim>.99'));assert.equal(document.getElementById('touchGunAim').getAttribute('aria-pressed'),'true');
});
test('pack reversal preserves velocity and local inventory smoothly opens and closes',()=>{
  const a={pack:0},b={pack:0};for(let i=0;i<10;i++)advancePackMotion(a,'pack',1,1/20);for(let i=0;i<60;i++)advancePackMotion(b,'pack',1,1/120);assert.ok(Math.abs(a.pack-b.pack)<1e-9);
  const before=a.pack,v=a.packVelocity;advancePackMotion(a,'pack',0,.00001);assert.ok(Math.abs(a.pack-before)<.00002);assert.ok(Math.abs(a.packVelocity-v)<.001);
  local();run('game.hasBackpack=true;openFieldKit();for(let i=0;i<120;i++)updateBackpack(1/60);updateCamera(0);buildObjects();positionBackpackInventory();');assert.equal(run('backpack.progress'),1);assert.ok(run('objectDraws.filter(o=>o.backpackPart).length===2'));
  run('closeFieldKit();updateBackpack(1/60);');assert.equal(run('game.mode'),'inventory');assert.ok(run('backpack.progress>.99'));run('for(let i=0;i<100;i++)updateBackpack(1/60);');assert.equal(run('game.mode'),'playing');assert.equal(run('backpack.progress'),0);
});
