import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLayout,forestForLayout,collideForest,nearestRoad} from '../shared/world-layout.js';
import {launch} from './game-harness.js';

test('clustered forests reproduce all seven models and only query nearby trunk cells',()=>{
 let maximum=0;
 for(const seed of [0,1,2,42,100,78942]){
  const layout=makeLayout(seed),forest=forestForLayout(layout);
  assert.ok(forest.clusters.length>30);assert.ok(forest.clearings.length===2);assert.equal(new Set(forest.trees.map(t=>t.kind)).size,7);
  assert.equal(collideForest({x:128,z:-34},layout),0);
  for(const tree of forest.trees){
   const p={x:tree.x,z:tree.z},checks=collideForest(p,layout);maximum=Math.max(maximum,checks);
   assert.ok(Math.hypot(p.x-tree.x,p.z-tree.z)>=tree.radius+.289);assert.ok(checks<40);assert.ok(nearestRoad(tree.x,tree.z,layout).distance>=7.5);
  }
  assert.deepEqual(forest,forestForLayout(makeLayout(seed)));
 }
 assert.ok(maximum>10,'dense groups, not a sparse grid');
});

test('mobile forest uses shared LOD meshes and skips stationary instance uploads',()=>{
 let uploads=0;const {run}=launch(true,{bufferSubData:()=>uploads++});
 run("resetWorld(true,0);setMode('playing');locked=true;settings.quality='low';player.x=activeLayout.forest.x;player.z=activeLayout.forest.z;objectDraws.length=0;appendForest();");
 assert.equal(run('forestBatches.length'),14);assert.ok(run('objectDraws.filter(o=>o.forest).length')<=14);
 assert.ok(run('forestBatches.every(b=>b.mesh.count/3<8000&&(b.lod===0||b.mesh.count/3<1100))'));
 const before=uploads;run('objectDraws.length=0;appendForest();');assert.equal(uploads,before);
 run('player.x+=12;objectDraws.length=0;appendForest();');assert.ok(uploads>before);
 run('player.x=128;player.z=-34;objectDraws.length=0;appendForest();');assert.equal(run('objectDraws.filter(o=>o.forest).length'),0);
 run('resetWorld(true,2);');assert.equal(run('forestChunks.length'),0);
});

test('small clear suit IDs follow the chest in standing, turning and crouched poses',()=>{
 const {run,document}=launch(),create=document.createElement.bind(document);
 document.createElement=(tag,...args)=>{
  const e=create(tag,...args);if(tag==='canvas')e.getContext=()=>new Proxy({measureText:s=>({width:s.length*50})},{get:(o,k)=>o[k]||(()=>{})});return e;
 };
 run("resetWorld(true,0);setMode('playing');locked=true;world.cycle=false;Object.assign(player,{x:128,z:-34,yaw:0,pitch:-.2});updateCamera(.016);var badgePlayer={id:'badge-test',username:'Guest_067823',x:128,z:-35.4,yaw:Math.PI,pitch:0,alive:true,heldItem:'none',vx:0,vz:0};");
 assert.ok(run('SUIT_CARD.width<.16&&SUIT_CARD.height<.10'));
 for(const yaw of [2.6,Math.PI,3.6])for(const crouching of [false,true]){
  run(`badgePlayer.yaw=${yaw};badgePlayer.crouching=${crouching};avatarCache.clear();suitCardDraws.length=0;appendHazmat(badgePlayer,1.8);`);
  assert.equal(run('suitCardDraws.length'),1);assert.ok(run('suitCardDraws[0].inv.every(Number.isFinite)'));
  assert.ok(run(`(()=>{const a=avatarCache.get(badgePlayer.id),chest=AVATAR_ASSET.bones.indexOf('spine_03'),m=multiply(multiply(transform(badgePlayer.x,shedFloor(badgePlayer.x,badgePlayer.z),badgePlayer.z),rotateY(badgePlayer.yaw+Math.PI)),a.bones.subarray(chest*16,chest*16+16)),p=SUIT_CARD.center,card=suitCardDraws[0].model;return[0,1,2].every(k=>Math.abs(m[k]*p[0]+m[k+4]*p[1]+m[k+8]*p[2]+m[k+12]-card[k+12])<.00002);})()`));
  assert.ok(run(`(()=>{const m=suitCardDraws[0].m,o=suitCardWarpOffset(m),raw=[m[12]/m[15]*.5+.5,m[13]/m[15]*.5+.5],w=cardCameraWarp([raw[0]-o[0],raw[1]-o[1]]);return Math.hypot(w[0]-raw[0],w[1]-raw[1])<.004;})()`));
 }
 run('badgePlayer.yaw=0;avatarCache.clear();suitCardDraws.length=0;appendHazmat(badgePlayer,2);');assert.equal(run('suitCardDraws.length'),0);
 run('badgePlayer.yaw=Math.PI;badgePlayer.z=player.z-30;avatarCache.clear();suitCardDraws.length=0;appendHazmat(badgePlayer,3);');assert.equal(run('suitCardDraws.length'),0);
});
