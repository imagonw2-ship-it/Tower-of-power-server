import {chromium as playwright} from 'playwright';
import chromium from '@sparticuz/chromium';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const output=resolve('test/results/12.5');mkdirSync(output,{recursive:true});
const browser=await playwright.launch({executablePath:process.env.CHROMIUM_PATH||resolve('../qa/browser/chromium'),headless:true,args:[...chromium.args,'--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:640},isMobile:true,hasTouch:true,deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
 await page.goto(pathToFileURL(resolve('public/index.html')).href,{waitUntil:'load'});await page.waitForFunction(()=>running&&importedTextureRevision>=7);
 await page.evaluate(()=>{window.qaTime=1000;settings.quality='medium';settings.shadows='soft';settings.vhs=.18;resolutionScale=1;resize();grassRings=[[.7,65,0,55,0]];});
 async function scene(name,seed,position){
  await page.evaluate(({seed,position})=>{resetWorld(true,seed);setMode('playing');locked=true;game.fadeIn=0;world.cycle=false;world.phase=.44;world.turbineStopped=world.powerStopped=true;Object.assign(player,position);frame(qaTime+=16);}, {seed,position});
  await page.screenshot({path:resolve(output,name+'.png')});
 }
 await scene('spawn',0,{x:128,z:-34,yaw:0,pitch:.03});
 await page.evaluate(()=>{player.x=activeLayout.nodes[2].x;player.z=activeLayout.nodes[2].z+17;player.yaw=.1;player.pitch=-.32;frame(qaTime+=16);});
 await page.screenshot({path:resolve(output,'crossroads-seed-0.png')});
 await scene('different-seed',100,{x:128,z:-34,yaw:0,pitch:.05});
 await page.evaluate(()=>{const n=activeLayout.nodes[4];player.x=n.x;player.z=n.z+17;player.yaw=-.3;player.pitch=-.25;frame(qaTime+=16);});
 await page.screenshot({path:resolve(output,'junction-seed-100.png')});
 await page.evaluate(()=>{const p=activeLayout.pylons[0],next=activeLayout.pylons[1];player.x=p.x+80;player.z=p.z+85;player.yaw=Math.atan2(-(p.x-player.x),-(p.z-player.z));player.pitch=.33;frame(qaTime+=16);});
 await page.screenshot({path:resolve(output,'connected-corridor.png')});
 await page.evaluate(()=>{const p=activeLayout.forest.entrance;player.x=p.x;player.z=p.z;player.yaw=Math.atan2(-(activeLayout.forest.x-p.x),-(activeLayout.forest.z-p.z));player.pitch=.10;frame(qaTime+=16);});
 await page.screenshot({path:resolve(output,'forest-road-and-compass.png')});
 assert.match(await page.locator('#forestDestination').textContent(),/PINE FOREST/);
 assert.match(await page.locator('#powerDestination').textContent(),/POWER CORRIDOR/);
 await page.evaluate(()=>{setMode('fieldPanel');syncFieldPanel();});await page.screenshot({path:resolve(output,'world-seed-panel.png')});
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>running),true);assert.equal(await page.evaluate(()=>gl.getError()),0);
 console.log('12.5 screenshots verified:',output);
}finally{await browser.close();}
