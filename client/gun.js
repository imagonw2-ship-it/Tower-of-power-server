// Uploaded Glock: independent slide / magazine, sprung recoil and two-hand IK.
let gunParts=[],gunTexture,gunPreviewMesh;
function createGunMotion(){return{kick:0,side:0,aim:0,aiming:false,sprint:0,swayX:0,swayY:0,lagPitch:0,reload:0,reloadStage:0,reloadTilt:0,magDrop:0,supportReach:0,slide:0,flash:0,pending:null,latestAction:0,lastSnapshot:-1,velocities:{}};}
const gunMotion=createGunMotion();
// Exact critically damped springs stay consistent at phone and desktop frame rates.
function dampGunValue(key,target,frequency,dt,state=gunMotion){
  const x=(state[key]||0)-target,v=state.velocities[key]||0,c=v+frequency*x,e=Math.exp(-frequency*dt);
  state[key]=target+(x+c*dt)*e;state.velocities[key]=(v-frequency*c*dt)*e;
}
function gunPhase(a,b,t){const x=clamp((t-a)/(b-a),0,1);return x*x*x*(x*(x*6-15)+10);}
function gunReloadPose(t){return{tilt:gunPhase(0,.21,t)*(1-gunPhase(.73,1,t)),magDrop:.17*gunPhase(.22,.39,t)*(1-gunPhase(.55,.75,t)),reach:gunPhase(.10,.25,t)*(1-gunPhase(.79,.98,t))};}
function syncGunInventory(p,received,now=performance.now()){
  if(p.actionSeq<(gunMotion.latestAction||0))return;
  game.ammo=p.inventory.ammo||0;game.reserve=p.inventory.reserve||0;
  // A snapshot is reused for several render frames. Never restart its timer each frame.
  if(received===gunMotion.lastSnapshot)return;
  gunMotion.lastSnapshot=received;game.gunReload=Math.max(0,(p.gunReload||0)-Math.max(0,(now-received)/1000));
}
function buildGun(){gunTexture=importedTexture(GUN_ASSET.texture,5);gunParts=GUN_ASSET.meshes.map(p=>({name:p.name,mesh:unpackModel(p)}));gunPreviewMesh=gunParts[0].mesh;}
function localInventory(){return{camera:game.hasCamera!==false,flashlight:!!game.hasFlashlight,flare:!!game.hasFlare,flares:game.flares||0,sodas:game.sodas||0,gun:!!game.hasGun,ammo:game.ammo||0,reserve:game.reserve||0,backpack:!!game.hasBackpack};}
function assignLocalInventory(i){Object.assign(game,{hasCamera:i.camera,hasFlashlight:i.flashlight,hasFlare:i.flare,flares:i.flares,sodas:i.sodas,hasGun:i.gun,ammo:i.ammo,reserve:i.reserve,hasBackpack:i.backpack});}
function localGunActor(){return{...player,id:'solo',alive:game.mode!=='lost',heldItem:equippedTool,inventory:localInventory(),gunReload:game.gunReload||0,gunCooldown:game.gunCooldown||0,inventoryOpen:game.mode==='inventory',tabletOpen:game.mode==='fieldPanel',frozen:game.frozen||0,sprinting:game.sprinting};}
function resetGun(){Object.assign(gunMotion,createGunMotion());Object.assign(game,{hasGun:false,ammo:0,reserve:0,gunReload:0,gunCooldown:0,hasBackpack:false});}
function gunSound(volume=1){sound.noise(.055,.50*volume,2200);sound.noise(.22,.17*volume,330,'lowpass');sound.tone(95,35,.16,.20*volume,'triangle');}
function reloadGun(){
  if(game.mode!=='playing'||!locked||equippedTool!=='gun'||gunMotion.pending||net.active&&!net.connected)return false;
  const p=localGunActor();if(!beginGunReload(p))return false;
  if(net.active){if(!net.action('reload'))return false;gunMotion.latestAction=net.actionSeq;}
  game.gunReload=GUN_RELOAD_SECONDS;gunMotion.reload=0;gunMotion.reloadStage=0;sound.noise(.08,.09,1200);return true;
}
function fireGun(){
  if(game.mode!=='playing'||!locked||equippedTool!=='gun'||game.sprinting||equipmentMotion.lower>.12||game.gunCooldown>0||game.gunReload>0||gunMotion.pending||net.active&&!net.connected)return;
  if(game.ammo<=0){if(!reloadGun()){game.notice='MAGAZINE EMPTY';game.noticeTime=1;sound.noise(.025,.04,1800);}return;}
  if(net.active){if(!net.action('shoot',{yaw:player.yaw,pitch:player.pitch}))return;gunMotion.latestAction=net.actionSeq;gunMotion.pending={id:net.actionSeq,at:performance.now()};game.ammo--;}
  else{const p=localGunActor(),result=shootMimic(p,localMimic,activeLayout.seed);if(!result)return;assignLocalInventory(p.inventory);gunHitFeedback(result);emitNoise(180);}
  game.gunCooldown=GUN_SHOT_SECONDS;gunMotion.velocities.kick=(gunMotion.velocities.kick||0)+9;gunMotion.side=(Math.random()-.5)*.025;gunMotion.flash=.065;gunSound();refreshFieldKit();
}
function gunHitFeedback(shot){if(shot?.killed){game.notice='MIMIC DOWN';game.noticeTime=2.3;proximityVoice.node?.port.postMessage({type:'forget',id:65537});}else if(shot?.hit){sound.noise(.06,.08,380);}}
function confirmGunAction(m){
  if(m.action==='shoot'&&gunMotion.pending?.id===m.id){gunMotion.pending=null;if(m.ok&&m.shot){game.ammo=m.shot.ammo;gunHitFeedback(m.shot);}else{gunMotion.flash=0;game.gunCooldown=0;}}
  if(m.action==='reload'&&!m.ok){game.gunReload=0;gunMotion.reload=0;}
}
function updateGun(dt){
  const playing=game.mode==='playing',holding=playing&&equippedTool==='gun';
  if(!holding){gunMotion.aiming=false;game.gunReload=0;}
  dampGunValue('aim',Number(holding&&gunMotion.aiming&&!game.sprinting&&!game.gunReload),22,dt);
  dampGunValue('sprint',Number(holding&&game.sprinting),16,dt);
  const motion=reducedMotion?0:1;
  dampGunValue('swayX',motion*(Math.sin(bob.phase)*bob.blend*.006-cameraDynamics.yawLag*.22),18,dt);
  dampGunValue('swayY',motion*(Math.cos(bob.phase*2)*bob.blend*.003-cameraDynamics.pitchLag*.10),18,dt);
  dampGunValue('lagPitch',motion*cameraDynamics.pitchLag*.25,18,dt);
  if(playing){
    if(!net.active){const p=localGunActor();tickGun(p,dt);assignLocalInventory(p.inventory);game.gunReload=p.gunReload;game.gunCooldown=p.gunCooldown;}
    else{game.gunCooldown=Math.max(0,(game.gunCooldown||0)-dt);game.gunReload=Math.max(0,(game.gunReload||0)-dt);}
  }
  dampGunValue('kick',0,17,dt);gunMotion.flash=Math.max(0,gunMotion.flash-dt);
  // Visual progress cannot run backwards when an authoritative timer is corrected.
  gunMotion.reload=game.gunReload>0?Math.min(1,Math.max(gunMotion.reload+dt/GUN_RELOAD_SECONDS,1-game.gunReload/GUN_RELOAD_SECONDS)):0;
  const pose=gunReloadPose(gunMotion.reload);
  dampGunValue('reloadTilt',pose.tilt,25,dt);dampGunValue('magDrop',pose.magDrop,32,dt);dampGunValue('supportReach',pose.reach,28,dt);
  const slide=gunMotion.flash>0?.031*Math.sin(gunMotion.flash/.065*Math.PI):game.ammo===0&&(!game.gunReload||gunMotion.reload<.81)?.028:0;
  dampGunValue('slide',slide,90,dt);
  const stage=Math.floor(gunMotion.reload*4);if(stage!==gunMotion.reloadStage&&game.gunReload>0){sound.noise(.07,.07,stage===3?1800:850);gunMotion.reloadStage=stage;}
  if(gunMotion.pending&&performance.now()-gunMotion.pending.at>2500)gunMotion.pending=null;
  const hud=document.getElementById('gunReadout');hud.hidden=!holding;
  const aimButton=document.getElementById('touchGunAim');aimButton.hidden=!holding;aimButton.classList.toggle('latched',gunMotion.aiming);aimButton.setAttribute('aria-pressed',String(gunMotion.aiming));aimButton.setAttribute('aria-label',gunMotion.aiming?'Lower sights':'Aim down sights');document.getElementById('touchAim').hidden=holding;
  document.getElementById('gunAmmo').textContent=String(game.ammo||0).padStart(2,'0')+' / '+String(game.reserve||0).padStart(2,'0');
  document.getElementById('gunReloadLabel').textContent=game.gunReload>0?'RELOADING':game.ammo===0?'RELOAD':'R · RELOAD';
  document.getElementById('gunReload').disabled=game.gunReload>0||game.ammo>=GUN_MAGAZINE||!game.reserve;
}
function heldGunMatrix(){
  const aim=clamp(gunMotion.aim,0,1),dip=ease(equipmentMotion.lower),reload=gunMotion.reloadTilt,kick=gunMotion.kick,sprint=gunMotion.sprint;
  const x=gunMotion.swayX*(1-aim*.95)+reload*.025,y=lerp(-.125,-.05491,aim)-dip*.45+reload*.025-sprint*.13+gunMotion.swayY*(1-aim*.95),z=lerp(.49,.51,aim)-kick*.09-reload*.022-sprint*.025;
  const p=cameraPosition.map((v,k)=>v+right[k]*x+up[k]*y+forward[k]*z);
  // Sight tops are 54.91 mm above the model origin. Converge on the actual
  // gameplay aim ray so body-camera lag does not pull the sights away from hits.
  const cp=Math.cos(player.pitch),target=[player.x-Math.sin(player.yaw)*cp*35,player.y+Math.sin(player.pitch)*35,player.z-Math.cos(player.yaw)*cp*35];
  const sight=cameraPosition.map((v,k)=>v+forward[k]*z),aimDir=norm(target.map((v,k)=>v-sight[k]));
  const f=norm(Array.from(forward,(v,k)=>lerp(v,aimDir[k],aim))),r=norm(cross(f,up)),u=cross(r,f);
  // Rotate about the sight line rather than moving it when aligning to the ray.
  if(aim>0)for(let k=0;k<3;k++)p[k]+=(up[k]-u[k])*.05491*aim;
  const base=new Float32Array([...r,0,...u,0,-f[0],-f[1],-f[2],0,...p,1]);
  return multiply(base,multiply(rotateZ(-reload*.44+gunMotion.side*kick+sprint*.24),rotateX(kick*.22+dip*.8-reload*.12-sprint*.35+gunMotion.lagPitch*(1-aim*.95))));
}
function appendGun(model,{reload=0,flash=0,shadow=false,ammo=game.ammo,magDrop=gunReloadPose(reload).magDrop,slide=flash>0?.031*Math.sin(clamp(flash/.065,0,1)*Math.PI):ammo===0&&(!reload||reload<.81)?.028:0}={}){
  for(const part of gunParts){const offset=part.name==='slide'?transform(0,0,slide):part.name==='magazine'?transform(-magDrop*.15,-magDrop,magDrop*.2):identity();objectDraws.push({mesh:part.mesh,model:multiply(model,offset),texture:gunTexture,material:5,assetKind:6,castShadow:shadow,receiveTorch:shadow,gunPart:part.name});}
  if(flash>0){const p=[0,1,2].map(k=>model[12+k]+model[4+k]*.034-model[8+k]*.178);objectDraws.push({mesh:flareGlowMesh,model:flareBillboard(...p,.045+flash*.65),material:6,flareSprite:true,castShadow:false});}
}
function appendHeldGun(){
  const model=heldGunMatrix(),reload=gunMotion.reload,reach=gunMotion.supportReach,drop=gunMotion.magDrop;
  appendPovArm(model,'gun');
  // Support hand leaves the grip, follows the magazine out, then seats it again.
  appendLeftPovArm(multiply(model,gunSupportMatrix(reach,drop)),'gun');
  appendGun(model,{reload,flash:gunMotion.flash,magDrop:drop,slide:gunMotion.slide});
}
function gunSupportMatrix(reach,drop){return multiply(transform(lerp(-.030,-.006,reach)-drop*.15,-.012-reach*.036-drop,.018+reach*.025+drop*.2),multiply(rotateY(.12*(1-reach)),rotateZ(-.10)));}
function toggleGunAim(){if(game.mode!=='playing'||equippedTool!=='gun')return;gunMotion.aiming=!gunMotion.aiming;game.zoom=game.zoomTarget=1;}
document.getElementById('gunReload').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();reloadGun();});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('mousedown',e=>{if(e.button===0&&equippedTool==='gun')fireGun();if(e.button===2&&equippedTool==='gun')toggleGunAim();});
