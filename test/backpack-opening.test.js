import test from 'node:test';
import assert from 'node:assert/strict';
import {launch} from './game-harness.js';
import {makePlayer} from '../server/players.js';
import {beginPackTransfer,tickPackTransfer,PACK_TRANSFER_SECONDS} from '../shared/prop-motion.js';

const buffers=new Map(),bound=new Map();let serial=0;
const {run,context}=launch(true,{createBuffer:()=>({id:++serial}),bindBuffer:(target,buffer)=>bound.set(target,buffer)});
context.captureBuffer=(target,data)=>{if(ArrayBuffer.isView(data))buffers.set(bound.get(target)?.id,Array.from(data));};
run('const uploadPackBuffer=gl.bufferData;gl.bufferData=(...args)=>{uploadPackBuffer(...args);captureBuffer(args[0],args[1]);};buildBackpack();');
const point=(m,p)=>[0,1,2].map(k=>m[12+k]+m[k]*p[0]+m[4+k]*p[1]+m[8+k]*p[2]);

test('zipper lid clears the mouth; lining is recessed inside the shell',()=>{
 run("resetWorld(true,0);setMode('playing');locked=true;game.hasBackpack=true;openFieldKit();for(let i=0;i<90;i++)updateBackpack(1/60);objectDraws.length=0;appendBackpackModel(identity(),1);");
 const lid=run("Array.from(objectDraws.find(o=>o.backpackPart==='top').model)");
 const lip=point(lid,[0,.398,.1]);assert.ok(lip[1]>.56);assert.ok(lip[2]<-.03);
 assert.ok(run("objectDraws.find(o=>o.backpackPart==='lidLining').model===objectDraws.find(o=>o.backpackPart==='top').model"));
 const data=buffers.get(run('backpack.interior.buffer.id'));
 const positions=Array.from({length:data.length/11},(_,i)=>data.slice(i*11,i*11+3));
 assert.ok(Math.max(...positions.map(p=>p[1]))<=.399);
 assert.ok(Math.min(...positions.map(p=>p[1]))<.21);
 assert.ok(positions.every(p=>Math.abs(p[0])<.15&&p[2]<.106&&p[2]>-.085));
 assert.ok(run("objectDraws.every(o=>o.assetKind!==11)&&!('screen' in BACKPACK_ASSET)"));
 run('objectDraws.length=0;appendBackpackModel(identity(),0);');
 assert.ok(run("objectDraws.every(o=>o.backpackPart==='body'||o.backpackPart==='top')"));
 assert.deepEqual(Array.from(run('objectDraws[0].model')),Array.from(run('objectDraws[1].model')));
});

test('local and authoritative transfer finish within 0.8 seconds without an early item swap',()=>{
 assert.ok(PACK_TRANSFER_SECONDS<=.8);
 const p=makePlayer({id:'player'},0);p.inventory.backpack=p.inventory.gun=true;p.inventoryOpen=true;
 assert.equal(beginPackTransfer(p,'gun'),true);p.packCloseRequested=true;
 tickPackTransfer(p,.75);assert.equal(p.heldItem,'camera');assert.equal(p.inventoryOpen,true);
 tickPackTransfer(p,.05);assert.equal(p.heldItem,'gun');assert.equal(p.inventoryOpen,false);
 run("resetWorld(true,0);setMode('playing');locked=true;game.hasBackpack=game.hasGun=true;openFieldKit();for(let i=0;i<45;i++)updateBackpack(1/60);equipTool('gun');updateBackpack(.75);");
 assert.equal(run('equippedTool'),'camera');assert.equal(run('backpack.action.to'),'gun');
 run('closeFieldKit();updateBackpack(.05);');assert.equal(run('equippedTool'),'gun');assert.equal(run('backpack.closing'),true);
});
