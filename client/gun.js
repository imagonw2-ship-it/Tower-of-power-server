// Uploaded Glock: independent slide / magazine, sprung recoil and two-hand IK.
let gunParts=[],gunTexture,gunPreviewMesh;
const gunMotion={kick:0,velocity:0,side:0,aim:0,aiming:false,reload:0,reloadStage:0,flash:0,pending:null,latestAction:0};
function buildGun(){gunTexture=importedTexture(GUN_ASSET.texture,5);gunParts=GUN_ASSET.meshes.map(p=>({name:p.name,mesh:unpackModel(p)}));gunPreviewMesh=gunParts[0].mesh;}
function localInventory(){return{camera:game.hasCamera!==false,flashlight:!!game.hasFlashlight,flare:!!game.hasFlare,flares:game.flares||0,sodas:game.sodas||0,gun:!!game.hasGun,ammo:game.ammo||0,reserve:game.reserve||0,backpack:!!game.hasBackpack};}
function assignLocalInventory(i){Object.assign(game,{hasCamera:i.camera,hasFlashlight:i.flashlight,hasFlare:i.flare,flares:i.flares,sodas:i.sodas,hasGun:i.gun,ammo:i.ammo,reserve:i.reserve,hasBackpack:i.backpack});}
function localGunActor(){return{...player,id:'solo',alive:game.mode!=='lost',heldItem:equippedTool,inventory:localInventory(),gunReload:game.gunReload||0,gunCooldown:game.gunCooldown||0,inventoryOpen:game.mode==='inventory',tabletOpen:game.mode==='fieldPanel',frozen:game.frozen||0,sprinting:game.sprinting};}
function resetGun(){Object.assign(gunMotion,{kick:0,velocity:0,side:0,aim:0,aiming:false,reload:0,reloadStage:0,flash:0,pending:null,latestAction:0});Object.assign(game,{hasGun:false,ammo:0,reserve:0,gunReload:0,gunCooldown:0,hasBackpack:false});}
function gunSound(volume=1){sound.noise(.055,.50*volume,2200);sound.noise(.22,.17*volume,330,'lowpass');sound.tone(95,35,.16,.20*volume,'triangle');}
function reloadGun(){
  if(game.mode!=='playing'||!locked||equippedTool!=='gun'||gunMotion.pending||net.active&&!net.connected)return false;
  const p=localGunActor();if(!beginGunReload(p))return false;
  if(net.active){if(!net.action('reload'))return false;gunMotion.latestAction=net.actionSeq;}
  game.gunReload=GUN_RELOAD_SECONDS;gunMotion.reloadStage=0;sound.noise(.08,.09,1200);return true;
}
function fireGun(){
  if(game.mode!=='playing'||!locked||equippedTool!=='gun'||game.sprinting||equipmentMotion.lower>.12||game.gunCooldown>0||game.gunReload>0||gunMotion.pending||net.active&&!net.connected)return;
  if(game.ammo<=0){if(!reloadGun()){game.notice='MAGAZINE EMPTY';game.noticeTime=1;sound.noise(.025,.04,1800);}return;}
  if(net.active){if(!net.action('shoot',{yaw:player.yaw,pitch:player.pitch}))return;gunMotion.latestAction=net.actionSeq;gunMotion.pending={id:net.actionSeq,at:performance.now()};game.ammo--;}
  else{const p=localGunActor(),result=shootMimic(p,localMimic,activeLayout.seed);if(!result)return;assignLocalInventory(p.inventory);gunHitFeedback(result);emitNoise(180);}
  game.gunCooldown=GUN_SHOT_SECONDS;gunMotion.velocity+=9;gunMotion.side=(Math.random()-.5)*.014;gunMotion.flash=.065;gunSound();refreshFieldKit();
}
function gunHitFeedback(shot){if(shot?.killed){game.notice='MIMIC DOWN';game.noticeTime=2.3;proximityVoice.node?.port.postMessage({type:'forget',id:65537});}else if(shot?.hit){sound.noise(.06,.08,380);}}
function confirmGunAction(m){
  if(m.action==='shoot'&&gunMotion.pending?.id===m.id){gunMotion.pending=null;if(m.ok&&m.shot){game.ammo=m.shot.ammo;gunHitFeedback(m.shot);}else{gunMotion.flash=0;game.gunCooldown=0;}}
  if(m.action==='reload'&&!m.ok){game.gunReload=0;gunMotion.reload=0;}
}
function updateGun(dt){
  const playing=game.mode==='playing',holding=playing&&equippedTool==='gun';
  if(!holding){gunMotion.aiming=false;game.gunReload=0;}
  gunMotion.aim+=(Number(holding&&gunMotion.aiming&&!game.sprinting&&!game.gunReload)-gunMotion.aim)*(1-Math.exp(-12*dt));
  if(playing){
    if(!net.active){const p=localGunActor();tickGun(p,dt);assignLocalInventory(p.inventory);game.gunReload=p.gunReload;game.gunCooldown=p.gunCooldown;}
    else{game.gunCooldown=Math.max(0,(game.gunCooldown||0)-dt);game.gunReload=Math.max(0,(game.gunReload||0)-dt);}
  }
  gunMotion.velocity+=(-gunMotion.kick*135-gunMotion.velocity*19)*dt;gunMotion.kick=Math.max(0,gunMotion.kick+gunMotion.velocity*dt);gunMotion.flash=Math.max(0,gunMotion.flash-dt);
  gunMotion.reload=game.gunReload>0?1-game.gunReload/GUN_RELOAD_SECONDS:0;
  const stage=Math.floor(gunMotion.reload*4);if(stage!==gunMotion.reloadStage&&game.gunReload>0){sound.noise(.07,.07,stage===3?1800:850);gunMotion.reloadStage=stage;}
  if(gunMotion.pending&&performance.now()-gunMotion.pending.at>2500)gunMotion.pending=null;
  const hud=document.getElementById('gunReadout');hud.hidden=!holding;
  document.getElementById('gunAmmo').textContent=String(game.ammo||0).padStart(2,'0')+' / '+String(game.reserve||0).padStart(2,'0');
  document.getElementById('gunReloadLabel').textContent=game.gunReload>0?'RELOADING':game.ammo===0?'RELOAD':'R · RELOAD';
  document.getElementById('gunReload').disabled=game.gunReload>0||game.ammo>=GUN_MAGAZINE||!game.reserve;
}
function heldGunMatrix(){
  const aim=ease(gunMotion.aim),dip=ease(equipmentMotion.lower),reload=game.gunReload>0?Math.sin(Math.PI*gunMotion.reload):0,kick=gunMotion.kick;
  const sway=Math.sin(bob.phase)*bob.blend*.010-cameraDynamics.yawLag*.30;
  const x=lerp(.18,0,aim)+sway*(1-aim*.8)+reload*.025,y=lerp(-.15,-.055,aim)-dip*.45+reload*.06-(game.sprinting?.16:0),z=lerp(.48,.54,aim)-kick*.09-reload*.06;
  const p=cameraPosition.map((v,k)=>v+right[k]*x+up[k]*y+forward[k]*z);
  const base=new Float32Array([...right,0,...up,0,-forward[0],-forward[1],-forward[2],0,...p,1]);
  return multiply(base,multiply(rotateZ(-reload*.65+gunMotion.side*kick+(game.sprinting?.40:0)),rotateX(kick*.22+dip*.8-reload*.28)));
}
function appendGun(model,{reload=0,flash=0,shadow=false,ammo=game.ammo}={}){
  const magDrop=reload>0?Math.sin(clamp((reload-.10)/.70,0,1)*Math.PI)*.13:0,slide=flash>0?.031*Math.sin(clamp(flash/.065,0,1)*Math.PI):ammo===0&&reload===0?.028:0;
  for(const part of gunParts){const offset=part.name==='slide'?transform(0,0,slide):part.name==='magazine'?transform(-magDrop*.15,-magDrop,magDrop*.2):identity();objectDraws.push({mesh:part.mesh,model:multiply(model,offset),texture:gunTexture,material:5,assetKind:6,castShadow:shadow,receiveTorch:shadow,gunPart:part.name});}
  if(flash>0){const p=[0,1,2].map(k=>model[12+k]+model[4+k]*.034-model[8+k]*.178);objectDraws.push({mesh:flareGlowMesh,model:flareBillboard(...p,.045+flash*.65),material:6,flareSprite:true,castShadow:false});}
}
function appendHeldGun(){
  const model=heldGunMatrix(),reload=gunMotion.reload;
  appendPovArm(model,'gun');
  // Support hand leaves the grip, follows the magazine out, then seats it again.
  const reach=game.gunReload>0?Math.sin(clamp((reload-.06)/.78,0,1)*Math.PI):0;
  appendLeftPovArm(multiply(model,multiply(transform(-.025-reach*.02,-.01-reach*.10,.012+reach*.045),rotateZ(-.12))),'gun');
  appendGun(model,{reload,flash:gunMotion.flash});
}
function toggleGunAim(){if(game.mode!=='playing'||equippedTool!=='gun')return;gunMotion.aiming=!gunMotion.aiming;game.zoom=game.zoomTarget=1;}
document.getElementById('gunReload').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();reloadGun();});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('mousedown',e=>{if(e.button===0&&equippedTool==='gun')fireGun();if(e.button===2&&equippedTool==='gun')toggleGunAim();});
