import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrafficLights,stepTrafficLights,signalCanSee,signalPredictedPoint,snapshotTrafficLights,setTrafficLightsStopped,SIGNAL_STOMP} from '../shared/traffic-light.js';
import {towerPresenceContact} from '../shared/enemy-combat.js';
import {beginPackTransfer,tickPackTransfer,packHandPose,PACK_TRANSFER_SECONDS,advancePackMotion} from '../shared/prop-motion.js';
import {makeWorld} from '../server/worlds.js';
import {makePlayer} from '../server/players.js';
import {config} from '../server/config.js';
import {terrainHeight,grassCover} from '../shared/physics.js';
import {launch} from './game-harness.js';
const flat=()=>0,{run}=launch();
const target=(v={})=>({id:'p',x:0,z:60,y:1.7,vx:0,vz:0,alive:true,connected:true,biome:'meadow',godMode:true,...v});
function signal(){return createTrafficLights({roads:[{a:{x:0,z:-200},b:{x:0,z:300}}],roadside:{signals:[{id:'test',x:0,z:0,heading:0}]}},flat)[0];}
function active(){const s=signal();Object.assign(s,{active:true,phase:'green'});return s;}
function advance(s,p,seconds,fps=120,obstacles=[],hit=()=>{}){for(let i=0;i<Math.round(seconds*fps);i++)stepTrafficLights([s],1/fps,[p],flat,obstacles,hit);}
function local(){run("net.code='';resetWorld(true,0);setMode('playing');locked=true;world.powerStopped=true;game.godMode=true;player.yaw=0;player.pitch=0;updateCamera(0);");}

test('signal vision has a finite range, a forward cone, and close awareness',()=>{
 const s=signal();assert.equal(signalCanSee(s,target(),flat),true);assert.equal(signalCanSee(s,target({z:65}),flat),false);assert.equal(signalCanSee(s,target({z:-20}),flat),false);assert.equal(signalCanSee(s,target({z:-7}),flat),true);
});
test('terrain and shelter occlude signal sight and forest players are excluded',()=>{
 const s=signal(),p=target();assert.equal(signalCanSee(s,p,flat,[{x:0,z:30,r:6,shelter:true}]),false);assert.equal(signalCanSee(s,p,(x,z)=>z>25&&z<35?8:0),false);assert.equal(signalCanSee(s,target({biome:'forest'}),flat),false);
});
test('lost sight uses the last observation briefly instead of following hidden live positions',()=>{
 const s=active(),p=target({z:30,vx:2});advance(s,p,.12);const seen={...s.seen};p.x=200;p.z=200;advance(s,p,.4);assert.deepEqual(s.seen,seen);assert.equal(s.targetVisible,false);assert.ok(signalPredictedPoint(s,.5).x<4);advance(s,p,2.5);assert.equal(s.targetId,null);assert.equal(s.vx,0);
});
test('distant chase stays on the road with feet on opposite shoulders',()=>{
 const s=active(),p=target();advance(s,p,1);assert.ok(Math.abs(s.x)<.05);assert.ok(s.halfSpan>5);assert.ok(s.feet[0].position[0]<-4.8&&s.feet[1].position[0]>4.8);assert.ok(s.vz>9.3);
});
test('approaching a victim smoothly narrows the stance onto the asphalt',()=>{
 const s=active(),p=target({z:25});s.stompCooldown=20;let max=0;for(let i=0;i<180;i++){const old=s.halfSpan;advance(s,p,1/120);max=Math.max(max,Math.abs(s.halfSpan-old));}assert.ok(s.halfSpan<2.1);assert.ok(max<.09);assert.ok(s.feet.some(f=>Math.abs(f.position[0])<3.4));
});
test('stomp predicts lateral motion, adjusts during lift, then commits near impact',()=>{
 const s=active(),p=target({x:4.4,z:1,vx:2});advance(s,p,.1);assert.ok(s.stomp.target[0]>p.x+1);p.vx=-2;advance(s,p,.45);assert.ok(s.stomp.target[0]<p.x+1);advance(s,p,.15);const committed=s.stomp.target.slice();p.x+=8;p.vx=0;advance(s,p,.35);assert.deepEqual(s.stomp.target,committed);
});
test('a predictable moving victim is hit by the pole rather than the empty old location',()=>{
 const s=active(),p=target({x:4.4,z:1,vx:1.2,godMode:false});let hits=0;for(let i=0;i<135;i++){p.x+=p.vx/120;stepTrafficLights([s],1/120,[p],flat,[],()=>hits++);}assert.equal(hits,1);assert.equal(p.alive,false);assert.ok(s.lastImpact[0]>5.2);
});
test('red lights stop travel and tablet pause freezes an active stomp',()=>{
 const s=active(),p=target({x:4.4,z:1});advance(s,p,.9);setTrafficLightsStopped([s],true);const old=snapshotTrafficLights([s]);advance(s,p,2);assert.deepEqual(snapshotTrafficLights([s]),old);setTrafficLightsStopped([s],false);advance(s,p,.3);assert.equal(s.impactSerial,1);const t=active();t.phase='red';advance(t,target(),1);assert.equal(t.x,0);assert.equal(t.z,0);
});
test('adaptive gait and suspended heads are stable at 20 and 120 fps',()=>{
 const a=active(),b=active();advance(a,target(),2,20);advance(b,target(),2,120);assert.deepEqual(snapshotTrafficLights([a]),snapshotTrafficLights([b]));
});
test('standing still or walking quietly in grass no longer conceals a player',()=>{
 for(const p of [target({x:30,z:0}),target({x:30,z:0,vx:2})])assert.equal(towerPresenceContact(p,{x:0,z:0},()=>true,()=>false),true);
});
test('crouching hides only in grass; roads remain exposed and shelters still block',()=>{
 const p=target({x:30,z:0,crouching:true}),body={x:0,z:0};assert.equal(towerPresenceContact(p,body,()=>true,()=>false),false);assert.equal(towerPresenceContact(p,body,()=>false,()=>false),true);p.crouching=false;assert.equal(towerPresenceContact(p,body,()=>true,()=>true),false);p.biome='forest';assert.equal(towerPresenceContact(p,body,()=>false,()=>false),false);
});
test('server towers awaken and approach a stationary exposed player',()=>{
 const w=makeWorld(config,0),s=w.sim,p=target({x:s.turbine.x+100,z:s.turbine.z,y:terrainHeight(s.turbine.x+100,s.turbine.z)+1.7});const old=Math.hypot(p.x-s.turbine.x,p.z-s.turbine.z);for(let i=0;i<260;i++)s.step(.05,[p]);assert.notEqual(s.enemy.state,'dormant');assert.ok(Math.hypot(p.x-s.turbine.x,p.z-s.turbine.z)<old-10);
});
test('solo and server towers leave an initially crouched grass-covered player untracked',()=>{
 const w=makeWorld(config,0),s=w.sim;let x=s.turbine.x+65,z=s.turbine.z;while(!grassCover(x,z,w.layout))x+=2;const p=target({x,z,y:terrainHeight(x,z)+.72,crouching:true});for(let i=0;i<80;i++)s.step(.05,[p]);assert.equal(s.enemy.state,'dormant');
 local();run(`player.x=${x};player.z=${z};player.y=terrainHeight(player.x,player.z)+.72;game.crouching=true;for(let i=0;i<80;i++)updateEnemy(.05);`);assert.equal(run('enemy.state'),'dormant');run('game.crouching=false;player.y+=.98;updateEnemy(.15);');assert.equal(run('enemy.state'),'awakening');
});
test('pack transfer validates ownership, prevents overlap, and defers closing until completion',()=>{
 const p=makePlayer({id:'p'},0);p.inventory.backpack=p.inventory.gun=true;p.inventoryOpen=true;assert.equal(beginPackTransfer(p,'flare'),false);assert.equal(beginPackTransfer(p,'gun'),true);assert.equal(beginPackTransfer(p,'none'),false);p.packCloseRequested=true;tickPackTransfer(p,.7);assert.equal(p.heldItem,'camera');assert.equal(p.inventoryOpen,true);tickPackTransfer(p,1);assert.equal(p.heldItem,'gun');assert.equal(p.inventoryOpen,false);assert.equal(p.packAction,null);
});
test('death cancels transfer and an item removed mid-transfer cannot be conjured back',()=>{
 const p=makePlayer({id:'p'},0);p.inventory.backpack=p.inventory.gun=true;p.inventoryOpen=true;beginPackTransfer(p,'gun');p.alive=false;tickPackTransfer(p,2);assert.equal(p.packAction,null);assert.equal(p.inventoryOpen,false);p.alive=p.inventoryOpen=true;beginPackTransfer(p,'gun');p.inventory.gun=false;tickPackTransfer(p,2);assert.equal(p.heldItem,'none');
});
test('front pockets remain attached while only the top cap opens a modest angle',()=>{
 local();run('game.hasBackpack=true;openFieldKit();for(let i=0;i<150;i++)updateBackpack(1/60);objectDraws.length=0;appendBackpack();');assert.ok(run("objectDraws.some(o=>o.backpackPart==='top')&&!objectDraws.some(o=>o.backpackPart==='flap')"));assert.ok(run('Math.abs(BACKPACK_ASSET.openingAngle)<.5'));assert.ok(run("(()=>{const part=BACKPACK_ASSET.meshes.find(m=>m.name==='body'),v=new DataView(Uint8Array.from(atob(part.vertices),c=>c.charCodeAt(0)).buffer);let n=0;for(let i=0;i<part.vertexCount;i++)if(v.getFloat32(i*32+4,true)<.35&&v.getFloat32(i*32+8,true)>.05)n++;return n>1500;})()"));
});
test('opening and reversal preserve motion; interrupted inventory cleans up its transfer',()=>{
 const a={p:0},b={p:0};for(let i=0;i<10;i++)advancePackMotion(a,'p',1,.05);for(let i=0;i<60;i++)advancePackMotion(b,'p',1,1/120);assert.ok(Math.abs(a.p-b.p)<1e-9);const v=a.pVelocity;advancePackMotion(a,'p',0,.00001);assert.ok(Math.abs(v-a.pVelocity)<.001);
 local();run("game.hasBackpack=game.hasGun=true;openFieldKit();for(let i=0;i<150;i++)updateBackpack(1/60);equipTool('gun');updateBackpack(.3);setMode('lost');updateBackpack(.1);");assert.equal(run('backpack.action'),null);assert.equal(run('backpack.progress'),0);
});
test('local hand stows and retrieves actual item models with smooth travel and delayed equip',()=>{
 local();run("game.hasBackpack=game.hasGun=true;openFieldKit();for(let i=0;i<150;i++)updateBackpack(1/60);equipTool('gun');updateBackpack(.25);objectDraws.length=0;appendBackpack();");assert.equal(run('equippedTool'),'camera');assert.ok(run("objectDraws.some(o=>o.packItem==='camera')"));run('updateBackpack(.8);objectDraws.length=0;appendBackpack();');assert.ok(run("objectDraws.some(o=>o.packItem==='gun')"));run('closeFieldKit();updateBackpack(.5);');assert.equal(run('equippedTool'),'gun');assert.equal(run('backpack.closing'),true);
 let last=packHandPose({from:'camera',to:'gun',time:0}).position;for(let i=1;i<=145;i++){const pos=packHandPose({from:'camera',to:'gun',time:i/100}).position;assert.ok(Math.hypot(...pos.map((v,k)=>v-last[k]))<.03);last=pos;}
 assert.ok(run('objectDraws.every(o=>o.model.every(Number.isFinite)&&(!o.bones||o.bones.every(Number.isFinite)))'));
});
