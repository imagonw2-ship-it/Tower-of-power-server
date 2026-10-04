import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLayout,forestForLayout,collideForest} from '../shared/world-layout.js';
import {roadOffset,grassCover,terrainHeight} from '../shared/physics.js';
import {makeWorld,serializeWorld} from '../server/worlds.js';
import {config} from '../server/config.js';
import {launch} from './game-harness.js';

test('map seeds deterministically select three layouts and keep the forest outside spawn rendering',()=>{
 for(const seed of [0,1,2,78942]){
  const a=makeLayout(seed),b=makeLayout(seed);assert.deepEqual(a,b);
  const trees=forestForLayout(a).trees;assert.ok(trees.length>700&&trees.length<1300);
  assert.ok(trees.every(t=>Math.hypot(t.x-128,t.z+34)>350));
  assert.ok(trees.every(t=>Number.isFinite(t.height)&&t.height>=12&&t.height<=23));
 }
 assert.equal(makeLayout(0).turbines.length,1);assert.equal(makeLayout(1).crossroad,true);assert.equal(makeLayout(2).turbines.length,2);
 assert.equal(roadOffset(250,-28,makeLayout(1)),0);assert.ok(Math.abs(roadOffset(250,-28,makeLayout(0)))>50);
 assert.equal(grassCover(250,-28,makeLayout(1)),false);
 assert.equal(grassCover(325,-325,makeLayout(2)),false);
 assert.equal(grassCover(325,-325,makeLayout(0)),true);
 const l=makeLayout(1),t=forestForLayout(l).trees[0],p={x:t.x,z:t.z};collideForest(p,l);
 assert.ok(Math.hypot(p.x-t.x,p.z-t.z)>=t.radius+.289);
});
test('twin turbines hear and attack independently and serialize in one authoritative room',()=>{
 const w=makeWorld(config,2),other=makeWorld(config,0);
 assert.equal(w.extraTurbines.length,1);assert.equal(other.extraTurbines.length,0);
 const sim=w.extraTurbines[0],p={id:'noisy',x:sim.turbine.x+22,z:sim.turbine.z,y:3,alive:true,connected:true};
 w.sim.noise(p,20);w.sim.step(.05,[p]);
 assert.equal(sim.enemy.state,'awakening');assert.equal(w.sim.enemy.state,'dormant');assert.equal(other.sim.enemy.state,'dormant');
 assert.notEqual(sim.enemy.feet,w.sim.enemy.feet);
 for(let i=0;i<180;i++){if(i%10===0)w.sim.noise(p,20);w.sim.step(.05,[p]);}
 const snap=w.sim.snapshot();assert.equal(snap.turbines.length,2);assert.equal(snap.turbines[1].feet.length,3);
 assert.ok(snap.turbines.every(t=>[t.x,t.y,t.z].every(Number.isFinite)));
 assert.equal(serializeWorld(w).seed,2);assert.equal(serializeWorld(w).enemies.extraTurbines.length,1);
});
test('offline variants, closed turbine shells, forest culling and simple controls run in the shipped game',()=>{
 const {run,document}=launch();
 for(const seed of [0,1,2]){
  run(`resetWorld(true,${seed});setMode('playing');locked=true;world.cycle=false;frame(1000);`);
  assert.equal(run('activeLayout.seed'),seed);assert.equal(run('otherTurbines.length'),seed===2?1:0);
  assert.equal(run('forestChunks.length'),0);
 }
 run("player.x=347;player.z=-325;player.y=terrainHeight(player.x,player.z)+1.7;emitNoise(20);updateOtherTurbines(.05);");
 assert.equal(run('otherTurbines[0].state.state'),'awakening');assert.equal(run('enemy.state'),'dormant');
 run("otherTurbines[0].state.awake=9;buildObjects();");
 assert.ok(run('legMeshes[0].vertices.length>(legMeshes[0].rings+1)*(legMeshes[0].sides+1)*9'));
 assert.ok(run('otherTurbines[0].meshes[0].vertices.every(Number.isFinite)'));
 run('player.x=activeLayout.forest.x;player.z=activeLayout.forest.z;appendForest();');
 assert.ok(run('forestChunks.length>0'));assert.ok(run('objectDraws.some(o=>o.forest)'));
 assert.match(document.getElementById('icon-crouch').innerHTML,/M12 4v14/);
 assert.match(document.getElementById('icon-run').innerHTML,/m6 12/);
});
test('network snapshots use the server seed and interpolate the second turbine',()=>{
 const {run}=launch();
 run(`resetWorld(true,0);setMode('playing');locked=true;
  net.code='ABCDE';net.player={id:'me'};net.status='CONNECTED';net.socket={readyState:1};
  const extra={x:325,y:terrainHeight(325,-325),z:-325,state:'dormant',heading:0,angle:.22,awake:0,feet:[],anchor:[325,0,-325],gait:0,lean:0,bank:0};
  const snapshot={received:performance.now(),ownerId:'me',players:[{id:'me',x:128,y:2,z:-34,vx:0,vz:0,alive:true,inventory:{camera:true,sodas:0},heldItem:'camera'}],world:{seed:2,phase:.44,cycle:false},enemies:{turbine:{...enemy,x:turbine.x,y:turbine.y,z:turbine.z},power:{...powerCreature},turbines:[{},extra]}};
  net.snapshots=[snapshot];updateNetworkFrame(.05);buildObjects();`);
 assert.equal(run('activeLayout.seed'),2);assert.equal(run('otherTurbines.length'),1);assert.equal(run('otherTurbines[0].body.x'),325);
});
