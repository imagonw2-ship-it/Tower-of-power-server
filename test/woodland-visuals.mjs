import {chromium as playwright} from 'playwright';
import chromium from '@sparticuz/chromium';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const output=resolve('test/results/13');mkdirSync(output,{recursive:true});
const browser=await playwright.launch({executablePath:process.env.CHROMIUM_PATH||resolve('../qa/browser/chromium'),headless:true,args:[...chromium.args,'--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:640},isMobile:true,hasTouch:true,deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
 await page.goto(pathToFileURL(resolve('public/index.html')).href,{waitUntil:'load'});await page.waitForFunction(()=>running&&importedTextureRevision>=7);
 await page.evaluate(()=>{
  window.qaTime=1000;settings.quality='low';settings.shadows='soft';settings.vhs=.18;resolutionScale=1;resize();grassRings=[[.7,65,0,55,0]];
  resetWorld(true,0);setMode('playing');locked=true;game.fadeIn=0;world.cycle=false;world.phase=.44;world.turbineStopped=world.powerStopped=true;
  const l=forestForLayout(activeLayout).logs[0],dx=l.b.x-l.a.x,dz=l.b.z-l.a.z,length=Math.hypot(dx,dz),x=(l.a.x+l.b.x)/2,z=(l.a.z+l.b.z)/2;
  player.x=x+dz/length*5;player.z=z-dx/length*5;player.yaw=Math.atan2(-(x-player.x),-(z-player.z));player.pitch=-.22;frame(qaTime+=16);
 });
 await page.waitForFunction(()=>importedTextureRevision>=8);await page.evaluate(()=>frame(qaTime+=16));
 assert.ok(await page.evaluate(()=>objectDraws.some(o=>o.fallenLog)));
 await page.screenshot({path:resolve(output,'fallen-log.png')});
 const shade=await page.evaluate(()=>{
  const a=new Uint8Array(canvas.width*canvas.height*4),b=new Uint8Array(a.length),pixels=canopyMap.pixels;
  frame(qaTime);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,a);
  gl.activeTexture(gl.TEXTURE0+11);gl.bindTexture(gl.TEXTURE_2D,canopyTexture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,canopyMap.size,canopyMap.size,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(pixels.length));
  frame(qaTime);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,b);
  gl.activeTexture(gl.TEXTURE0+11);gl.bindTexture(gl.TEXTURE_2D,canopyTexture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,canopyMap.size,canopyMap.size,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let delta=0;for(let i=0;i<a.length;i+=4)delta+=b[i]+b[i+1]+b[i+2]-a[i]-a[i+1]-a[i+2];return delta/(a.length/4);
 });
 assert.ok(shade>1,'tree canopies must visibly darken the forest');
 await page.evaluate(()=>{
  const t=activeLayout.trails.find(t=>Math.hypot(t.a.x-activeLayout.forest.x,t.a.z-activeLayout.forest.z)<activeLayout.forest.radius-30&&nearestRoad((t.a.x+t.b.x)/2,(t.a.z+t.b.z)/2,activeLayout).distance>12);
  if(t){const dx=t.b.x-t.a.x,dz=t.b.z-t.a.z,len=Math.hypot(dx,dz);player.x=t.a.x+dx*.3+dz/len*2;player.z=t.a.z+dz*.3-dx/len*2;player.yaw=Math.atan2(-dx,-dz);player.pitch=-.27;}else throw Error('No forest trail');
  frame(qaTime+=16);
 });
 await page.screenshot({path:resolve(output,'dirt-trail.png')});
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>gl.getError()),0);
 console.log(JSON.stringify({release:'13',canopyPixelDarkening:shade,output}));
}finally{await browser.close();}
