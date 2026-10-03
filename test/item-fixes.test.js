import test from 'node:test';
import assert from 'node:assert/strict';
import {launch} from './game-harness.js';
import {droppedItemPose,dropSurface,itemRestPoint} from '../shared/dropped-items.js';
import {terrainHeight,floorHeight,blocked,shed} from '../shared/physics.js';
import {spawnFlare} from '../shared/survival.js';

test('all dropped meshes touch the rendered road, sloping ground and yard without floating',()=>{
 const {run}=launch();
 for(const kind of ['camera','flashlight','soda','flare']){
  const record=run(kind==='camera'?'CAMERA_ASSET':kind==='flare'?'FLARE_ASSET':kind==='soda'?'IMPORTED_MODELS.can':'IMPORTED_MODELS.flashlight');
  const b=Buffer.from(record.vertices,'base64');
  for(const [x,z] of [[119,-42],[124,-80],[-185,-270],[96,-154]])for(const yaw of [0,.9,2.6]){
   const p={x,z,y:floorHeight(x,z)+1.7,yaw};
   const item=droppedItemPose(p,kind,1,floorHeight,blocked,shed,terrainHeight);
   let lowestGap=Infinity;
   for(let i=0;i<record.vertexCount;i++){
    const v=itemRestPoint([b.readFloatLE(i*32),b.readFloatLE(i*32+4),b.readFloatLE(i*32+8)],kind,yaw,item.normal);
    const gap=item.y+v[1]-dropSurface(item.x+v[0],item.z+v[2],floorHeight,shed,terrainHeight);
    lowestGap=Math.min(lowestGap,gap);
   }
   assert.ok(lowestGap>=-.0001&&lowestGap<.0012,`${kind} gap=${lowestGap} at ${x},${z}`);
  }
 }
});
test('inventory exposes only owned items and returns the slot when the last soda is used or an item dropped',()=>{
 const {run,document}=launch();run("resetWorld(true);setMode('playing');locked=true;refreshFieldKit();");
 const visible=()=>[...document.querySelectorAll('.kitCard')].filter(e=>!e.hidden).map(e=>e.dataset.tool);
 assert.deepEqual(visible(),['camera']);
 run('game.hasFlashlight=true;kitPreviousFlashlight=true;game.hasFlare=true;game.sodas=1;refreshFieldKit();');
 assert.deepEqual(visible(),['camera','flashlight','soda','flare']);
 run("equipTool('soda');drinkSoda();refreshFieldKit();");assert.equal(visible().includes('soda'),false);
 run("game.drinking=0;equipTool('flare');dropEquipment();");assert.equal(visible().includes('flare'),false);
 run('takeLocalDroppedItem(localDroppedItems[0]);');assert.equal(visible().includes('flare'),true);
 assert.equal([...document.querySelectorAll('.kitEmpty')].filter(e=>!e.hidden).length+visible().length,9);
});
test('flare starts at the rendered muzzle and its transparent pass follows solid geometry',()=>{
 let bound=null;const calls=[];
 const {run}=launch(true,{bindVertexArray:x=>bound=x,drawElements:()=>calls.push(bound)});
 run("resetWorld(true);setMode('playing');locked=true;game.hasFlare=true;game.flares=3;equippedTool='flare';Object.assign(equipmentMotion,createToolMotion('flare'));updateCamera(0);fireFlare();const m=heldEquipmentMatrix('flare');");
 assert.ok(run('Math.hypot(...[0,1,2].map((k)=>[localFlares[0].x,localFlares[0].y,localFlares[0].z][k]-(m[4+k]*.024-m[8+k]*.274+m[12+k])))<.001'));
 run('buildObjects();');const sprite=run('flareGlowMesh.vao');calls.length=0;
 run('drawObjects(turbineProgram);');assert.equal(calls.includes(sprite),false);
 calls.length=0;run('drawObjects(turbineProgram,false,lightVP,true);');assert.ok(calls.length>0&&calls.every(v=>v===sprite));
 run('updateFlareSystem(.12);');assert.equal(run('muzzleFlash'),0);assert.ok(run('localFlares[0].age')>.1);
});
test('a near wall blocks the muzzle offset; server trajectory comes from aim and stays finite',()=>{
 const p={x:0,y:1.7,z:0,yaw:0,pitch:0};
 const f=spawnFlare(p,'shot');assert.ok(f.z<-.7&&f.x>.2);assert.ok(Math.hypot(f.vx,f.vy,f.vz)<30);
 const wall=spawnFlare(p,'wall',()=>true);assert.equal(wall.x,p.x);assert.equal(wall.z,p.z);
 for(const pitch of [-1.1,0,1.1])for(const yaw of [-3,0,3])assert.ok(Object.values(spawnFlare({...p,pitch,yaw},'aim')).filter(v=>typeof v==='number').every(Number.isFinite));
});
test('online launch responds immediately but rejection removes the predicted flare without creating ammo',()=>{
 const {run}=launch();
 run("resetWorld(true);setMode('playing');locked=true;game.hasFlare=true;game.flares=3;net.code='FLARE';net.status='CONNECTED';net.player={id:'me'};net.socket={readyState:1,bufferedAmount:0,send(){}};net.snapshots=[];updateCamera(0);fireFlare();");
 assert.equal(run('activeFlares().length'),1);assert.equal(run('game.flares'),3);
 run('confirmFlareShot({id:predictedFlare.requestId,ok:false});');assert.equal(run('activeFlares().length'),0);
 run('game.flareCooldown=0;fireFlare();const accepted={...predictedFlare,id:"server-shot"};confirmFlareShot({id:predictedFlare.requestId,ok:true,flare:accepted});net.snapshots=[{received:performance.now(),world:{flares:[accepted]}}];');
 assert.equal(run('activeFlares().length'),1);assert.equal(run('predictedFlare'),null);
});
