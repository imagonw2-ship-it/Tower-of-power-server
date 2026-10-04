import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import WebSocket from 'ws';
import {encodeVoice,decodeVoice,validVoicePacket} from '../shared/voice-codec.js';
import {relayVoice,voiceMix} from '../server/voice.js';
import {silentSearch,pylonCountForPlayers} from '../shared/silent-search.js';
import {makeWorld,startWorld,growPylons} from '../server/worlds.js';
import {makePlayer} from '../server/players.js';
import {config} from '../server/config.js';
import {createApp} from '../server/server.js';
import {launch} from './game-harness.js';
const tone=()=>Float32Array.from({length:800},(_,i)=>.25*Math.sin(i*.14)+.1*Math.sin(i*.037));
test('voice packets recover speech-band audio independently and reject malformed frames',()=>{
 const samples=tone(),packet=encodeVoice(samples,65535),decoded=decodeVoice(packet);
 assert.equal(packet.length,408);assert.equal(validVoicePacket(packet),true);
 let signal=0,error=0;for(let i=0;i<800;i++){signal+=samples[i]**2;error+=(samples[i]-decoded[i])**2;}
 assert.ok(10*Math.log10(signal/error)>20);
 assert.equal(validVoicePacket(packet.slice(1)),false);packet[6]=255;assert.equal(validVoicePacket(packet),false);
 assert.ok(decodeVoice(encodeVoice(samples,0)).every(Number.isFinite));
});
test('voice worklet downsamples, mixes stereo, bounds jitter and expires silent sources',()=>{
 let Processor;const messages=[];
 const context=vm.createContext({Float32Array,Map,Math,sampleRate:48000,currentTime:0,
  AudioWorkletProcessor:class{constructor(){this.port={postMessage:m=>messages.push(m)};}},registerProcessor:(_,p)=>Processor=p});
 vm.runInContext(readFileSync(new URL('../client/voice-worklet.js',import.meta.url),'utf8'),context);
 const p=new Processor(),send=m=>p.port.onmessage({data:m}),out=[new Float32Array(128),new Float32Array(128)];
 send({type:'capture',enabled:true});for(let i=0;i<375;i++)p.process([[new Float32Array(128).fill(.1)]],[out]);
 assert.equal(messages.length,20);assert.equal(messages[0].samples.length,800);
 for(let i=0;i<12;i++)send({type:'packet',id:1,samples:new Float32Array(800).fill(.3),gain:.5,pan:.6});
 assert.equal(p.peers.get(1).queue.length,5);p.process([], [out]);assert.ok(out[1][0]>out[0][0]&&out[0][0]>0);
 context.currentTime=1;p.process([],[out]);assert.equal(p.peers.size,0);assert.ok(out[0].every(v=>v===0));
 send({type:'capture',enabled:false});p.process([[new Float32Array(128)]],[out]);assert.equal(messages.length,20);
});
test('relay requires a live microphone and enforces room, distance, replay and bandwidth limits',()=>{
 const a={id:'a',alive:true,connected:true,x:100,y:2,z:100,yaw:0,voiceSlot:1},b={...a,id:'b',x:110,voiceSlot:2},c={...a,id:'c',x:170},d={...a,id:'d'};
 let noises=0;const room={phase:'playing',players:new Map([a,b,c,d].map(p=>[p.id,p])),world:{sim:{noise(){noises++;}}}};
 const heard=[],far=[],other=[],ws={player:a,room,voiceEnabled:true},sockets=new Map([['a',ws],['b',{room,readyState:1,bufferedAmount:0,send:p=>heard.push(p)}],['c',{room,readyState:1,bufferedAmount:0,send:p=>far.push(p)}],['d',{room:{},readyState:1,bufferedAmount:0,send:p=>other.push(p)}]]);
 assert.equal(relayVoice(ws,encodeVoice(tone(),1),sockets,1000),true);assert.equal(heard.length,1);assert.equal(far.length,0);assert.equal(other.length,0);assert.equal(noises,1);
 assert.equal(heard[0].length,416);assert.equal(relayVoice(ws,encodeVoice(tone(),1),sockets,1050),false);
 ws.voiceEnabled=false;assert.equal(relayVoice(ws,encodeVoice(tone(),2),sockets,1100),false);ws.voiceEnabled=true;
 a.alive=false;assert.equal(relayVoice(ws,encodeVoice(tone(),2),sockets,1100),false);a.alive=true;
 let accepted=0;for(let i=2;i<100;i++)if(relayVoice(ws,encodeVoice(tone(),i),sockets,1200))accepted++;
 assert.ok(accepted<=26);assert.ok(voiceMix(a,b).gain>voiceMix(a,{...b,x:130}).gain);assert.equal(voiceMix(a,c),null);
});
test('two independent WebSocket devices receive nearby voice, isolate other rooms and reconnect muted',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'tower-voice-')),app=createApp({dbPath:join(dir,'db.sqlite'),authRate:100}),clients=[];
 const address=await app.listen(0,'127.0.0.1'),origin=`http://127.0.0.1:${address.port}`;
 t.after(async()=>{for(const c of clients)c.ws.terminate();await app.close();rmSync(dir,{recursive:true,force:true});});
 const until=async f=>{for(let i=0;i<150;i++){const v=f();if(v)return v;await delay(20);}throw Error('network timeout');};
 async function device(session){
  session??=await(await fetch(origin+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json();
  const c={session,json:[],audio:[],ws:new WebSocket(origin.replace('http','ws')+'/ws',{headers:{Origin:origin}})};clients.push(c);
  c.ws.on('message',(b,binary)=>binary?c.audio.push(b):c.json.push(JSON.parse(b)));c.send=m=>c.ws.send(JSON.stringify(m));
  c.wait=type=>until(()=>{const i=c.json.findIndex(m=>m.type===type);return i>=0?c.json.splice(i,1)[0]:null;});
  await new Promise((resolve,reject)=>{c.ws.once('open',resolve);c.ws.once('error',reject);});c.send({type:'hello',protocol:1,layoutVersion:3,token:session.token});await c.wait('authenticated');return c;
 }
 const a=await device(),b=await device(),c=await device();a.send({type:'host'});const joined=await a.wait('joined');
 b.send({type:'join',code:joined.code});await b.wait('joined');c.send({type:'host'});await c.wait('joined');
 a.send({type:'voice',enabled:true});a.ws.send(encodeVoice(tone(),1));await until(()=>b.audio.length===1);assert.equal(c.audio.length,0);
 const room=app.rooms.rooms.get(joined.code),p=room.players.get(b.session.player.id);p.x+=100;
 a.ws.send(encodeVoice(tone(),2));await delay(100);assert.equal(b.audio.length,1);
 a.ws.terminate();await until(()=>!room.players.get(a.session.player.id).connected);const r=await device(a.session);r.send({type:'resume',code:joined.code});await r.wait('joined');
 p.x=room.players.get(a.session.player.id).x+3;r.ws.send(encodeVoice(tone(),0));await delay(80);assert.equal(b.audio.length,1);
 r.send({type:'voice',enabled:true});r.ws.send(encodeVoice(tone(),1));await until(()=>b.audio.length===2);
});
test('60 seconds without sound gives only a coarse fixed hint, never an attack target',()=>{
 const w=makeWorld(config),s=w.sim,p=makePlayer({id:'quiet'},0);p.x=s.turbine.x+10;p.z=s.turbine.z;p.crouching=true;
 for(let i=0;i<1199;i++)s.step(.05,[p]);assert.equal(s.enemy.searchOnly,undefined);
 s.step(.1,[p]);assert.equal(s.enemy.searchOnly,true);assert.equal(s.enemy.targetId,null);assert.equal(s.enemy.attack,null);
 const hint=s.enemy.searchHint.slice();assert.ok(Math.hypot(hint[0]-p.x,hint[1]-p.z)>1);
 p.x+=100;for(let i=0;i<300;i++)s.step(.05,[p]);assert.deepEqual(s.enemy.searchHint,hint);assert.equal(p.alive,true);
 p.x=s.turbine.x;p.z=s.turbine.z;for(let i=0;i<40;i++)s.step(.05,[p]);assert.equal(p.alive,true);assert.equal(s.enemy.attack,null);
 s.noise(p,100);s.step(.05,[p]);assert.equal(s.enemy.searchOnly,false);assert.equal(s.enemy.targetId,p.id);
 const state={silence:59.9};assert.equal(silentSearch(state,{x:0,z:0},[{...p,connected:false}],.2),false);
});
test('pylon population scales 1–8 players, grows for late joins, and preserves independent state',()=>{
 assert.deepEqual([1,2,3,4,5,6,7,8].map(n=>pylonCountForPlayers(n)),[1,1,2,2,3,3,4,4]);
 for(const n of [1,3,5,8]){
  const w=makeWorld(config);startWorld(w,n);assert.equal(w.sim.snapshot().powers.length,Math.ceil(n/2));
  const p=makePlayer({id:'one'},0);for(let i=0;i<2;i++)w.sim.step(.05,[p]);
  for(const e of w.sim.snapshot().powers)assert.ok(e.feet.every(f=>f.position.every(Number.isFinite)));
 }
 const w=makeWorld(config);startWorld(w,2);growPylons(w,5);assert.equal(w.extraPylons.length,2);
 const first=w.extraPylons[0];growPylons(w,1);assert.equal(w.extraPylons[0],first);assert.equal(w.extraPylons.length,2);
 first.powerCreature.searchOnly=true;assert.notEqual(w.extraPylons[1].powerCreature.searchOnly,true);
 const other=makeWorld(config);assert.equal(other.extraPylons.length,0);
});
test('microphone denial is recoverable; muting, pausing and disconnecting release capture tracks',async()=>{
 const {run,document}=launch();run(`net.code='VOICE';net.status='CONNECTED';net.socket={readyState:1,bufferedAmount:0};net.send=()=>{};game.mode='playing';
  let released=0;proximityVoice.ensureAudio=async()=>{proximityVoice.node={port:{postMessage(){}}};proximityVoice.context={createMediaStreamSource:()=>({connect(){},disconnect(){}})};};
  navigator.mediaDevices={getUserMedia:async()=>{throw Object.assign(Error('denied'),{name:'NotAllowedError'});}};`);
 await run('proximityVoice.toggle()');assert.equal(run('proximityVoice.enabled'),false);assert.equal(document.getElementById('voiceStatus').textContent,'MIC PERMISSION DENIED');
 run('navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[{stop(){released++}}]});');await run('proximityVoice.toggle()');assert.equal(run('proximityVoice.enabled'),true);
 run("game.mode='paused';proximityVoice.update()");assert.equal(run('proximityVoice.enabled'),false);assert.equal(run('released'),1);
 run("game.mode='playing'");await run('proximityVoice.toggle()');run("net.status='CONNECTION LOST';proximityVoice.update()");assert.equal(run('released'),2);
});
