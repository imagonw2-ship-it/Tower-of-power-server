import test from 'node:test';
import assert from 'node:assert/strict';
import {launch} from './game-harness.js';

const {run}=launch();
function setup(){run("net.code='';resetWorld(true,0);setMode('playing');locked=true;game.hasGun=true;game.ammo=8;game.reserve=34;equippedTool='gun';equipmentMotion.shown='gun';equipmentMotion.lower=0;game.sprinting=false;player.yaw=.4;player.pitch=.1;updateCamera(0);");}
test('aim, recoil and sprint settle consistently at 20, 30, 60 and 120 fps',()=>{
  const samples=[];
  for(const fps of [20,30,60,120]){setup();run(`gunMotion.aiming=true;gunMotion.velocities.kick=9;for(let i=0;i<${fps/2};i++)updateGun(1/${fps});`);samples.push(run('[gunMotion.aim,gunMotion.kick]'));}
  for(const sample of samples)for(let k=0;k<2;k++)assert.ok(Math.abs(sample[k]-samples[0][k])<1e-6);
  assert.ok(samples[0][0]>.99);assert.ok(samples[0][1]<.002);
});
test('sprint and rapid aim reversal do not jump the held model',()=>{
  setup();run('gunMotion.aiming=true;for(let i=0;i<6;i++)updateGun(1/60);');const before=run('Array.from(heldGunMatrix())');
  run('game.sprinting=true;gunMotion.aiming=false;');assert.deepEqual(run('Array.from(heldGunMatrix())'),before);
  run('updateGun(1/60);');const after=run('Array.from(heldGunMatrix())');assert.ok(Math.hypot(...after.slice(12,15).map((v,i)=>v-before[12+i]))<.02);
  assert.ok(run('gunMotion.sprint>0&&gunMotion.sprint<.05'));
});
test('aimed front and rear sights share the gameplay aim ray despite body-camera lag',()=>{
  setup();run('gunMotion.aim=1;cameraDynamics.yawLag=.04;cameraDynamics.pitchLag=-.02;updateCamera(0);');
  const result=run(`(()=>{const m=heldGunMatrix(),p=z=>[0,1,2].map(k=>m[12+k]+m[4+k]*.05491+m[8+k]*z),a=p(.019),b=p(-.162),d=norm(b.map((v,k)=>v-a[k])),cp=Math.cos(player.pitch),target=[player.x-Math.sin(player.yaw)*cp*35,player.y+Math.sin(player.pitch)*35,player.z-Math.cos(player.yaw)*cp*35];return{error:Math.hypot(...cross(d,target.map((v,k)=>v-a[k]))),width:Math.hypot(m[0],m[1],m[2])};})()`);
  assert.ok(result.error<.003,`sight miss ${result.error}m`);assert.ok(Math.abs(result.width-1)<1e-6);
});
test('reusing a 10 Hz server snapshot does not restart the reload timer every rendered frame',()=>{
  setup();run("net.code='QA';const reloadSnapshot={actionSeq:4,inventory:{ammo:8,reserve:34},gunReload:1.5};syncGunInventory(reloadSnapshot,1000,1000);");
  for(let i=0;i<6;i++)run(`syncGunInventory(reloadSnapshot,1000,${1000+i*1000/60});updateGun(1/60);`);
  assert.ok(Math.abs(run('game.gunReload')-1.4)<1e-6);
  const progress=run('gunMotion.reload');run('syncGunInventory({...reloadSnapshot,gunReload:1.48},1100,1100);updateGun(1/60);');assert.ok(run('gunMotion.reload')>progress);
  run("net.code='';");
});
test('magazine leaves, pauses outside and seats before the support hand returns',()=>{
  setup();const states=run('[.1,.45,.5,.79,.95,1].map(gunReloadPose)');
  assert.equal(states[0].magDrop,0);assert.ok(states[1].magDrop>.16);assert.equal(states[1].magDrop,states[2].magDrop);assert.equal(states[3].magDrop,0);assert.ok(states[3].reach>.9);assert.ok(states[4].reach<.04);assert.deepEqual({...states[5]},{tilt:0,magDrop:0,reach:0});
});
test('reload cancellation returns the hands and magazine continuously instead of snapping',()=>{
  setup();run('reloadGun();for(let i=0;i<40;i++)updateGun(1/60);');const drop=run('gunMotion.magDrop'),tilt=run('gunMotion.reloadTilt');assert.ok(drop>.1);
  run('confirmGunAction({action:"reload",ok:false});updateGun(1/60);');assert.ok(run('gunMotion.magDrop')>drop*.8);assert.ok(run('gunMotion.reloadTilt')>tilt*.8);
  run('for(let i=0;i<60;i++)updateGun(1/60);');assert.ok(run('gunMotion.magDrop<.00001&&gunMotion.reloadTilt<.00001'));
});
test('both skinned hands remain finite and attached throughout aiming and reload',()=>{
  setup();run('reloadGun();');
  for(let i=0;i<55;i++){
    run('updateGun(1/30);updateCamera(0);objectDraws.length=0;appendHeldGun();');
    assert.equal(run('objectDraws.filter(o=>o.povArm).length'),2);
    assert.ok(run('objectDraws.every(o=>o.model.every(Number.isFinite)&&(!o.bones||o.bones.every(Number.isFinite)))'));
  }
});
