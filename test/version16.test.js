import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryCapacity,inventoryUsed,canTakeEquipment,collectEquipment,beginGunReload,tickGun,GUN_RELOAD_SECONDS} from '../shared/equipment-rules.js';
import {shootMimic,mimicRayHit,clearBulletPath} from '../shared/gun-combat.js';
import {makeLayout} from '../shared/world-layout.js';
import {forestChunk,forestTerrainHeight} from '../shared/forest-level.js';
import {ForestMimic,MimicMemory} from '../shared/forest-haunts.js';
import {makeWorld} from '../server/worlds.js';
import {makePlayer,wirePlayer,tickPlayer} from '../server/players.js';
import {summonItem,scaleItems,takeItem,dropItem,releaseItems} from '../server/items.js';
import {hostCommand} from '../server/host-controls.js';
import {config} from '../server/config.js';
import {launch} from './game-harness.js';
function actor(){const p=makePlayer({id:'host',username:'HOST'},0);Object.assign(p,{x:0,z:-16,y:forestTerrainHeight(0,-16)+1.7,biome:'forest',heldItem:'gun'});collectEquipment(p.inventory,{kind:'gun'});return p;}
function mimic(p=actor()){const m=new ForestMimic(makeLayout(0),()=>.1);m.spawn(p,[p],new MimicMemory());Object.assign(m,{x:0,z:-21,y:forestTerrainHeight(0,-21)+1.7});return m;}
function aim(p,x,y,z){p.yaw=Math.atan2(p.x-x,p.z-z);p.pitch=Math.atan2(y-p.y,Math.hypot(x-p.x,z-p.z));}
function aimItem(p,i){aim(p,i.x,i.y+(i.kind==='soda'?.1:0),i.z);}
test('capacity is six without a pack; a full inventory can collect the passive twelve-slot upgrade',()=>{
  const i={camera:true,sodas:5};assert.equal(inventoryUsed(i),6);assert.equal(inventoryCapacity(i),6);assert.equal(canTakeEquipment(i,'gun'),false);
  assert.ok(collectEquipment(i,{kind:'backpack'}));assert.equal(inventoryCapacity(i),12);assert.equal(inventoryUsed(i),6);
  assert.ok(collectEquipment(i,{kind:'gun'}));assert.equal(i.ammo,17);assert.equal(i.reserve,34);assert.equal(canTakeEquipment(i,'backpack'),false);
  i.sodas=10;assert.equal(canTakeEquipment(i,'soda'),false);assert.equal(canTakeEquipment(i,'tablet'),false);
});
test('host item summoning validates ownership and kind and never places the pack on the starter table',()=>{
  const w=makeWorld(config,0),p=actor(),room={ownerId:p.id,phase:'playing',world:w};scaleItems(w,2,{...config.starterItems,backpack:{base:2}});
  assert.ok(!w.items.some(i=>i.kind==='backpack'));assert.equal(hostCommand(room,{...p,id:'guest'},{command:'item',kind:'gun'}),false);
  assert.equal(hostCommand(room,p,{command:'item',kind:'tablet'}),false);assert.ok(hostCommand(room,p,{command:'item',kind:'backpack'}));
  const bag=w.items.at(-1);assert.equal(bag.kind,'backpack');assert.equal(bag.biome,'forest');assert.ok(Math.abs(bag.y-forestTerrainHeight(bag.x,bag.z))<.02);
});
test('summoned items have a bounded world count and unique stable IDs',()=>{
  const w=makeWorld(config,0),p=actor();for(let n=0;n<128;n++)assert.ok(summonItem(w,p,'soda'));
  assert.equal(summonItem(w,p,'soda'),false);assert.equal(new Set(w.items.map(i=>i.id)).size,128);w.items[0].consumed=true;assert.ok(summonItem(w,p,'gun'));assert.equal(w.items.length,128);
});
test('pickup enforces reach and capacity and equips the backpack without changing the held item',()=>{
  const w=makeWorld(config,0),p=actor();p.inventory.sodas=4;assert.ok(summonItem(w,p,'backpack'));const bag=w.items.at(-1);
  assert.equal(takeItem(w,{...p,x:100},bag.id),false);aimItem(p,bag);assert.ok(takeItem(w,p,bag.id));assert.equal(p.heldItem,'gun');assert.equal(inventoryCapacity(p.inventory),12);assert.equal(takeItem(w,p,bag.id),false);
});
test('gun drop and pickup preserve remaining rounds and cancel a reload',()=>{
  const w=makeWorld(config,0),p=actor();w.items.push({id:'gun-a',kind:'gun',holder:p.id});Object.assign(p.inventory,{ammo:4,reserve:9});p.gunReload=1;
  assert.ok(dropItem(w,p,'gun'));const item=w.items[0];assert.equal(item.ammo,4);assert.equal(item.reserve,9);assert.equal(p.gunReload,0);assert.equal(p.inventory.gun,false);
  aimItem(p,item);assert.ok(takeItem(w,p,item.id));assert.equal(p.inventory.ammo,4);assert.equal(p.inventory.reserve,9);
});
test('releasing a player drops the equipped pack and the actual remaining ammunition',()=>{
  const w=makeWorld(config,0),p=actor();p.inventory.backpack=true;p.inventory.ammo=2;p.inventory.reserve=6;w.items=[{id:'g',kind:'gun',holder:p.id},{id:'b',kind:'backpack',holder:p.id}];
  releaseItems(w,p);assert.equal(w.items[0].ammo,2);assert.equal(w.items[0].reserve,6);assert.ok(w.items.every(i=>!i.holder&&Number.isFinite(i.y)));assert.equal(p.inventory.backpack,false);
});
test('reload transfers only available ammunition at completion and cancels on equipment changes',()=>{
  const p=actor();p.inventory.ammo=3;p.inventory.reserve=5;assert.ok(beginGunReload(p));assert.equal(beginGunReload(p),false);tickGun(p,1);assert.equal(p.inventory.ammo,3);tickGun(p,1);assert.equal(p.inventory.ammo,8);assert.equal(p.inventory.reserve,0);
  p.inventory.reserve=34;assert.ok(beginGunReload(p));p.heldItem='camera';tickGun(p,.1);assert.equal(p.gunReload,0);assert.equal(p.inventory.ammo,8);
});
test('gun denies firing while empty, reloading, sprinting, frozen, or using an interface',()=>{
  for(const patch of [{gunReload:1},{gunCooldown:.1},{sprinting:true},{frozen:1},{inventoryOpen:true},{tabletOpen:true},{alive:false},{heldItem:'camera'}]){const p=Object.assign(actor(),patch),ammo=p.inventory.ammo;assert.equal(shootMimic(p,mimic(),0),null);assert.equal(p.inventory.ammo,ammo);}
  const p=actor();p.inventory.ammo=0;assert.equal(shootMimic(p,mimic(),0),null);
});
test('body shots require two hits; a head hit kills and later shots do not re-kill a corpse',()=>{
  const p=actor(),m=mimic(p);aim(p,m.x,forestTerrainHeight(m.x,m.z)+.9,m.z);assert.equal(shootMimic(p,m,0).killed,false);assert.equal(m.health,1);assert.equal(shootMimic(p,m,0),null);
  tickGun(p,.2);assert.equal(shootMimic(p,m,0).killed,true);assert.equal(m.alive,false);tickGun(p,.2);assert.equal(shootMimic(p,m,0).hit,false);
  const q=actor(),n=mimic(q);aim(q,n.x,forestTerrainHeight(n.x,n.z)+1.65,n.z);assert.equal(shootMimic(q,n,0).killed,true);
});
test('gun hits only a live mimic in the same forest and respects aim and range',()=>{
  const p=actor(),m=mimic(p);aim(p,m.x,forestTerrainHeight(m.x,m.z)+1,m.z);assert.ok(mimicRayHit(p,m));
  assert.equal(mimicRayHit(p,{...m,isMimic:false}),null);assert.equal(mimicRayHit({...p,biome:'meadow'},m),null);assert.equal(mimicRayHit({...p,yaw:Math.PI/2},m),null);assert.equal(mimicRayHit(p,{...m,z:-200}),null);
});
test('trunks and hills stop bullets before a mimic, including thin trunks between samples',()=>{
  const tree=forestChunk(0,1,1).trees[0],y=tree.ground+1;
  assert.equal(clearBulletPath(0,[tree.x-2,y,tree.z],[tree.x+2,y,tree.z]),false);
  assert.equal(clearBulletPath(0,[0,-1,-16],[0,-1,-21]),false);
  const p=actor(),m=mimic(p);aim(p,m.x,forestTerrainHeight(m.x,m.z)+1,m.z);assert.equal(shootMimic(p,m,0,()=>false).hit,false);assert.equal(m.health,2);
});
test('dead mimics stop moving, attacking and replaying voices, then disappear',()=>{
  const p=actor(),m=mimic(p),memory=new MimicMemory();Object.assign(m,{alive:false,state:'dead',playing:{},deathTime:0});const x=m.x,z=m.z;
  for(let i=0;i<99;i++)assert.deepEqual(m.step(.05,[p],memory),[]);assert.equal(m.active,true);assert.equal(m.x,x);assert.equal(m.z,z);assert.equal(p.alive,true);m.step(.1,[p],memory);assert.equal(m.active,false);
});
test('physical backpack uses the existing inventory control, settles the camera, and closes smoothly',()=>{
  const {run,document}=launch();run("resetWorld(true);setMode('playing');locked=true;game.hasBackpack=true;updateCamera(0);openFieldKit();updateBackpack(.25);updateCamera(.25);buildObjects();");
  assert.equal(document.getElementById('fieldKit').classList.contains('physical'),true);assert.ok(run('backpack.progress>0&&backpack.progress<1'));assert.ok(run('objectDraws.filter(o=>o.backpackPart).length===2'));
  run('for(let i=0;i<60;i++){updateBackpack(.02);updateCamera(.02);}buildObjects();positionBackpackInventory();');assert.equal(run('backpack.progress'),1);assert.ok(document.getElementById('fieldKit').style.transform.startsWith('matrix('));assert.equal(run('Math.abs(player.pitch+.16)<.001'),true);
  run('closeFieldKit();');assert.equal(run('game.mode'),'inventory');run('for(let i=0;i<40;i++)updateBackpack(.02);');assert.equal(run('game.mode'),'playing');assert.equal(run('backpack.progress'),0);assert.equal(document.querySelectorAll('#touchKit').length,1);
});
test('the shipped gun draws two hands and moving parts, and local firing shares the combat rules',()=>{
  const {run,document,context}=launch();run("resetWorld(true,0);setMode('playing');locked=true;game.hasGun=true;game.ammo=17;game.reserve=34;equippedTool='gun';equipmentMotion.shown='gun';updateCamera(0);objectDraws.length=0;appendHeldEquipment();");
  assert.equal(run('objectDraws.filter(o=>o.povArm).length'),2);assert.equal(run('objectDraws.filter(o=>o.gunPart).length'),3);assert.ok(run('objectDraws.filter(o=>o.povArm).every(o=>o.bones.every(Number.isFinite))'));
  const down=new context.Event('mousedown');Object.defineProperty(down,'button',{value:0});document.getElementById('field').dispatchEvent(down);assert.equal(run('game.ammo'),16);assert.ok(run('gunMotion.flash>0'));
  run('game.gunCooldown=0;reloadGun();');assert.ok(run('game.gunReload>0'));run('for(let i=0;i<90;i++)updateGun(.02);');assert.equal(run('game.ammo'),17);assert.equal(run('game.reserve'),33);
});
