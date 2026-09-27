// Temporary original low-poly signal prop; replace via the licensed model pipeline.
let flareGunTexture,flareGunMesh,flareGlowMesh,localFlares=[],flareSerial=0,flareAudioClock=0;
let cameraDynamics={lean:0,pitch:0,speed:0,breath:0};
const flareLights=new Float32Array(8);
function flarePosition(){return[shed.x+1.8,shed.y+BENCH_TOP+.031,shed.z-.85];}
function restingFlashlightMatrix(p){return multiply(transform(...p),rotateZ(Math.PI/2));}
function buildFlareModels(){
  flareGunMesh=unpackModel(FLARE_ASSET);flareGunTexture=importedTexture(FLARE_ASSET.texture,5);
  const glow=infraGeometry();infraBox(0,0,0,.13,.13,.13,[5,1.1,.14],glow);flareGlowMesh=mesh3D(glow);
}
function fireFlare(){
  if(game.mode!=='playing'||!locked||!game.hasFlare||game.flares<=0||game.flareCooldown>0)return;
  if(net.active){net.action('flare');return;}
  game.flares--;game.flareCooldown=1.2;
  localFlares.push(spawnFlare(player,'local-flare-'+(++flareSerial)));
  flareShotSound();refreshFieldKit();
}
function flareShotSound(){sound.noise(.14,.20,800);sound.tone(470,140,.32,.10,'triangle');game.shake=Math.max(game.shake,.1);}
function activeFlares(){return net.active?(net.snapshots.at(-1)?.world.flares||[]):localFlares;}
function updateFlareSystem(dt){
  if(game.mode!=='playing')return;
  game.flareCooldown=Math.max(0,(game.flareCooldown||0)-dt);
  if(!net.active)localFlares=advanceFlares(localFlares,dt,shedFloor,shedBlocksSight);
  flareAudioClock-=dt;
  if(flareAudioClock<=0){flareAudioClock=.24;const f=activeFlares().find(f=>Math.hypot(f.x-player.x,f.z-player.z)<32);if(f)sound.noise(.27,.055/(1+Math.hypot(f.x-player.x,f.z-player.z)*.12),2300,'highpass');}
}
function appendFlareObjects(){
  flareLights.fill(0);if(isMenuScene())return;
  if(!net.active&&!game.flareTaken)objectDraws.push({mesh:flareGunMesh,model:multiply(transform(...flarePosition()),rotateZ(Math.PI/2)),material:5,assetKind:7,texture:flareGunTexture});
  const flares=activeFlares().slice().sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));
  for(let i=0;i<flares.length;i++){
    const f=flares[i],fade=Math.min(1,f.life/1.2),pulse=.87+.13*Math.sin(time*23+i);
    if(i<2)flareLights.set([f.x,f.y,f.z,fade*pulse],i*4);
    if(Math.hypot(f.x-player.x,f.z-player.z)>220)continue;
    objectDraws.push({mesh:flareGlowMesh,model:transform(f.x,f.y,f.z),material:3,castShadow:false});
    for(let j=0;j<5;j++){
      const rise=(time*.8+j*.21)%1;
      objectDraws.push({mesh:flareGlowMesh,model:transform(f.x+Math.sin(j*5+time)*rise*.2,f.y+rise*1.1,f.z+Math.cos(j*4+time)*rise*.2,.22,.22,.22),material:3,castShadow:false});
    }
  }
}
