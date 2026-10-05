import test from 'node:test';
import assert from 'node:assert/strict';
import {makeLayout,makeLayoutLookup,forestForLayout,collideForest,nearestRoad,nearestTrail,segmentDistanceSquared} from '../shared/world-layout.js';
import {grassCover} from '../shared/physics.js';
import {launch} from './game-harness.js';

test('seeded logs stay clear of roads, trails and standing trunks with local collision queries',()=>{
 for(const seed of [0,4,42,1524,1679,78942]){
  const layout=makeLayout(seed),forest=forestForLayout(layout);
  assert.ok(forest.logs.length>=25&&forest.logs.length<=50);
  assert.deepEqual(forest.logs,forestForLayout(makeLayout(seed)).logs);
  for(const log of forest.logs){
   const x=(log.a.x+log.b.x)/2,z=(log.a.z+log.b.z)/2,p={x,z};
   assert.ok(nearestRoad(x,z,layout).distance>=9);assert.ok(nearestTrail(x,z,layout)>=3);
   assert.ok(forest.trees.every(t=>segmentDistanceSquared(t.x,t.z,log.a,log.b)>=(t.radius+log.radius+.45)**2));
   assert.ok(collideForest(p,layout)<40);
   assert.ok(Math.sqrt(segmentDistanceSquared(p.x,p.z,log.a,log.b))>=log.radius+.289);
  }
 }
});

test('visible dirt trails use exact GPU segments and sparse forest floors give no grass concealment',()=>{
 for(const seed of [0,4,1524]){
  const l=makeLayout(seed),{size,bounds,pixels}=makeLayoutLookup(l);
  for(const trail of l.trails)for(const t of [0,.25,.5,.75,1]){
   const x=trail.a.x+(trail.b.x-trail.a.x)*t,z=trail.a.z+(trail.b.z-trail.a.z)*t;
   const ix=Math.floor((x-bounds[0])/bounds[2]*size),iz=Math.floor((z-bounds[1])/bounds[3]*size),base=(iz*size+ix)*4;
   let d=Infinity;
   for(let i=0;i<8;i++){const id=pixels[base+size*size*12+i%4+(i>=4?size*size*4:0)]-1;if(id>=0)d=Math.min(d,segmentDistanceSquared(x,z,l.trails[id].a,l.trails[id].b));}
   assert.ok(d<.00001);assert.equal(grassCover(x,z,l),false);
  }
  assert.equal(grassCover(l.forest.x,l.forest.z,l),false);
 }
});

test('woodland geometry is grounded, batched, and replaced when the seed changes',()=>{
 const {run}=launch();
 run("resetWorld(true,0);setMode('playing');locked=true;player.x=activeLayout.forest.x;player.z=activeLayout.forest.z;appendForest();");
 assert.ok(run('canopyMap.pixels.some((v,i)=>i%4===0&&v>200)'));
 assert.ok(run('fallenLogBatches.length>0&&fallenLogBatches.length<=forestForLayout(activeLayout).logs.length'));
 const contact=run(`forestForLayout(activeLayout).logs.map(log=>{
  const a=fallenLogGeometry(log).positions;let min=Infinity;
  for(let i=0;i<a.length;i+=3)min=Math.min(min,a[i+1]-dropSurface(a[i],a[i+2],terrainHeight,shed,terrainHeight));
  return min;
 })`);
 assert.ok(contact.every(d=>d>=-.009&&d<.05),'logs touch the ground without buried or floating bodies');
 run('objectDraws.length=0;appendFallenLogs()');assert.ok(run('objectDraws.some(o=>o.fallenLog)'));
 run('selectLayout(4)');assert.equal(run('fallenLogBatches.length'),0);assert.ok(run('canopyMap.pixels.every(Number.isFinite)'));
});
