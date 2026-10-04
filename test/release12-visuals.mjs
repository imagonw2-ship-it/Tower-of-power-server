import {chromium as playwright} from 'playwright';
import chromium from '@sparticuz/chromium';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const output=resolve('test/results/12.0');mkdirSync(output,{recursive:true});
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
 await scene('normal',0,{x:128,z:-34,yaw:0,pitch:.03});
 await scene('crossroads',1,{x:111,z:-151,yaw:.1,pitch:-.30});
 await scene('twins',2,{x:216,z:-40,yaw:0,pitch:.21});
 await page.evaluate(()=>{player.x=turbine.x;player.z=turbine.z+8;player.pitch=1.25;player.yaw=0;Object.assign(enemy,{state:'running',awake:9,lift:38,heading:0,crouch:0});turbine.y=terrainHeight(turbine.x,turbine.z)+38;enemy.feet=[0,1,2].map(i=>{const a=i*Math.PI*2/3,x=turbine.x+Math.sin(a)*53,z=turbine.z+Math.cos(a)*53;return{position:[x,terrainHeight(x,z),z],progress:1};});frame(qaTime+=16);});
 await page.screenshot({path:resolve(output,'underside.png')});
 await scene('forest-edge',0,{x:764,z:-590,yaw:0,pitch:.13});
 await scene('forest-interior',0,{x:754,z:-763,yaw:-.2,pitch:.03});
 await scene('identity',0,{x:128,z:-30.5,yaw:0,pitch:-.2});
 await page.evaluate(()=>{window.qaActor={id:'card-test',username:'FIELDWALKER',x:128,z:-32,yaw:Math.PI,vx:0,vz:0,heldItem:'none'};appendNetworkObjects=()=>appendHazmat(qaActor,qaTime/1000);frame(qaTime+=16);});
 await page.waitForFunction(()=>suitPortraitReady);await page.evaluate(()=>frame(qaTime+=16));
 await page.screenshot({path:resolve(output,'suit-card.png')});
 await page.evaluate(()=>{qaActor.crouching=true;player.pitch=-.46;for(let i=0;i<20;i++)frame(qaTime+=50);});
 await page.screenshot({path:resolve(output,'suit-card-crouch.png')});
 assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>running),true);assert.equal(await page.evaluate(()=>gl.getError()),0);
 console.log('12.0 screenshots verified:',output);
}finally{await browser.close();}
