// Executes the full shipped script with a DOM and a recording GL adapter.
// This catches integration/geometry faults; it is not a GPU rendering test.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
function launch(touch=true){
  const {document,window:domWindow}=parseHTML(html),errors=[],uploads=[],shaders=[];
  const constants=new Map();let value=1;
  const handlers={
    getShaderParameter:()=>true,getProgramParameter:(_,p)=>p===gl.ACTIVE_UNIFORMS?0:true,
    getExtension:()=>null,checkFramebufferStatus:()=>gl.FRAMEBUFFER_COMPLETE,
    getParameter:()=>4096,shaderSource:(_,s)=>shaders.push(s),
    bufferData:(_,data)=>{if(ArrayBuffer.isView(data)){assert.ok(data.every(Number.isFinite));uploads.push(data.length);}},
    bufferSubData:(_,__,data)=>assert.ok(data.every(Number.isFinite)),
  };
  const gl=new Proxy(handlers,{get(o,k){if(k in o)return o[k];if(/^[A-Z_0-9]+$/.test(k)){if(!constants.has(k))constants.set(k,value++);return constants.get(k);}if(k.startsWith('create'))return()=>({});return()=>{};}});
  const canvas=document.getElementById('field');canvas.getContext=()=>gl;
  canvas.requestPointerLock=async()=>{document.pointerLockElement=canvas;document.dispatchEvent(new domWindow.Event('pointerlockchange'));};
  document.exitPointerLock=()=>{document.pointerLockElement=null;document.dispatchEvent(new domWindow.Event('pointerlockchange'));};
  document.getElementById('photo').getContext=()=>null;
  for(const e of document.querySelectorAll('select'))Object.defineProperty(e,'value',{writable:true,value:e.querySelector('option')?.getAttribute('value')||''});
  for(const e of document.querySelectorAll('div,button,canvas'))e.setPointerCapture=()=>{};
  const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};
  const context=vm.createContext({document,navigator:{maxTouchPoints:touch?2:0,hardwareConcurrency:4},
    innerWidth:844,innerHeight:390,devicePixelRatio:1,performance,URL,AbortController,Event:domWindow.Event,
    location:new URL('https://appassets.androidplatform.net'),localStorage:storage(),sessionStorage:storage(),
    console:{log(){},warn(){},error:e=>errors.push(e)},setInterval(){},setTimeout(){},clearTimeout(){},
    requestAnimationFrame(){},addEventListener:(...a)=>domWindow.addEventListener(...a),
    dispatchEvent:(...a)=>domWindow.dispatchEvent(...a),matchMedia:q=>({matches:touch&&q.includes('pointer:coarse')}),
    Image:class{},atob:s=>Buffer.from(s,'base64').toString('binary'),btoa:s=>Buffer.from(s,'binary').toString('base64')});
  context.window=context;
  const run=s=>vm.runInContext(s,context);
  run(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(errors,[]);assert.equal(run('running'),true);assert.ok(uploads.length>20);assert.equal(shaders.length,12);
  return{document,context,run,errors};
}
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
test('touch events drive joystick sprint, crouch, zoom and the compact Use control',()=>{
  const {run,context,document}=launch();
  run("resetWorld(true);setMode('playing');locked=true;");
  const joy=document.getElementById('joyBase');joy.getBoundingClientRect=()=>({left:30,top:230,width:118,height:118});
  const event=(el,type,values={})=>{const e=new context.Event(type,{bubbles:true,cancelable:true});Object.assign(e,values);el.dispatchEvent(e);};
  event(joy,'pointerdown',{pointerId:1,clientX:89,clientY:249});assert.equal(run('mobileInput.sprint'),true);
  event(joy,'pointerup',{pointerId:1});assert.equal(run('mobileInput.sprint'),false);assert.equal(run('mobileInput.y'),0);
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
