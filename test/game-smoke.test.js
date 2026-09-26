// Full game integration checks. Shader compilation has its own native GLES gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {launch} from './game-harness.js';

test('complete mobile game builds its geometry and runs singleplayer, kit, pickups and tools',()=>{
  const {run,document,errors}=launch();
  run("resetWorld(true);setMode('playing');locked=true;frame(1000);frame(1050);");
  assert.equal(run('corridorTowers.length'),6);
  assert.equal(run('game.mode'),'playing');
  assert.equal(run("equipTool('flashlight')"),false);
  run('openFieldKit()');assert.equal(document.getElementById('fieldKit').hidden,false);assert.equal(run('game.mode'),'inventory');
  run('closeFieldKit()');assert.equal(run('game.mode'),'playing');
  run('player.x=shed.x-1.6;player.z=shed.z+1.5;player.y=shed.y+1.9;pickupFlashlight();updateFieldKit(.2)');assert.equal(run('equippedTool'),'flashlight');assert.equal(run('game.torchOn'),true);
  run('useEquipment()');assert.equal(run('game.torchOn'),false);
  run("game.sodas=2;equipTool('soda');useEquipment();");assert.equal(run('game.sodas'),1);assert.equal(run('game.boostTime'),15);
  run("equipTool('camera');useEquipment();frame(1100)");assert.equal(run('game.photos'),1);
  run('openFieldKit();mainMenu();frame(1150)');assert.equal(run('game.mode'),'menu');assert.equal(document.getElementById('fieldKit').hidden,true);
  assert.equal(run('game.hasFlashlight'),false);assert.equal(run('equippedTool'),'camera');assert.deepEqual(errors,[]);
});
test('touch events keep movement separate from toggle sprint, crouch, zoom and Use',()=>{
  const {run,context,document}=launch();
  run("resetWorld(true);setMode('playing');locked=true;");
  const joy=document.getElementById('joyBase');joy.getBoundingClientRect=()=>({left:30,top:230,width:118,height:118});
  const event=(el,type,values={})=>{const e=new context.Event(type,{bubbles:true,cancelable:true});Object.assign(e,values);el.dispatchEvent(e);};
  event(joy,'pointerdown',{pointerId:1,clientX:89,clientY:249});assert.equal(run('mobileInput.sprint'),false);
  event(document.getElementById('touchSprint'),'pointerdown');assert.equal(run('mobileInput.sprint'),true);
  event(document.getElementById('touchSprint'),'pointerup');assert.equal(run('mobileInput.sprint'),true);
  event(joy,'pointerup',{pointerId:1});assert.equal(run('mobileInput.sprint'),true);assert.equal(run('mobileInput.y'),0);
  event(document.getElementById('touchSprint'),'pointerdown');assert.equal(run('mobileInput.sprint'),false);
  event(document.getElementById('touchCrouch'),'pointerdown');assert.equal(run('game.crouching'),true);
  event(document.getElementById('touchAim'),'pointerdown');assert.equal(run('game.zoomTarget'),2);
  event(document.getElementById('touchUse'),'pointerdown');assert.equal(run('game.photos'),1);
  event(document.getElementById('touchKit'),'pointerdown');assert.equal(run('game.mode'),'inventory');
  run("dispatchEvent(new Event('tower-back'))");assert.equal(run('game.mode'),'playing');
});
test('offline pylon wakes and uses a foot attack while the complete frame pipeline keeps running',()=>{
  const {run,errors}=launch();
  run("resetWorld(true);setMode('playing');locked=true;world.turbineStopped=true;player.x=POWER_ZONE.x+24;player.z=POWER_ZONE.z;player.y=terrainHeight(player.x,player.z)+1.7;");
  run('for(let i=0;i<92;i++){if(i%8===0)emitNoise(80);frame(1000+i*50);}');
  assert.ok(run("powerCreature.state!=='dormant'"));assert.ok(run('powerCreature.attack !== null'));
  run('for(let i=92;i<135;i++)frame(1000+i*50);');assert.equal(run('game.mode'),'lost');assert.deepEqual(errors,[]);
});

test('hazmat clips, censored faces and held items render through the full object pipeline',()=>{
  const {run,errors}=launch();
  run("resetWorld(true);setMode('playing');locked=true;const avatarTestPlayer={id:'qa-avatar',x:player.x+3,z:player.z,yaw:0,pitch:0,vx:0,vz:0,heldItem:'camera'};");
  for(const [crouching,sprinting,speed,item] of [[false,false,0,'camera'],[false,false,3,'flashlight'],[false,true,8,'soda'],[true,false,2,'none'],[true,false,0,'flashlight']]){
    run(`objectDraws.length=0;Object.assign(avatarTestPlayer,{crouching:${crouching},sprinting:${sprinting},vx:${speed},heldItem:'${item}'});appendHazmat(avatarTestPlayer,${1+speed});drawObjects(turbineProgram);`);
    assert.ok(run("avatarCache.get('qa-avatar').bones.every(Number.isFinite)"));
    assert.equal(run('objectDraws.filter(o=>o.assetKind===6).length'),1);
    assert.equal(run('objectDraws.filter(o=>o.assetKind===5).length'),3);
    assert.equal(run('objectDraws.length'),item==='none'?4:5);
  }
  assert.equal(run("document.getElementById('gameLogo')"),null);assert.equal(run("document.querySelectorAll('#handSlot').length"),1);assert.deepEqual(errors,[]);
});
test('world panel access is limited to the host in multiplayer',()=>{
  const {run}=launch();
  run("resetWorld(true);setMode('playing');net.code='HOST1';net.player={id:'guest'};net.snapshots=[{ownerId:'host'}];openFieldPanel();");assert.equal(run('game.mode'),'playing');
  run("net.player.id='host';openFieldPanel();");assert.equal(run('game.mode'),'fieldPanel');
});
