// Bake a censored portrait of the actual uploaded hazmat, using the game renderer.
import {chromium as playwright} from 'playwright';
import chromium from '@sparticuz/chromium';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const browser=await playwright.launch({executablePath:process.env.CHROMIUM_PATH||resolve('../qa/browser/chromium'),headless:true,args:[...chromium.args,'--no-sandbox']});
try{
 const page=await browser.newPage();await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
 await page.goto(pathToFileURL(resolve('public/index.html')).href,{waitUntil:'load'});
 await page.waitForFunction(()=>running&&importedTextureRevision>=7);
 const image=await page.evaluate(()=>{
  const width=256,height=360,texture=gl.createTexture(),depth=gl.createRenderbuffer(),fb=gl.createFramebuffer();
  gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,width,height);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
  settings.shadows='off';world.day=1;world.light=[-.4,.6,.7];world.ambient=[.62,.62,.62];world.direct=[.65,.65,.65];
  game.flash=0;game.hasFlashlight=false;player.x=0;player.z=3;
  const floor=shedFloor(0,0),camera=[0,floor+1.37,3],half=.66;
  cameraPosition.set(camera);viewProjection.set(multiply(new Float32Array([1/(half*width/height),0,0,0,0,1/half,0,0,0,0,-.1,0,0,0,0,1]),viewFrom(camera,[0,0,-1])));
  objectDraws.length=0;headCensorCount=0;
  if(typeof appendSuitCard==='function')appendSuitCard=()=>{};
  appendHazmat({id:'portrait',username:'FIELD',x:0,z:0,yaw:Math.PI,vx:0,vz:0,heldItem:'none'},0);
  gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.viewport(0,0,width,height);gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.clearColor(.085,.11,.105,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);drawObjects(turbineProgram);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d'),data=ctx.createImageData(width,height),pixels=new Uint8Array(width*height*4);
  gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const to=(y*width+x)*4,from=((height-y-1)*width+x)*4;for(let k=0;k<3;k++)data.data[to+k]=Math.round(255*Math.pow(pixels[from+k]/255,1/2.2));data.data[to+3]=255;}
  ctx.putImageData(data,0,0);ctx.fillStyle='#050505';
  const r=headCensorRects;ctx.fillRect(Math.floor(r[0]*width)-2,Math.floor((1-r[3])*height)-2,Math.ceil((r[2]-r[0])*width)+4,Math.ceil((r[3]-r[1])*height)+4);
  return canvas.toDataURL('image/png');
 });
 writeFileSync('client/suit-portrait.png',Buffer.from(image.split(',')[1],'base64'));
 console.log('Baked censored hazmat portrait');
}finally{await browser.close();}
