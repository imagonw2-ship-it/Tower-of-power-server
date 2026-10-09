import test from 'node:test';
import assert from 'node:assert/strict';
import {launch} from './game-harness.js';
const {run,context}=launch();let now=1000;context.performance={now:()=>now};
function setup(){now=1000;run("net.code='';resetWorld(true,0);setMode('playing');locked=true;avatarCache.clear();player.x=128;player.z=-34;player.yaw=0;updateCamera(0);globalThis.peer={id:'peer',username:'PEER',x:128,z:-36,yaw:0,pitch:0,vx:0,vz:0,biome:'meadow',alive:true,connected:true,heldItem:'gun',inventory:{gun:true,backpack:true,ammo:8,reserve:34},inventoryOpen:false,gunReload:0,gunFlash:0};objectDraws.length=0;appendHazmat(peer,1);");}
function advance(n){for(let i=0;i<n;i++){now+=1000/60;run(`objectDraws.length=0;appendHazmat(peer,${now/1000});`);}}
test('remote poses advance on rendered frames while the same 10 Hz snapshot is reused',()=>{
  setup();run("net.code='QA';net.player={id:'self'};net.items=[];net.snapshots=[{received:900,world:{elapsed:10},players:[peer]}];peer.vz=2;appendNetworkObjects();");const first=run("Array.from(avatarCache.get('peer').bones)");now+=16.667;run('objectDraws.length=0;appendNetworkObjects();');const next=run("Array.from(avatarCache.get('peer').bones)");assert.ok(next.some((v,i)=>Math.abs(v-first[i])>.00001));assert.ok(run("avatarCache.get('peer').renderTime>1.01"));
});
test('the worn pack follows the chest through crouching and stays behind the torso',()=>{
  setup();const standing=run("Array.from(avatarCache.get('peer').packModel)");run('peer.crouching=true;');advance(60);const crouched=run("Array.from(avatarCache.get('peer').packModel)");assert.ok(crouched[13]<standing[13]-.1);assert.ok(Math.abs(crouched[6]-standing[6])>.05);
  assert.ok(run("(()=>{const a=avatarCache.get('peer'),chest=a.matrices[AVATAR_ASSET.bones.indexOf('spine_03')],m=a.packModel;return Math.hypot(m[12]-chest[12],m[13]+.28-chest[13],m[14]-chest[14])<.6&&m.every(Number.isFinite);})()"));
});
test('remote pack swings, opens its flap, stays in both palms, and closes continuously',()=>{
  setup();const initial=run("Array.from(avatarCache.get('peer').packModel)");run('peer.inventoryOpen=true;');advance(18);assert.ok(run("avatarCache.get('peer').pack>0&&avatarCache.get('peer').pack<.5"));const swing=run("Array.from(avatarCache.get('peer').packModel)");assert.ok(Math.abs(swing[12]-initial[12])>.02);advance(45);
  assert.equal(run("avatarCache.get('peer').pack"),1);assert.ok(run("(()=>{const b=objectDraws.find(o=>o.backpackPart==='body'),f=objectDraws.find(o=>o.backpackPart==='flap');return Math.abs(b.model[5]-f.model[5])>.5;})()"));
  assert.ok(run("(()=>{const a=avatarCache.get('peer'),point=(m,p)=>[0,1,2].map(k=>m[12+k]+m[k]*p[0]+m[4+k]*p[1]+m[8+k]*p[2]);return ['r','l'].every(side=>{const h=a.matrices[AVATAR_ASSET.bones.indexOf('hand_'+side)],actual=point(h,itemPalm.map(v=>v*(side==='l'?-1:1))),target=point(a.packModel,[side==='r'?.175:-.175,.29,.015]);return Math.hypot(...actual.map((v,k)=>v-target[k]))<.00001;});})()"));
  const open=run("Array.from(avatarCache.get('peer').packModel)");run('peer.inventoryOpen=false;');advance(1);const close=run("Array.from(avatarCache.get('peer').packModel)");assert.ok(Math.hypot(...close.slice(12,15).map((v,i)=>v-open[12+i]))<.01);advance(60);assert.equal(run("avatarCache.get('peer').pack"),0);assert.ok(run('objectDraws.every(o=>o.model.every(Number.isFinite)&&(!o.bones||o.bones.every(Number.isFinite)))'));
});
test('remote reload moves the support hand and magazine smoothly without waiting for packets',()=>{
  setup();run('peer.gunReload=1.7;');advance(8);const before=run("avatarCache.get('peer').gun.reload");advance(1);assert.ok(run("avatarCache.get('peer').gun.reload")>before);
  const wrist=run("Array.from(avatarCache.get('peer').matrices[AVATAR_ASSET.bones.indexOf('hand_l')].slice(12,15))");advance(30);assert.ok(run("avatarCache.get('peer').gun.magDrop>.14"));const moved=run("Array.from(avatarCache.get('peer').matrices[AVATAR_ASSET.bones.indexOf('hand_l')].slice(12,15))");assert.ok(Math.hypot(...moved.map((v,i)=>v-wrist[i]))>.06);
  const phase=run("avatarCache.get('peer').gun.reload");run('peer.gunReload=1.69;');advance(1);assert.ok(run("avatarCache.get('peer').gun.reload")>phase);
  run('peer.gunReload=0;');advance(60);assert.ok(run("avatarCache.get('peer').gun.magDrop<.00001"));
});
