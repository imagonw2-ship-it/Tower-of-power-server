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
test('two real clients share host-spawned equipment, reject guest summons and duplicate shots, and never damage another player',async()=>{
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
    assert.equal((await friend.action('host',{value:{command:'item',kind:'gun'}})).ok,false);
    assert.equal((await host.action('host',{value:{command:'item',kind:'gun'}})).ok,true);
    await friend.wait('snapshot',m=>m.world.items?.some(i=>i.kind==='gun'));
    Object.assign(p,{x:0,z:-16,y:forestTerrainHeight(0,-16)+1.7,biome:'forest',heldItem:'gun',sprinting:false});collectEquipment(p.inventory,{kind:'gun'});
    Object.assign(q,{x:0,z:-18,y:forestTerrainHeight(0,-18)+1.7,biome:'forest'});room.world.mimic.clear();
    const health=q.health;assert.equal((await host.action('shoot',{yaw:0,pitch:0,targetId:q.id})).ok,true);assert.equal(q.alive,true);assert.equal(q.health,health);
    const ammo=p.inventory.ammo;host.send({type:'action',id:host.id,action:'shoot',yaw:0,pitch:0});await delay(220);assert.equal(p.inventory.ammo,ammo);
    assert.equal((await host.action('inventory',{open:true})).ok,true);assert.equal((await host.action('shoot',{yaw:0,pitch:0})).ok,false);assert.equal((await host.action('inventory',{open:false})).ok,true);
    assert.equal((await host.action('shoot',{yaw:'invalid',pitch:0})).ok,false);
    const m=room.world.mimic;m.spawn(p,[p,q],room.world.voiceMemory);Object.assign(m,{x:0,z:-21,y:forestTerrainHeight(0,-21)+1.7,stateUntil:100});
    const pitch=Math.atan2(forestTerrainHeight(m.x,m.z)+1.65-p.y,5),result=await host.action('shoot',{yaw:0,pitch});
    assert.equal(result.ok,true);assert.equal(result.shot.killed,true);assert.equal(q.alive,true);
    await friend.wait('snapshot',s=>s.world.mimic.active&&s.world.mimic.alive===false);
  }finally{for(const ws of sockets)ws.terminate();await app.close();rmSync(dir,{recursive:true,force:true});}
});
