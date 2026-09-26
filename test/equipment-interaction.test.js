import test from 'node:test';
import assert from 'node:assert/strict';
import {launch} from './game-harness.js';

function aimAtBench(run){
  run("resetWorld(true);setMode('playing');locked=true;player.x=shed.x-1.62;player.z=shed.z+1.65;updateCamera(0);const target=flashlightPosition();const d=target.map((v,i)=>v-cameraPosition[i]);player.yaw=Math.atan2(-d[0],-d[2]);player.pitch=Math.atan2(d[1],Math.hypot(d[0],d[2]));updateCamera(0);updatePickupPrompt();");
}

test('pickup prompt follows the item and tapping it collects exactly that item',()=>{
  const {run,document,context}=launch();aimAtBench(run);
  const button=document.getElementById('touchPickup');
  assert.equal(document.querySelector('#touchControls #touchPickup'),null);
  assert.equal(button.hidden,false);assert.equal(button.dataset.itemId,'local-flashlight');
  const x=parseFloat(button.style.left),y=parseFloat(button.style.top);
  assert.ok(x>300&&x<540&&y>70&&y<300,'prompt is anchored in the scene, not the bottom controls');
  run('player.yaw+=.09;updateCamera(0);updatePickupPrompt();');
  assert.notEqual(parseFloat(button.style.left),x,'prompt must track the moving item projection');
  button.dispatchEvent(new context.Event('pointerdown',{bubbles:true,cancelable:true}));
  assert.equal(run('game.hasFlashlight'),true);assert.equal(run('game.sodas'),0);
  run("setMode('paused');updatePickupPrompt();");assert.equal(button.hidden,true);
});

test('pickup prompt hides behind walls and multiplayer taps retain the displayed item ID',()=>{
  const {run,document,context}=launch();aimAtBench(run);
  run("net.code='PROMPT';net.status='CONNECTED';net.player={id:'local'};const sent=[];net.socket={readyState:1,bufferedAmount:0,send:s=>sent.push(JSON.parse(s))};net.items=[{id:'torch-A',kind:'flashlight',x:target[0],y:target[1],z:target[2],holder:null},{id:'torch-B',kind:'flashlight',x:target[0]+.15,y:target[1],z:target[2],holder:null}];updatePickupPrompt();");
  assert.equal(document.getElementById('touchPickup').dataset.itemId,'torch-A');
  run('net.items.reverse();');
  document.getElementById('touchPickup').dispatchEvent(new context.Event('pointerdown',{bubbles:true,cancelable:true}));
  assert.equal(run('sent.at(-1).itemId'),'torch-A');assert.equal(run('game.hasFlashlight'),false,'online pickup awaits server approval');
  run('net.items[1].holder="another-player";updatePickupPrompt();');
  assert.notEqual(run('pickupPromptTarget'),'torch-A');
  run('player.x=shed.x-3.6;player.z=shed.z+.2;updateCamera(0);updatePickupPrompt();');
  assert.equal(document.getElementById('touchPickup').hidden,true);
  run("net.status='CONNECTION LOST';updatePickupPrompt();");assert.equal(document.getElementById('touchPickup').hidden,true);
});

test('switching lowers, swaps and raises the held model and preserves flashlight preference',()=>{
  const {run}=launch();
  run("resetWorld(true);setMode('playing');locked=true;game.hasFlashlight=true;kitPreviousFlashlight=true;game.sodas=2;updateCamera(0);const initial=heldEquipmentMatrix()[13];equipTool('flashlight');");
  assert.equal(run('equipmentMotion.shown'),'camera');assert.equal(run('torchStrength()'),0);
  run('for(let i=0;i<7;i++)updateFieldKit(.02);');
  assert.equal(run('equipmentMotion.shown'),'camera');assert.ok(run('heldEquipmentMatrix()[13]<initial-.3'));
  run('for(let i=0;i<18;i++)updateFieldKit(.02);');
  assert.equal(run('equipmentMotion.shown'),'flashlight');assert.equal(run('equipmentMotion.phase'),'idle');assert.equal(run('torchStrength()'),1);
  run("toggleFlashlight();equipTool('camera');for(let i=0;i<25;i++)updateFieldKit(.02);equipTool('flashlight');for(let i=0;i<25;i++)updateFieldKit(.02);");
  assert.equal(run('game.torchOn'),false,'explicitly switching the light off is remembered');
  run("toggleFlashlight();equipTool('soda');updateFieldKit(.08);equipTool('none');for(let i=0;i<30;i++)updateFieldKit(.02);buildObjects();");
  assert.equal(run('equipmentMotion.shown'),'none');assert.equal(run('torchStrength()'),0);
  run("openFieldKit();equipTool('camera');updateFieldKit(.1);");assert.equal(run('equipmentMotion.lower'),1);
  run('closeFieldKit();for(let i=0;i<20;i++)updateFieldKit(.02);');assert.equal(run('equipmentMotion.lower'),0);
});

test('remote players lower their hand when changing equipment and keep the item attached',()=>{
  const {run}=launch();
  run("resetWorld(true);setMode('playing');const p={id:'swap',x:player.x,z:player.z-4,yaw:Math.PI,heldItem:'camera'};appendHazmat(p,1);const before=avatarCache.get(p.id).matrices[AVATAR_ASSET.bones.indexOf('hand_r')][13];p.heldItem='flashlight';");
  run('objectDraws.length=0;appendHazmat(p,1.05);');assert.equal(run('objectDraws.at(-1).assetKind'),6);
  run('objectDraws.length=0;appendHazmat(p,1.1);');assert.ok(run("avatarCache.get(p.id).matrices[AVATAR_ASSET.bones.indexOf('hand_r')][13]<before-.05"));
  run('for(let i=1;i<=30;i++){objectDraws.length=0;appendHazmat(p,1.1+i*.02);}');assert.equal(run('objectDraws.at(-1).assetKind'),1);
  assert.ok(run("avatarCache.get(p.id).bones.every(Number.isFinite)"));
});
