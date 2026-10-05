import {chromium as playwright} from 'playwright';
import chromium from '@sparticuz/chromium';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const output=resolve('test/results/13');mkdirSync(output,{recursive:true});
const browser=await playwright.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:[...chromium.args,'--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
 await page.goto(pathToFileURL(resolve('public/index.html')).href,{waitUntil:'load'});await page.waitForFunction(()=>running&&importedTextureRevision>=8);
 await page.evaluate(()=>{
  window.qaTime=1000;settings.quality='low';settings.shadows='soft';settings.vhs=.20;resolutionScale=1;resize();grassRings=[[.7,65,0,55,0]];
  resetWorld(true,0);setMode('playing');locked=true;game.fadeIn=0;world.cycle=false;world.phase=.44;world.turbineStopped=world.powerStopped=true;frame(qaTime+=16);
  openFieldPanel();for(let i=0;i<10;i++)frame(qaTime+=50);
 });
 await page.screenshot({timeout:60000,path:resolve(output,'tablet-travel-mobile.png')});
 assert.equal(await page.evaluate(()=>objectDraws.filter(o=>o.tabletArm).length),2);
 const rect=await page.locator('#fieldPanel').boundingBox();assert.ok(rect.x>0&&rect.y>=0&&rect.x+rect.width<844&&rect.y+rect.height<390);
 await page.locator('[data-tablet-tab="player"]').click();await page.locator('#godToggle').click();await page.locator('#sprintToggle').click();
 assert.ok(await page.evaluate(()=>game.godMode&&game.infiniteSprint));await page.evaluate(()=>frame(qaTime+=50));
 await page.screenshot({timeout:60000,path:resolve(output,'tablet-player-mobile.png')});
 await page.evaluate(()=>{settings.shadows='off';resolutionScale=.7;resize();});await page.locator('[data-tablet-tab="travel"]').click();await page.locator('[data-host-destination="forest"]').click();await page.evaluate(()=>frame(qaTime+=50));
 await page.locator('[data-tablet-tab="threats"]').click();await page.locator('#spawnMimic').click();assert.ok(await page.evaluate(()=>localMimic.active));
 await page.locator('#fieldBack').click();await page.evaluate(()=>{updateTablet(.4);frame(qaTime+=50);});
 assert.equal(await page.evaluate(()=>game.mode),'playing');await page.waitForFunction(()=>importedTextureRevision>=9);
 await page.evaluate(()=>{settings.shadows='off';resolutionScale=.7;resize();player.x=activeLayout.forest.x;player.z=activeLayout.forest.z;player.pitch=-.07;frame(qaTime+=16);});
 await page.screenshot({timeout:60000,path:resolve(output,'dense-forest-mobile.png')});
 await page.evaluate(()=>{
   const t=forestForLayout(activeLayout).trees.find(t=>t.radius>.38&&Math.hypot(t.x-activeLayout.forest.x,t.z-activeLayout.forest.z)<80);
   player.x=t.x;player.z=t.z+5;player.yaw=0;player.pitch=.03;frame(qaTime+=16);
   watchingEye={tree:t,x:t.x,z:t.z+t.radius+.05,y:terrainHeight(t.x,t.z)+1.9,age:0,noticed:0,width:.85,nx:0,nz:1};frame(qaTime+=16);
 });
 await page.screenshot({timeout:60000,path:resolve(output,'watching-eye.png')});assert.ok(await page.evaluate(()=>objectDraws.some(o=>o.watchingEye)));
 await page.evaluate(()=>{for(let i=0;i<60;i++)updateForestHaunts(.05);});assert.equal(await page.evaluate(()=>watchingEye),null);
 await page.evaluate(()=>{openFieldPanel();updateTablet(.4);frame(qaTime+=50);});
 await page.locator('[data-tablet-tab="world"]').click();await page.screenshot({timeout:60000,path:resolve(output,'tablet-world-mobile.png')});
 console.log(await page.evaluate(()=>({trees:forestForLayout(activeLayout).trees.length,batches:forestBatches.map(b=>({count:b.count,triangles:b.count*b.mesh.count/3})),glError:gl.getError()})));assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>gl.getError()),0);
 console.log(JSON.stringify({output,tabletScreen:rect,errors}));
}finally{await browser.close();}
