// On-demand real WebGL screenshots for the mobile equipment regression checks.
import {chromium as playwright} from 'playwright';
import chromium from '@sparticuz/chromium';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const output=resolve(process.env.VISUAL_OUTPUT||'test/results/items');mkdirSync(output,{recursive:true});
const browser=await playwright.launch({executablePath:resolve('../qa/browser/chromium'),headless:true,args:[...chromium.args,'--no-sandbox']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:640},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
 await page.goto(pathToFileURL(resolve('public/index.html')).href,{waitUntil:'load'});
 await page.evaluate(()=>{
  resetWorld(true);setMode('playing');locked=true;game.fadeIn=0;
  world.cycle=false;world.phase=.44;world.turbineStopped=true;world.powerStopped=true;
  settings.vhs=.3;settings.shadows='off';settings.bloom=true;resolutionScale=1;resize();
  grassRings=[[.55,50,0,35,0]];
  player.x=119;player.z=-42;player.yaw=0;player.pitch=-.04;
  game.hasFlashlight=true;kitPreviousFlashlight=true;game.hasFlare=true;game.flares=3;game.sodas=1;
  game.sodaTaken=game.flashlightTaken=game.flareTaken=true;window.qaTime=1000;
 });
 for(const kind of ['soda','flare','camera','flashlight']){
  await page.evaluate(kind=>{equippedTool=kind;Object.assign(equipmentMotion,createToolMotion(kind));frame(qaTime+=16);},kind);
  await page.screenshot({path:resolve(output,kind+'.png')});
 }
 await page.evaluate(()=>{openFieldKit();frame(qaTime+=16);});
 await page.screenshot({path:resolve(output,'inventory.png')});
 const drop=await page.locator('#kitDrop').boundingBox(),hand=await page.locator('.kitHand').boundingBox();
 assert.ok(drop.x>=hand.x&&drop.x+drop.width<=hand.x+hand.width,'Drop must fit its hand panel');
 for(const size of [{width:844,height:390},{width:736,height:360}]){
  await page.setViewportSize(size);await page.evaluate(()=>{resize();frame(qaTime+=16);});
  const d=await page.locator('#kitDrop').boundingBox(),h=await page.locator('.kitHand').boundingBox();
  assert.ok(d.x>=h.x&&d.x+d.width<=h.x+h.width&&d.y+d.height<=h.y+h.height);
 }
 await page.screenshot({path:resolve(output,'inventory-phone.png')});
 await page.evaluate(()=>{game.hasFlashlight=false;game.hasFlare=false;game.sodas=0;equippedTool='camera';refreshFieldKit();});
 assert.equal(await page.locator('.kitCard:visible').count(),1);
 assert.equal(await page.locator('.kitEmpty:visible').count(),8);
 await page.screenshot({path:resolve(output,'inventory-uncollected.png')});
 await page.setViewportSize({width:1280,height:640});
 await page.evaluate(()=>{closeFieldKit();resize();game.hasFlare=true;game.flares=3;equippedTool='flare';Object.assign(equipmentMotion,createToolMotion('flare'));frame(qaTime+=16);fireFlare();frame(qaTime+=1);});
 await page.screenshot({path:resolve(output,'flare-launch.png')});
 await page.evaluate(()=>{for(let i=0;i<6;i++)frame(qaTime+=50);});
 await page.screenshot({path:resolve(output,'flare-flight.png')});
 await page.evaluate(()=>{
  flareTrails.clear();muzzleFlash=0;const f=localFlares[0];f.x=player.x;f.z=player.z-180;f.y=terrainHeight(f.x,f.z)+2;f.landed=true;f.vx=f.vy=f.vz=0;f.life=8;frame(qaTime+=16);
 });
 await page.screenshot({path:resolve(output,'flare-distant-day.png')});
 await page.evaluate(()=>{world.phase=.9;frame(qaTime+=16);});
 await page.screenshot({path:resolve(output,'flare-distant-night.png')});
 await page.evaluate(()=>{world.phase=.44;localFlares.length=0;dropEquipment();time+=1;player.pitch=-.65;frame(qaTime+=16);});
 await page.screenshot({path:resolve(output,'dropped-flare.png')});
 assert.equal(await page.evaluate(()=>running),true);assert.deepEqual(errors,[]);
 console.log('Equipment screenshots:',output);
}finally{await browser.close();}
