import {chromium as playwright} from 'playwright';
import chromium from '@sparticuz/chromium';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const output=resolve('test/results/12.5.1');mkdirSync(output,{recursive:true});
const browser=await playwright.launch({executablePath:process.env.CHROMIUM_PATH||resolve('../qa/browser/chromium'),headless:true,args:[...chromium.args,'--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:640},isMobile:true,hasTouch:true,deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
 await page.goto(pathToFileURL(resolve('public/index.html')).href,{waitUntil:'load'});await page.waitForFunction(()=>running&&importedTextureRevision>=7);
 await page.evaluate(()=>{window.qaTime=1000;settings.quality='medium';settings.shadows='soft';settings.vhs=.18;resolutionScale=1;resize();grassRings=[[.7,65,0,55,0]];resetWorld(true,0);setMode('playing');locked=true;game.fadeIn=0;world.cycle=false;world.phase=.44;world.turbineStopped=world.powerStopped=true;frame(qaTime+=16);});
 await page.screenshot({path:resolve(output,'spawn.png')});
 await page.evaluate(()=>{const p=activeLayout.forest.entrance;player.x=p.x;player.z=p.z;player.yaw=Math.atan2(-(activeLayout.forest.x-p.x),-(activeLayout.forest.z-p.z));player.pitch=.1;frame(qaTime+=16);});
 await page.waitForFunction(()=>importedTextureRevision>=8);await page.evaluate(()=>frame(qaTime+=16));
 await page.screenshot({path:resolve(output,'forest-entrance.png')});
 await page.evaluate(()=>{player.x=activeLayout.forest.x+10;player.z=activeLayout.forest.z+20;player.yaw=1.4;player.pitch=.13;frame(qaTime+=16);});
 await page.screenshot({path:resolve(output,'forest-interior.png')});
 console.log('Forest budget',await page.evaluate(()=>({trees:forestForLayout(activeLayout).trees.length,batches:forestBatches.length,triangles:forestBatches.reduce((n,b)=>n+b.count*b.mesh.count/3,0)})));
 await page.evaluate(()=>{player.x=128;player.z=-34;player.yaw=0;player.pitch=-.2;settings.vhs=1;window.qaAvatar={id:'qa-badge',username:'Guest_067823',x:128,z:-35,yaw:Math.PI,pitch:0,alive:true,heldItem:'none',vx:0,vz:0};window.qaAppend=appendNetworkObjects;appendNetworkObjects=()=>{qaAppend();appendHazmat(qaAvatar,time);};frame(qaTime+=16);});
 await page.waitForFunction(()=>suitPortraitReady);await page.evaluate(()=>frame(qaTime+=16));
 assert.equal(await page.evaluate(()=>suitCardDraws.length),1);
 await page.screenshot({path:resolve(output,'clear-suit-id.png')});
 await page.evaluate(()=>{qaAvatar.crouching=true;qaAvatar.yaw=Math.PI+.5;qaAvatar.z=player.z-1.5;player.pitch=-.42;avatarCache.clear();frame(qaTime+=16);});
 assert.equal(await page.evaluate(()=>suitCardDraws.length),1);
 await page.screenshot({path:resolve(output,'crouched-suit-id.png')});
 const occluded=await page.evaluate(()=>{
  qaAvatar.crouching=false;qaAvatar.yaw=Math.PI;avatarCache.clear();const g=infraGeometry();infraBox(0,0,0,3,3,.10,[.03,.03,.03],g);const mesh=mesh3D(g),previous=appendNetworkObjects;
  appendNetworkObjects=()=>{previous();objectDraws.push({mesh,model:transform(player.x,cameraPosition[1],player.z-.5),material:0,castShadow:false});};frame(qaTime+=16);
  drawPost(0);const a=new Uint8Array(canvas.width*canvas.height*4),b=new Uint8Array(a.length);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,a);
  suitCardDraws.length=0;drawPost(0);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,b);appendNetworkObjects=previous;
  return a.every((v,i)=>v===b[i]);
 });
 assert.equal(occluded,true,'ID text must not appear through a wall');
 await page.evaluate(()=>{qaAvatar.yaw=0;avatarCache.clear();frame(qaTime+=16);});assert.equal(await page.evaluate(()=>suitCardDraws.length),0);
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>running),true);assert.equal(await page.evaluate(()=>gl.getError()),0);
 console.log('12.5.1 WebGL visuals, card visibility and wall occlusion verified:',output);
}finally{await browser.close();}
