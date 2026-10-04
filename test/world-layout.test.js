import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLayout,makeLayoutLookup,nearestRoad,segmentDistanceSquared,seedFromText,forestForLayout,collideForest} from '../shared/world-layout.js';
import {roadOffset,grassCover,terrainHeight,movePlayer} from '../shared/physics.js';
import {PYLON_RIG,PYLON_SOCKETS,groundedPylon,pylonPoint,cablePoint} from '../shared/power-layout.js';
import {makeWorld,serializeWorld,startWorld,growPylons} from '../server/worlds.js';
import {Rooms} from '../server/rooms.js';
import {config} from '../server/config.js';
import {launch} from './game-harness.js';
function reachable(count,edges){const found=new Set([0]),queue=[0];for(const n of queue)for(const e of edges){const next=e.a===n?e.b:e.b===n?e.a:null;if(next!==null&&!found.has(next)){found.add(next);queue.push(next);}}assert.equal(found.size,count);}
test('2,000 seeds create distinct connected networks with roads to every landmark',()=>{
 const forms=new Set(),sizes=new Set(),counts=new Set();
 for(let seed=0;seed<2000;seed++){
  const l=makeLayout(seed);assert.deepEqual(l,makeLayout(seed));assert.equal(l.version,2);
  reachable(l.nodes.length,l.edges);reachable(l.pylons.length,l.powerLinks);
  assert.ok(l.roads.length>20&&l.roads.length<128);assert.equal(l.roads.length,l.edges.length);
  assert.ok(l.turbines.length>=1&&l.turbines.length<=4);assert.ok(l.pylons.length>=6&&l.pylons.length<=11);
  for(const point of [...l.pylons,...l.turbines,{...l.forest.entrance,nodeId:l.forest.nodeId}]){
   assert.ok(nearestRoad(point.x,point.z,l).distance<1e-9);assert.ok(l.edges.some(e=>e.a===point.nodeId||e.b===point.nodeId));
   assert.ok(point.x>l.bounds[0]&&point.x<l.bounds[2]&&point.z>l.bounds[1]&&point.z<l.bounds[3]);
  }
  for(let i=0;i<l.pylons.length;i++)for(let j=0;j<i;j++)assert.ok(Math.hypot(l.pylons[i].x-l.pylons[j].x,l.pylons[i].z-l.pylons[j].z)>140,'separate pylon legs');
  assert.ok(Math.hypot(l.forest.x-128,l.forest.z+34)-l.forest.radius>580);
  assert.ok(l.turbines.every(t=>Math.hypot(t.x-128,t.z+34)>=225));
  forms.add(JSON.stringify(l.roads));sizes.add(l.roads.length);counts.add(l.turbines.length);
 }
 assert.equal(forms.size,2000);assert.ok(sizes.size>20);assert.equal(counts.size,4);
 for(const seed of [0,3,6,9])assert.notDeepEqual(makeLayout(seed).roads,makeLayout(seed+3).roads);
});
test('world seeds round-trip by number or phrase, and rooms keep separate layouts',()=>{
 assert.equal(seedFromText(''),null);assert.equal(seedFromText('0'),0);assert.equal(seedFromText('4294967295'),0xffffffff);
 const seed=seedFromText('the quiet forest');assert.equal(seed,seedFromText('the quiet forest'));assert.notEqual(seed,seedFromText('other forest'));
 assert.equal(seedFromText(String(seed)),seed);
 const rooms=new Rooms(),a=rooms.create({id:'a'},'the quiet forest'),b=rooms.create({id:'b'},'8');
 assert.equal(a.world.seed,seed);assert.equal(b.world.seed,8);assert.notDeepEqual(a.world.layout,b.world.layout);
 assert.throws(()=>rooms.create({id:'c'},{}),/seed/);assert.throws(()=>rooms.create({id:'c'},'x'.repeat(41)),/seed/);
 assert.equal(rooms.snapshot(a).world.layoutVersion,2);assert.equal(serializeWorld(a.world).seed,seed);
});
test('GPU spatial lookup retains exact road edges and intersections across generated worlds',()=>{
 for(let seed=0;seed<20;seed++){
  const l=makeLayout(seed),lookup=makeLayoutLookup(l),{size,bounds,pixels}=lookup;
  for(const road of l.roads)for(const t of [0,.02,.2,.5,.8,.98,1])for(const offset of [-4.7,0,4.7]){
   const dx=road.b.x-road.a.x,dz=road.b.z-road.a.z,length=Math.hypot(dx,dz),x=road.a.x+dx*t-dz/length*offset,z=road.a.z+dz*t+dx/length*offset;
   const ix=Math.floor((x-bounds[0])/bounds[2]*size),iz=Math.floor((z-bounds[1])/bounds[3]*size),base=(iz*size+ix)*4;
   let nearest=Infinity;for(let i=0;i<8;i++){const id=pixels[base+i%4+(i>=4?size*size*4:0)]-1;if(id>=0)nearest=Math.min(nearest,Math.sqrt(segmentDistanceSquared(x,z,l.roads[id].a,l.roads[id].b)));}
   assert.ok(Math.abs(nearest-nearestRoad(x,z,l).distance)<.00001,`seed ${seed}, point ${x}, ${z}`);
  }
 }
});
test('generated conductors meet both tower sockets, all feet touch soil, and extra enemies reuse connected anchors',()=>{
 for(const seed of [0,1,2,16,451,1609]){
  const w=makeWorld(config,seed),l=w.layout;
  const poses=l.pylons.map(p=>groundedPylon(p,PYLON_RIG,terrainHeight));
  for(const p of poses)for(const foot of PYLON_RIG.feet){const at=pylonPoint(p,foot);assert.ok(at[1]<=terrainHeight(at[0],at[2])+.001);}
  for(const e of l.powerLinks)for(const socket of PYLON_SOCKETS){const a=pylonPoint(poses[e.a],socket),b=pylonPoint(poses[e.b],socket);a[1]-=1.6;b[1]-=1.6;assert.deepEqual(cablePoint(a,b,0,terrainHeight),a);assert.ok(Math.hypot(...cablePoint(a,b,1,terrainHeight).map((v,i)=>v-b[i]))<1e-9);}
  startWorld(w,1);growPylons(w,8);assert.equal(w.extraPylons.length,3);
  for(const [i,p] of [w.sim,...w.extraPylons].entries()){assert.equal(p.powerCreature.x,l.pylons[i].x);assert.equal(p.powerCreature.z,l.pylons[i].z);assert.equal(p.powerCreature.heading,l.pylons[i].heading);}
  const far=l.pylons.at(-1),player={x:far.x,z:far.z,yaw:0,pitch:0};movePlayer(player,{x:0,z:0,yaw:0,pitch:0},.05,[],()=>{},l);assert.equal(player.z,far.z);
 }
});
test('forest trees stay away from roads and collide; roads and sites cannot provide grass concealment',()=>{
 for(const seed of [0,1,2,78942]){
  const l=makeLayout(seed),trees=forestForLayout(l).trees;assert.ok(trees.length>650&&trees.length<1350);
  assert.ok(trees.every(t=>Math.hypot(t.x-128,t.z+34)>350&&t.height>=12&&t.height<=23&&nearestRoad(t.x,t.z,l).distance>=7));
  for(const s of [...l.turbines,...l.pylons])assert.equal(grassCover(s.x,s.z,l),false);
  for(const road of l.roads){const x=(road.a.x+road.b.x)/2,z=(road.a.z+road.b.z)/2;assert.ok(roadOffset(x,z,l)<1e-9);assert.equal(grassCover(x,z,l),false);}
  const t=trees[0],p={x:t.x,z:t.z};collideForest(p,l);assert.ok(Math.hypot(p.x-t.x,p.z-t.z)>=t.radius+.289);
 }
});
test('generated turbines hear independently and serialize in one authoritative room',()=>{
 const w=makeWorld(config,2),other=makeWorld(config,0);assert.equal(w.extraTurbines.length,2);assert.equal(other.extraTurbines.length,0);
 assert.equal(w.sim.turbine.x,w.layout.turbines[0].x);
 const sim=w.extraTurbines[0],p={id:'noisy',x:sim.turbine.x+22,z:sim.turbine.z,y:3,alive:true,connected:true};
 w.sim.noise(p,20);w.sim.step(.05,[p]);assert.equal(sim.enemy.state,'awakening');assert.equal(w.sim.enemy.state,'dormant');assert.equal(other.sim.enemy.state,'dormant');
 assert.notEqual(sim.enemy.feet,w.sim.enemy.feet);
 for(let i=0;i<180;i++){if(i%10===0)w.sim.noise(p,20);w.sim.step(.05,[p]);}
 const snap=w.sim.snapshot();assert.equal(snap.turbines.length,3);assert.equal(snap.turbines[1].feet.length,3);assert.ok(snap.turbines.every(t=>[t.x,t.y,t.z].every(Number.isFinite)));
 assert.equal(serializeWorld(w).enemies.extraTurbines.length,2);
});
test('shipped mobile game rebuilds worlds, clears old collisions, and shows both destinations',()=>{
 const {run,document}=launch();
 for(const seed of [0,1,2,100]){
  run(`resetWorld(true,${seed});setMode('playing');locked=true;world.cycle=false;frame(1000);`);
  assert.equal(run('activeLayout.seed'),seed);assert.equal(run('otherTurbines.length'),makeLayout(seed).turbines.length-1);assert.equal(run('forestChunks.length'),0);
  assert.equal(run('corridorSpans.length'),makeLayout(seed).powerLinks.length);assert.equal(run('staticPylonColliders().length'),(makeLayout(seed).pylons.length-1)*4);
  assert.match(document.getElementById('powerDestination').textContent,/POWER CORRIDOR/);assert.match(document.getElementById('forestDestination').textContent,/PINE FOREST/);
 }
 run('player.x=otherTurbines[0].body.x+22;player.z=otherTurbines[0].body.z;player.y=terrainHeight(player.x,player.z)+1.7;emitNoise(20);updateOtherTurbines(.05);');
 assert.equal(run('otherTurbines[0].state.state'),'awakening');assert.equal(run('enemy.state'),'dormant');
 run('otherTurbines[0].state.awake=9;buildObjects();');assert.ok(run('otherTurbines[0].meshes[0].vertices.every(Number.isFinite)'));
 run('player.x=activeLayout.forest.x;player.z=activeLayout.forest.z;appendForest();');assert.ok(run('forestChunks.length>0'));
 document.getElementById('singleplayerSeed').value='field trip';run('resetWorld(true)');assert.equal(run('activeLayout.seed'),seedFromText('field trip'));assert.match(document.getElementById('currentWorldSeed').textContent,new RegExp(String(seedFromText('field trip'))));
 assert.match(document.getElementById('icon-crouch').innerHTML,/M12 4v14/);
});
test('network snapshots use the server seed and interpolate all generated turbine instances',()=>{
 const {run}=launch(),w=makeWorld(config,2),snapshot={received:performance.now(),ownerId:'me',players:[{id:'me',x:128,y:2,z:-34,vx:0,vz:0,alive:true,inventory:{camera:true,sodas:0},heldItem:'camera'}],world:{seed:2,phase:.44,cycle:false},enemies:w.sim.snapshot()};
 run(`resetWorld(true,0);setMode('playing');locked=true;net.code='ABCDE';net.player={id:'me'};net.status='CONNECTED';net.socket={readyState:1};net.snapshots=[${JSON.stringify(snapshot)}];updateNetworkFrame(.05);buildObjects();`);
 assert.equal(run('activeLayout.seed'),2);assert.equal(run('otherTurbines.length'),2);assert.equal(run('otherTurbines[0].body.x'),w.layout.turbines[1].x);assert.equal(run('POWER_ZONE.x'),w.layout.power.x);
});
