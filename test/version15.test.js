import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLayout} from '../shared/world-layout.js';
import {forestTerrainHeight,forestSlope,forestStepAllowed,FOREST_CYCLE_SECONDS} from '../shared/forest-terrain.js';
import {forestChunk,forestChunkCache,forestView,forestPathClear,forestLineOfSight,collideEndlessForest,createForestLevel,activateForest,tickForestLevel} from '../shared/forest-level.js';
import {ForestMimic,MimicMemory,findForestPath} from '../shared/forest-haunts.js';
import {createBodyCamera,stepBodyCamera} from '../shared/camera-motion.js';
import {launch} from './game-harness.js';
const actor=(id,x=0,z=-16)=>({id,biome:'forest',x,z,yaw:0,pitch:0,alive:true,connected:true,stamina:100,crouching:false});
test('forest15 hills and ledges have real relief and steep uphill faces stop traversal',()=>{
  const heights=[];let ledge;
  for(let z=-280;z<0;z+=2)for(let x=-160;x<160;x+=4){heights.push(forestTerrainHeight(x,z));for(const [dx,dz] of [[.16,0],[0,.16],[-.16,0],[0,-.16]]){const a={x,z},b={x:x+dx,z:z+dz};if(!forestStepAllowed(a,b))ledge={a,b};}}
  assert.ok(Math.max(...heights)-Math.min(...heights)>20);assert.ok(ledge);assert.equal(forestStepAllowed(ledge.b,ledge.a),true);assert.equal(forestTerrainHeight(0,-16),.18);
});
test('forest15 rocks collide and grounded forest details regenerate after eviction',()=>{
  const c=forestChunk(42,2,-3),before=JSON.stringify(c);assert.ok(c.details.some(d=>d.kind==='fern'));assert.ok(c.trees.every(t=>t.ground<=forestTerrainHeight(t.x,t.z)));
  const rocks=forestView(42,96,-144,60).chunks.flatMap(c=>c.rocks);assert.ok(rocks.length>3);const r=rocks[0],p={x:r.x,z:r.z};collideEndlessForest(p,42);assert.ok(Math.hypot(p.x-r.x,p.z-r.z)>=r.radius+.28);
  forestChunkCache.delete(c.key);assert.equal(JSON.stringify(forestChunk(42,2,-3)),before);
});
test('forest15 gradual clock completes daylight and night and pauses when empty',()=>{
  const level=activateForest(createForestLevel(0)),p=actor('a'),initial=level.phase,phases=[];
  for(let i=0;i<FOREST_CYCLE_SECONDS;i++){const prev=level.phase;tickForestLevel(level,[p],1);assert.ok(Math.abs(((level.phase-prev+1)%1)-1/FOREST_CYCLE_SECONDS)<1e-9);phases.push(level.phase);}
  assert.ok(phases.some(p=>p>.43&&p<.57));assert.ok(phases.some(p=>p>.80&&p<.90));assert.ok(Math.abs(initial-level.phase)<1e-10);tickForestLevel(level,[],30);assert.ok(Math.abs(initial-level.phase)<1e-10);
});
test('mimic15 local route goes around a boulder using traversable segments',()=>{
  const rocks=forestView(0,0,-80,100).chunks.flatMap(c=>c.rocks);let fixture;
  for(const r of rocks){const a={x:r.x-r.radius-2,z:r.z},b={x:r.x+r.radius+2,z:r.z};if(forestSlope(r.x,r.z)>.3)continue;const p={...a},q={...b};collideEndlessForest(p,0);collideEndlessForest(q,0);if(Math.hypot(p.x-a.x,p.z-a.z)+Math.hypot(q.x-b.x,q.z-b.z)<.01){fixture={a,b};break;}}
  assert.ok(fixture);const {a,b}=fixture;assert.equal(forestPathClear(0,a,b,.36),false);const route=findForestPath(0,a,b);assert.ok(route.length>1&&route.length<181);assert.ok(Math.hypot(route.at(-1).x-b.x,route.at(-1).z-b.z)<.01);
  let previous=a;for(const point of route){assert.ok(forestPathClear(0,previous,point,.36));previous=point;}
});
test('mimic15 pauses when watched then takes a flanking route',()=>{
  const target=actor('a'),friend=actor('b',50,-100),memory=new MimicMemory(),m=new ForestMimic(makeLayout(0),()=>.1);m.spawn(target,[target,friend],memory);Object.assign(m,{x:0,z:-10,yaw:Math.PI,stateUntil:100,flankAfter:0});target.yaw=Math.PI;
  for(let i=0;i<20;i++)m.step(.05,[target,friend],memory);assert.equal(m.watched,true);assert.ok(Math.hypot(m.vx,m.vz)<.01);
  for(let i=0;i<22;i++)m.step(.05,[target,friend],memory);assert.equal(m.state,'flank');assert.ok(m.flankGoal&&Math.abs(m.flankGoal.x)>3);
});
test('mimic15 cannot track a silent target through a trunk and searches its last sighting',()=>{
  const t=forestChunk(0,1,1).trees[0],target=actor('a',t.x+2,t.z),friend=actor('b',80,90),memory=new MimicMemory(),m=new ForestMimic(makeLayout(0),()=>.1);target.crouching=true;m.spawn(target,[target,friend],memory);Object.assign(m,{x:t.x-2,z:t.z,state:'charge',stateUntil:100,lastSeenAt:-10,lastHeardAt:-10,perceiveAt:0,lastKnown:{x:t.x+2,z:t.z-3,yaw:0,crouching:true,vx:0,vz:0}});
  assert.equal(forestLineOfSight(0,m,target),false);const known={...m.lastKnown};m.step(.05,[target,friend],memory);assert.equal(m.state,'search');assert.deepEqual(m.lastKnown,known);assert.equal(target.alive,true);
});
test('camera15 turn inertia is bounded, settles, handles yaw wrap and resets on teleport',()=>{
  const c=createBodyCamera(),i={x:0,z:0,yaw:3.13,pitch:0,ground:0,speed:0,amount:.7};stepBodyCamera(c,i,.016);stepBodyCamera(c,{...i,yaw:-3.13},.016);assert.ok(Math.abs(c.yawLag)<.02);
  stepBodyCamera(c,{...i,yaw:1,pitch:.8,speed:6.6,sideways:1},.05);assert.ok(Math.abs(c.lean)<.05&&Math.abs(c.yawLag)<.09);
  for(let j=0;j<120;j++)stepBodyCamera(c,{...i,yaw:1,pitch:.8},1/60);assert.ok(Math.abs(c.lean)+Math.abs(c.yawLag)<.001);
  stepBodyCamera(c,{...i,x:200,z:-400,ground:12},.016);assert.equal(c.vertical,0);assert.ok(Object.values(c).every(Number.isFinite));
});
test('camera15 reduced motion removes inertia and motion blur',()=>{
  const c=createBodyCamera();stepBodyCamera(c,{yaw:0,pitch:0},.016);stepBodyCamera(c,{yaw:1,pitch:1,speed:6.6,ground:2},.05);stepBodyCamera(c,{yaw:2,pitch:1,speed:6.6,ground:3,enabled:false},.05);
  for(const key of ['lean','pitch','yawLag','pitchLag','vertical','turnX','turnY'])assert.equal(c[key],0);
});
test('camera15 exposure adapts gradually between dark canopy and bright daylight',()=>{
  const c=createBodyCamera(),dark={yaw:0,pitch:0,day:0,canopy:1};stepBodyCamera(c,dark,.016);assert.ok(c.exposure>1&&c.exposure<1.01);
  for(let i=0;i<160;i++)stepBodyCamera(c,dark,.05);const before=c.exposure;assert.ok(before>1.2&&before<=1.3);stepBodyCamera(c,{...dark,day:1,canopy:0},.016);assert.ok(c.exposure<before&&c.exposure>.96);
});
test('forest15 full client grounds players and props on hills and keeps pickup projection aligned',()=>{
  const {run,document}=launch();run("resetWorld(true,0);setMode('playing');locked=true;hostAction('teleport',{destination:'forest'});player.x=46;player.z=-100;updateForestLevelClient(.016);updateEnvironment(.016);updateCamera(.016);buildObjects();");
  assert.ok(run('objectDraws.some(o=>o.assetKind===14)&&objectDraws.some(o=>o.assetKind===13)'));assert.ok(run('Math.abs(player.y-game.eyeHeight-forestTerrainHeight(player.x,player.z))<1e-6'));
  assert.equal(Number(document.getElementById('bodycam').value),.7);assert.ok(run('cameraLensStrength()>.1'));assert.ok(run('viewProjection.every(Number.isFinite)'));
  const screen=run('projectPickup([player.x+forward[0]*2,player.y+forward[1]*2,player.z+forward[2]*2])');assert.ok(screen.every(Number.isFinite));assert.ok(Math.abs(screen[0]-422)<12);
});
