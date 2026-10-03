// Uploaded signal launcher, with soft circular emissive flare particles.
let flareGunTexture,flareGunMesh,flareGlowMesh,localFlares=[],flareSerial=0,flareAudioClock=0;
let cameraDynamics={lean:0,pitch:0,speed:0,breath:0};
let predictedFlare=null,muzzleFlash=0;
const flareTrails=new Map();
const flareLights=new Float32Array(8);
function flarePosition(){return[shed.x+1.8,shed.y+BENCH_TOP+.031,shed.z-.85];}
function restingFlashlightMatrix(p){return multiply(transform(...p),rotateZ(Math.PI/2));}
function buildFlareModels(){
  flareGunMesh=unpackModel(FLARE_ASSET);flareGunTexture=importedTexture(FLARE_ASSET.texture,5);
  const glow=infraGeometry();infraFace(glow,[[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0]],[1,1,1],[[0,0],[1,0],[1,1],[0,1]]);flareGlowMesh=mesh3D(glow);
}
function fireFlare(){
  if(game.mode!=='playing'||!locked||!game.hasFlare||game.flares<=0||game.flareCooldown>0)return;
  if(net.active&&!net.connected)return;
  const f=spawnFlare({...player,id:net.player?.id},'local-flare-'+(++flareSerial),shedBlocksSight),m=heldEquipmentMatrix('flare');
  const muzzle=[0,.024,-.274],at=[0,1,2].map(k=>m[k]*muzzle[0]+m[4+k]*muzzle[1]+m[8+k]*muzzle[2]+m[12+k]);
  if(!shedBlocksSight([player.x,player.y,player.z],at))[f.x,f.y,f.z]=at;
  if(net.active){if(!net.action('flare'))return;predictedFlare={...f,requestId:net.actionSeq};}
  else{game.flares--;localFlares.push(f);}
  game.flareCooldown=1.2;muzzleFlash=.11;
  flareShotSound();refreshFieldKit();
}
function confirmFlareShot(result){
  if(predictedFlare?.requestId===result.id){
    if(!result.ok){flareTrails.delete(predictedFlare.id);predictedFlare=null;muzzleFlash=0;return;}
    if(result.flare){const trail=flareTrails.get(predictedFlare.id);flareTrails.delete(predictedFlare.id);predictedFlare.id=result.flare.id;if(trail)flareTrails.set(predictedFlare.id,trail);}
  }
}
function flareShotSound(){sound.noise(.14,.20,800);sound.tone(470,140,.32,.10,'triangle');game.shake=Math.max(game.shake,.1);}
function activeFlares(){
  if(!net.active)return localFlares;
  const snapshot=net.snapshots.at(-1),extra=Math.min(.15,Math.max(0,(performance.now()-(snapshot?.received??performance.now()))/1000));
  const list=(snapshot?.world.flares||[]).map(f=>({...f,x:f.x+(f.landed?0:f.vx*extra),y:f.y+(f.landed?0:f.vy*extra-3.5*extra*extra),z:f.z+(f.landed?0:f.vz*extra),life:Math.max(0,f.life-extra)}));
  if(predictedFlare){if(list.some(f=>f.id===predictedFlare.id)||predictedFlare.age>1.5)predictedFlare=null;else list.push(predictedFlare);}
  return list;
}
function flareBillboard(x,y,z,size){return new Float32Array([right[0]*size,right[1]*size,right[2]*size,0,up[0]*size,up[1]*size,up[2]*size,0,-forward[0],-forward[1],-forward[2],0,x,y,z,1]);}
function updateFlareSystem(dt){
  if(game.mode!=='playing')return;
  game.flareCooldown=Math.max(0,(game.flareCooldown||0)-dt);
  muzzleFlash=Math.max(0,muzzleFlash-dt);
  if(predictedFlare)advanceFlares([predictedFlare],dt,shedFloor,shedBlocksSight);
  if(!net.active)localFlares=advanceFlares(localFlares,dt,shedFloor,shedBlocksSight);
  flareAudioClock-=dt;
  if(flareAudioClock<=0){flareAudioClock=.24;const f=activeFlares().find(f=>Math.hypot(f.x-player.x,f.z-player.z)<32);if(f)sound.noise(.27,.055/(1+Math.hypot(f.x-player.x,f.z-player.z)*.12),2300,'highpass');}
}
function appendFlareObjects(){
  flareLights.fill(0);if(isMenuScene())return;
  if(!net.active&&!game.flareTaken)objectDraws.push({mesh:flareGunMesh,model:multiply(transform(...flarePosition()),rotateZ(Math.PI/2)),material:5,assetKind:7,texture:flareGunTexture});
  const flares=activeFlares().slice().sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));
  const ids=new Set(flares.map(f=>f.id));for(const id of flareTrails.keys())if(!ids.has(id))flareTrails.delete(id);
  if(muzzleFlash>0){const m=heldEquipmentMatrix('flare'),p=[0,1,2].map(k=>m[4+k]*.024-m[8+k]*.274+m[12+k]);objectDraws.push({mesh:flareGlowMesh,model:flareBillboard(...p,.13*muzzleFlash/.11),material:6,flareSprite:true,castShadow:false});}
  for(let i=0;i<Math.min(8,flares.length);i++){
    const f=flares[i],fade=Math.min(1,f.life/1.2),pulse=.87+.13*Math.sin(time*23+i);
    if(i<2)flareLights.set([f.x,f.y,f.z,fade*pulse],i*4);
    const distance=Math.hypot(f.x-cameraPosition[0],f.y-cameraPosition[1],f.z-cameraPosition[2]);if(distance>650)continue;
    const glowSize=Math.max(.38,distance*cameraTan*14/canvas.height)*fade;
    objectDraws.push({mesh:flareGlowMesh,model:flareBillboard(f.x,f.y+.08,f.z,glowSize),material:6,flareSprite:true,castShadow:false});
    let trail=flareTrails.get(f.id);if(!trail){trail=[];flareTrails.set(f.id,trail);}
    if(!f.landed&&(!trail.length||time-trail.at(-1).t>.035)){trail.push({x:f.x,y:f.y,z:f.z,t:time});if(trail.length>14)trail.shift();}
    while(trail.length&&time-trail[0].t>.5)trail.shift();
    if(i<4)for(let j=0;j<trail.length;j+=2){const p=trail[j],alpha=Math.max(0,1-(time-p.t)/.5);objectDraws.push({mesh:flareGlowMesh,model:flareBillboard(p.x,p.y,p.z,.16*alpha*fade),material:6,flareSprite:true,castShadow:false});}
    for(let j=0;j<(f.landed?4:2);j++){
      const rise=(time*.8+j*.21)%1;
      objectDraws.push({mesh:flareGlowMesh,model:flareBillboard(f.x+Math.sin(j*5+time)*rise*.35,f.y+rise*2.4,f.z+Math.cos(j*4+time)*rise*.35,Math.max(.08,glowSize*.24)*(1-rise*.75)*fade),material:6,flareSprite:true,castShadow:false});
    }
  }
}
