import test from 'node:test';
import assert from 'node:assert/strict';
import {MimicMemory,ForestMimic,hostDestination} from '../shared/forest-haunts.js';
import {encodeVoice,decodeVoice} from '../shared/voice-codec.js';
import {makeLayout,bareGround,forestForLayout} from '../shared/world-layout.js';
import {Rooms} from '../server/rooms.js';
import {hostCommand} from '../server/host-controls.js';
import {acceptInput,tickPlayer} from '../server/players.js';
import {relayMimic} from '../server/voice.js';
import {spendStamina} from '../shared/survival.js';
import {createEnemySimulation} from '../server/enemies.js';
import {terrainHeight} from '../shared/physics.js';
import {serializeWorld} from '../server/worlds.js';
import {launch} from './game-harness.js';
const speech=i=>encodeVoice(Float32Array.from({length:800},(_,j)=>.2*Math.sin(j*.11)),i);
test('dirt trails are confined to the forest and its clustered trees leave smaller clearings',()=>{
 for(const seed of [0,1,42,4096]){
  const l=makeLayout(seed),f=l.forest;
  for(const t of l.trails)for(const p of [t.a,t.b])assert.ok(Math.hypot(p.x-f.x,p.z-f.z)<=f.radius+1);
  for(let i=0;i<40;i++){const a=i/40*Math.PI*2;assert.equal(bareGround(f.x+Math.cos(a)*(f.radius+1),f.z+Math.sin(a)*(f.radius+1),l),false);}
  const trees=forestForLayout(l);assert.ok(trees.trees.length>1600);assert.equal(trees.clearings.length,2);assert.ok(trees.clearings.every(c=>c.radius<14));
 }
});
test('mimic repeats captured speech spatially, bounds memory, expires clips and erases a muted source',()=>{
 const memory=new MimicMemory(),mimic=new ForestMimic(makeLayout(0),()=>.1),p={id:'a',biome:'forest',x:0,z:-16,yaw:0,alive:true};
 for(let i=0;i<12;i++)memory.record(p.id,speech(i),i*.05);
 mimic.spawn(p);let heard=[];for(let i=0;i<140;i++)heard.push(...mimic.step(.05,[p],memory));
 assert.equal(memory.clips.length,1);assert.equal(heard.length,12);assert.ok(Math.hypot(mimic.x-p.x,mimic.z-p.z)>2);
 assert.deepEqual(decodeVoice(heard[3].bytes),decodeVoice(speech(3)));
 for(let k=0;k<30;k++){for(let i=0;i<60;i++)memory.record(String(k),speech(i),10+k+i*.001);memory.finish(String(k),11+k);}
 assert.ok(memory.clips.length<=8&&memory.clips.every(c=>c.frames.length<=48));memory.tick(140);assert.equal(memory.clips.length,0);
 memory.record('a',speech(0),140);memory.forget('a');assert.equal(memory.pending.size,0);
});
test('host permissions cannot be spoofed through input, tablet actions, or guest teleports',()=>{
 const rooms=new Rooms(),r=rooms.create({id:'host'},'0'),host=rooms.join({id:'host'},r.code).player,guest=rooms.join({id:'guest'},r.code).player;rooms.start(r,'host');
 const start=[guest.x,guest.z];
 for(const value of [{command:'tablet',enabled:true},{command:'god',enabled:true},{command:'sprint',enabled:true},{command:'teleport',destination:'forest'},{command:'mimic'}])assert.equal(hostCommand(r,guest,value),false);
 acceptInput(guest,{seq:1,x:0,z:1,yaw:0,pitch:0,godMode:true,infiniteSprint:true,tabletOpen:true},Date.now());assert.equal(guest.godMode,false);assert.equal(guest.infiniteSprint,false);assert.equal(guest.tabletOpen,false);assert.deepEqual([guest.x,guest.z],start);
 assert.ok(hostCommand(r,host,{command:'tablet',enabled:true}));const old=[host.x,host.z];acceptInput(host,{seq:1,x:1,z:1,yaw:1,pitch:1},Date.now());tickPlayer(host,.1,r.world,Date.now());assert.deepEqual([host.x,host.z],old);
 assert.ok(hostCommand(r,host,{command:'god',enabled:true}));assert.ok(hostCommand(r,host,{command:'sprint',enabled:true}));host.stamina=0;host.exhausted=true;assert.ok(spendStamina(host,true,60));assert.equal(host.stamina,100);
 assert.ok(hostCommand(r,host,{command:'teleport',destination:'forest'}));assert.equal(host.biome,'forest');
 assert.equal(hostCommand(r,host,{command:'teleport',destination:'arbitrary',x:Infinity}),false);assert.equal(hostDestination(r.world.layout,'nope'),null);
 assert.ok(hostCommand(r,host,{command:'mimic'}));assert.ok(r.world.mimic.active);assert.equal('voiceMemory' in serializeWorld(r.world),false);
 assert.equal(Object.hasOwn(host.inventory,'tablet'),false);rooms.disconnect('host');assert.equal(host.tabletOpen,false);
});
test('god mode prevents authoritative pylon stomp damage while an unprotected player is still hit',()=>{
 for(const godMode of [false,true]){
  const world={turbineStopped:true,powerStopped:false},sim=createEnemySimulation(world),e=sim.powerCreature;e.state='running';e.rigBlend=1;
  const p={id:'p',x:e.x+24,z:e.z,y:terrainHeight(e.x+24,e.z)+1.7,alive:true,connected:true,health:1,godMode,input:{x:0,z:0}};
  sim.noise(p,110);for(let i=0;i<27;i++)sim.step(.05,[p]);assert.equal(p.alive,godMode);
 }
});
test('mimic packets stay in the room and have an independent replay sequence',()=>{
 const room={players:new Map(),world:{mimicFrames:[{bytes:speech(420),sequence:7,x:10,z:20}]}},heard=[],other=[];
 for(const id of ['a','b'])room.players.set(id,{id,x:10,z:23,y:2,yaw:0,alive:true,connected:true});
 const sockets=new Map([['a',{room,readyState:1,bufferedAmount:0,send:p=>heard.push(p)}],['b',{room:{},readyState:1,bufferedAmount:0,send:p=>other.push(p)}]]);
 relayMimic(room,sockets);assert.equal(heard.length,1);assert.equal(other.length,0);assert.equal(heard[0][1],2);assert.equal(heard[0].readUInt16LE(10),7);assert.equal(room.world.mimicFrames.length,0);
});
test('the physical tablet locks the camera, uses two arms, restores normal play, and cannot enter inventory',()=>{
 const {run,document}=launch();run("resetWorld(true,0);setMode('playing');locked=true;player.yaw=.7;player.pitch=.2;openFieldPanel();updateTablet(.7);updateCamera(.016);buildObjects();positionTabletScreen();");
 assert.equal(run('game.mode'),'fieldPanel');assert.equal(run('player.yaw'),.7);assert.equal(run('player.pitch'),-.18);assert.equal(run('objectDraws.filter(o=>o.tabletArm).length'),2);assert.equal(run("canEquip('tablet')"),false);
 assert.equal([...document.querySelectorAll('#pausePanel button')].some(b=>/INVENTORY|WORLD CONTROLS/.test(b.textContent)),false);assert.ok(document.querySelector('#fieldPanel').style.transform.startsWith('matrix('));
 run("closeFieldPanel();updateTablet(.7);");assert.equal(run('game.mode'),'playing');assert.equal(run('player.pitch'),.2);
 run("net.code='ABCDE';net.socket={readyState:1,send(){}};net.player={id:'guest'};net.snapshots=[{ownerId:'owner'}];openFieldPanel();");assert.equal(run('game.mode'),'playing');
});
