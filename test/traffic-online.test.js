import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import WebSocket from 'ws';
import {createApp} from '../server/server.js';
import {LAYOUT_VERSION} from '../shared/world-layout.js';
import {forestTerrainHeight} from '../shared/forest-level.js';
import {collectEquipment} from '../shared/equipment-rules.js';
test('two real clients synchronize traffic phase, host pause, stomp attacks and backpack state',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'tower-equipment-')),app=createApp({dbPath:join(dir,'accounts.sqlite'),authRate:30}),sockets=[];
  const a=await app.listen(0,'127.0.0.1'),origin=`http://127.0.0.1:${a.port}`;
  async function device(){
    const session=await (await fetch(origin+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).json();
    const ws=new WebSocket(origin.replace('http','ws')+'/ws',{headers:{Origin:origin}}),c={ws,messages:[],id:0};sockets.push(ws);
    ws.on('message',b=>c.messages.push(JSON.parse(b)));c.send=m=>ws.send(JSON.stringify(m));
    c.wait=async(type,p=()=>true)=>{for(let n=0;n<150;n++){const i=c.messages.findIndex(m=>m.type===type&&p(m));if(i>=0)return c.messages.splice(i,1)[0];await delay(20);}throw Error('Timed out: '+type+' '+JSON.stringify(c.messages));};
    c.action=async(action,extra={})=>{const id=++c.id;c.send({type:'action',id,action,...extra});return c.wait('actionResult',m=>m.id===id);};
    await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});c.send({type:'hello',protocol:1,layoutVersion:LAYOUT_VERSION,token:session.token});await c.wait('authenticated');return c;
  }
  try{
    const host=await device(),friend=await device();host.send({type:'host',seed:'0'});const joined=await host.wait('joined');friend.send({type:'join',code:joined.code});await friend.wait('joined');host.send({type:'start'});await host.wait('snapshot',m=>m.phase==='playing');
    const room=app.rooms.rooms.get(joined.code),p=room.players.get(room.ownerId),q=[...room.players.values()].find(x=>x.id!==p.id);
    const w=room.world,s=w.trafficLights[0];w.powerStopped=w.turbineStopped=true;
    for(const player of [p,q])Object.assign(player,{x:s.x,z:s.z+40,y:2,biome:'meadow',godMode:true});
    Object.assign(s,{active:true,phase:'red',phaseTime:4.2,targetId:p.id});
    const stopped=await host.wait('snapshot',m=>m.world.trafficLights?.[0]?.active&&m.world.trafficLights[0].phase==='red');
    assert.equal(stopped.world.trafficLights[0].vx,0);assert.equal(stopped.world.layoutVersion,9);
    const moved=await friend.wait('snapshot',m=>m.world.trafficLights?.[0]?.phase==='green'&&Math.hypot(m.world.trafficLights[0].vx,m.world.trafficLights[0].vz)>1);
    const matching=await host.wait('snapshot',m=>m.world.elapsed===moved.world.elapsed);
    assert.deepEqual(matching.world.trafficLights,moved.world.trafficLights);
    assert.ok(moved.world.trafficLights.every(s=>s.feet.length===2&&s.feet.every(f=>f.position.every(Number.isFinite))));
    assert.equal((await friend.action('host',{value:{command:'traffic',enabled:true}})).ok,false);
    assert.equal((await host.action('host',{value:{command:'traffic',enabled:true}})).ok,true);
    const paused=await friend.wait('snapshot',m=>m.world.trafficStopped===true);
    assert.ok(paused.world.trafficLights.every(v=>v.paused&&v.phase==='red'&&v.vx===0&&v.vz===0));
    const frozen=await host.wait('snapshot',m=>m.world.elapsed>paused.world.elapsed+.15&&m.world.trafficStopped);
    assert.deepEqual(frozen.world.trafficLights,paused.world.trafficLights);
    Object.assign(p,{x:s.feet[1].position[0],z:s.feet[1].position[2]+1});Object.assign(s,{phase:'green',phaseTime:0,stompCooldown:0});
    for(const f of s.feet)f.progress=1;
    assert.equal((await host.action('host',{value:{command:'traffic',enabled:false}})).ok,true);
    const attack=await friend.wait('snapshot',m=>m.world.trafficLights[0].stomp?.phase==='windup');
    const sameAttack=await host.wait('snapshot',m=>m.world.elapsed===attack.world.elapsed);assert.deepEqual(sameAttack.world.trafficLights,attack.world.trafficLights);
    const landed=await friend.wait('snapshot',m=>m.world.trafficLights[0].impactSerial>0);assert.equal(landed.world.trafficStopped,false);
    p.inventory.backpack=true;assert.equal((await host.action('inventory',{open:true})).ok,true);
    await friend.wait('snapshot',m=>m.players.some(v=>v.id===p.id&&v.inventoryOpen&&v.inventory.backpack));
    assert.equal((await host.action('inventory',{open:false})).ok,true);
    await friend.wait('snapshot',m=>m.players.some(v=>v.id===p.id&&!v.inventoryOpen&&v.inventory.backpack));
  }finally{for(const ws of sockets)ws.terminate();await app.close();rmSync(dir,{recursive:true,force:true});}
});
