import test from 'node:test';
import assert from 'node:assert/strict';
import {spendStamina,spawnFlare,advanceFlares,applyFlareLure} from '../shared/survival.js';
import {makeWorld} from '../server/worlds.js';
import {config} from '../server/config.js';
import {makePlayer} from '../server/players.js';
import {terrainHeight} from '../shared/physics.js';
import {launch} from './game-harness.js';
test('sprint drains a finite reserve; exhaustion locks sprint until recovery, with frame-rate independent drain',()=>{
 for(const dt of [1/20,1/60]){
  const p={};for(let t=0;t<9;t+=dt)spendStamina(p,true,dt);
  assert.equal(p.exhausted,true);assert.equal(spendStamina(p,true,dt),false);
  for(let t=0;t<4;t+=dt)spendStamina(p,false,dt);
  assert.ok(p.stamina>24);assert.equal(spendStamina(p,true,dt),true);
 }
});
test('flare follows an arc, stops at a wall or floor, then expires',()=>{
 const p={x:0,y:1.7,z:0,yaw:0,pitch:0};let f=spawnFlare(p,'test');
 const before=f.y;advanceFlares([f],.1,()=>0);assert.ok(f.y>before);assert.ok(f.z<0);
 for(let i=0;i<100;i++)advanceFlares([f],.05,()=>0);
 assert.equal(f.landed,true);assert.equal(f.y,.09);
 assert.equal(advanceFlares([f],8,()=>0).length,0);
 f=spawnFlare(p,'wall');advanceFlares([f],.2,()=>0,()=>true);assert.equal(f.z,0);assert.equal(f.landed,true);
});
test('lure commits to a signal; its expiry increases aggression without disclosing a hidden player',()=>{
 const state={state:'running',lastKnown:[0,0],targetId:'player'},body={x:0,z:0};
 const a={id:'a',x:30,z:0,life:1},b={id:'b',x:20,z:0,life:1};
 assert.equal(applyFlareLure(state,body,[a,b],.05),true);assert.equal(state.lureId,'a');assert.equal(state.targetId,null);
 assert.equal(applyFlareLure(state,body,[b,a],.05),true);assert.equal(state.lureId,'a');
 applyFlareLure(state,body,[],.05);assert.equal(state.anger,18);assert.equal(state.state,'searching');assert.equal(state.noise,null);assert.equal(state.memoryAge,99);
});
test('authoritative enemies forget old player sounds while distracted and do not reacquire a silent crouching player',()=>{
 const world=makeWorld(config),s=world.sim,p=makePlayer({id:'silent'},0);
 p.x=s.turbine.x+30;p.z=s.turbine.z;p.y=terrainHeight(p.x,p.z)+.72;p.crouching=true;
 s.noise(p,100);s.step(.05,[p]);
 world.flares=[{id:'lure',x:s.turbine.x+20,z:s.turbine.z-25,life:12}];
 for(let i=0;i<180;i++)s.step(.05,[p]);
 assert.equal(s.enemy.lureId,'lure');assert.equal(s.enemy.targetId,null);
 world.flares=[];s.step(.05,[p]);assert.equal(s.enemy.anger,18);assert.equal(s.enemy.targetId,null);
 for(let i=0;i<10;i++)s.step(.05,[p]);assert.equal(s.enemy.targetId,null);
});
test('singleplayer flare pickup, grip, switch, signal light and stamina HUD run through full game',()=>{
 const {run,document}=launch();
 run("resetWorld(true);setMode('playing');locked=true;game.hasFlare=true;game.flareTaken=true;game.flares=3;equipTool('flare');updateFieldKit(.5);updateFieldKit(.5);updateCamera(.016);buildObjects();");
 assert.equal(run("objectDraws.some(o=>o.mesh===flareGunMesh)"),true);
 run('fireFlare();updateSurvival(.05);buildObjects();');assert.equal(run('game.flares'),2);assert.equal(run('localFlares.length'),1);assert.ok(run('flareLights[3]')>0);
 run('fireFlare();');assert.equal(run('game.flares'),2);
 run("game.stamina=40;updateFieldKit(.05)");assert.equal(document.getElementById('staminaBar').getAttribute('aria-valuenow'),'40');
 run("keys.add('KeyW');keys.add('ShiftLeft');for(let i=0;i<600;i++)updateCamera(1/60);");assert.ok(run('game.stamina')<35);
});
test('flashlight lowest surface rests on the bench and the pylon supports reach the terrain',()=>{
 const {run}=launch();
 const bounds=run(`(()=>{const m=IMPORTED_MODELS.flashlight,b=Uint8Array.from(atob(m.vertices),c=>c.charCodeAt(0)),d=new DataView(b.buffer),p=flashlightPosition(),mat=restingFlashlightMatrix(p);let min=Infinity,max=-Infinity;for(let i=0;i<m.vertexCount;i++){const v=[0,1,2].map(k=>d.getFloat32(i*32+k*4,true)),y=mat[1]*v[0]+mat[5]*v[1]+mat[9]*v[2]+mat[13];min=Math.min(min,y);max=Math.max(max,y);}return{min,max,top:shed.y+BENCH_TOP};})()`);
 assert.ok(Math.abs(bounds.min-bounds.top)<.001);assert.ok(bounds.max-bounds.min<.1);
 assert.equal(run('corridorTowers.every(t=>!!t.shoes)'),true);
});
