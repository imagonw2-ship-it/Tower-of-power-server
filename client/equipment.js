const fieldKit=document.getElementById('fieldKit');
const kitCards=[...document.querySelectorAll('[data-tool]')];
let equippedTool='camera',kitPreviousFlashlight=false,kitRefresh=0,kitReturn='playing';
function createToolMotion(tool){return{shown:tool,target:tool,phase:'idle',lower:0};}
const equipmentMotion=createToolMotion('camera');
let torchPreferred=true;
function advanceToolMotion(m,target,dt,inventory=false){
  m.target=target;
  if(inventory){m.shown=target;m.lower=1;m.phase='raise';return;}
  if(m.shown!==target&&m.phase!=='lower')m.phase='lower';
  if(m.phase==='lower'){
    m.lower=Math.min(1,m.lower+dt/(m.shown==='gun'||target==='gun'?.23:.16));
    if(m.lower>=1){m.shown=target;m.phase='raise';}
  }else if(m.phase==='raise'){
    m.lower=Math.max(0,m.lower-dt/(m.shown==='gun'?.34:.24));if(m.lower<=0)m.phase='idle';
  }
}
function resetEquipmentMotion(){Object.assign(equipmentMotion,createToolMotion('camera'));torchPreferred=true;}
function canEquip(tool){return tool==='none'||(tool==='camera'&&game.hasCamera!==false)||(tool==='flashlight'&&game.hasFlashlight)||(tool==='soda'&&(game.sodas>0||game.drinking>0))||(tool==='flare'&&game.hasFlare)||(tool==='gun'&&game.hasGun);}
function setTorch(on){if(net.active)net.action('torch',{on});else game.torchOn=on;}
function equipTool(tool){
  if(!canEquip(tool))return false;
  const changed=tool!==equippedTool;
  if(equippedTool==='flashlight'&&changed)torchPreferred=game.torchOn;
  if(changed){game.gunReload=0;gunMotion.aiming=false;gunMotion.reload=0;}
  equippedTool=tool;if(net.active)net.action('equip',{item:tool});
  if(tool==='flashlight'&&changed)setTorch(torchPreferred);
  else if(tool!=='flashlight'&&game.torchOn)setTorch(false);
  if(changed){sound.noise(.09,.06,900);advanceToolMotion(equipmentMotion,tool,0);}
  refreshFieldKit();return true;
}
function toggleFlashlight(){
  if(!game.hasFlashlight)return;
  if(equippedTool!=='flashlight'){torchPreferred=true;equipTool('flashlight');}
  else{torchPreferred=!game.torchOn;setTorch(torchPreferred);}
  sound.noise(.045,.22,1800);refreshFieldKit();
}
function heldEquipmentMatrix(tool=equipmentMotion.shown){
  const dip=ease(equipmentMotion.lower),sway=Math.sin(bob.phase)*bob.blend*.008-cameraDynamics.yawLag*.24;
  const drinking=tool==='soda'&&game.drinking>0?Math.sin((1-game.drinking/1.1)*Math.PI):0;
  const x=tool==='flashlight'?.27:tool==='soda'?.21:.22;
  // The launcher origin is above its handle. Raise it so the grip and knuckles
  // remain in view instead of putting the entire glove below the screen edge.
  const y=tool==='flashlight'?.11:tool==='soda'?.22:tool==='flare'?.035:.20;
  const z=tool==='flashlight'?.59:tool==='soda'?.53:tool==='flare'?.53:.42;
  const p=cameraPosition.map((v,i)=>v+right[i]*(x+sway+dip*.055)-up[i]*(y+dip*.46+(game.sprinting?.045:0)-drinking*.24)+forward[i]*(z-dip*.1));
  const basis=new Float32Array([right[0],right[1],right[2],0,up[0],up[1],up[2],0,-forward[0],-forward[1],-forward[2],0,...p,1]);
  const tilt=multiply(rotateX(dip*.62+drinking*.8+cameraDynamics.pitchLag*.55),rotateZ(-dip*.17+(tool==='soda'?-.12:0)));
  return multiply(multiply(basis,tilt),tool==='flashlight'?transform(0,0,0,1.3,1.3,1.3):identity());
}
function appendHeldEquipment(){
  const tool=equipmentMotion.shown;
  if(game.mode!=='playing'||tablet.progress>0||backpack.progress>0||game.zoom>=2.5||tool==='none')return;
  if(!canEquip(tool))return;
  if(tool==='gun'){appendHeldGun();return;}
  const model=heldEquipmentMatrix(tool);
  appendPovArm(model,tool);
  objectDraws.push({mesh:tool==='flashlight'?flashlightMesh:tool==='soda'?sodaMesh:tool==='flare'?flareGunMesh:cameraItemMesh,
    model,material:5,assetKind:tool==='flashlight'?1:tool==='soda'?2:tool==='flare'?7:6,
    texture:tool==='camera'?cameraItemTexture:tool==='flare'?flareGunTexture:undefined,castShadow:false,receiveTorch:false});
}
function torchStrength(){return game.mode!=='fieldPanel'&&game.hasFlashlight&&game.torchOn&&equippedTool==='flashlight'&&equipmentMotion.shown==='flashlight'?1-ease(equipmentMotion.lower):0;}
function refreshFieldKit(){
  if(!canEquip(equippedTool))equippedTool=canEquip('camera')?'camera':'none';
  document.getElementById('kitDrop').disabled=equippedTool==='none'||game.drinking>0||!!pendingDrop;
  document.getElementById('kitSodas').textContent=game.sodas;document.getElementById('kitFlares').textContent=game.flares||0;document.getElementById('kitRounds').textContent=(game.ammo||0)+' / '+(game.reserve||0);
  const inv=localInventory(),capacity=inventoryCapacity(inv),used=inventoryUsed(inv);document.getElementById('kitCapacity').textContent=used+' / '+capacity;document.getElementById('bagTitle').textContent=game.hasBackpack?'FIELD PACK':'SUIT POCKETS';
  for(const card of kitCards){
    const tool=card.dataset.tool,available=canEquip(tool),selected=tool===equippedTool;
    const owned=tool==='soda'?game.sodas>0:available;
    card.hidden=!owned;card.disabled=!owned;card.setAttribute('aria-pressed',String(selected));
    card.querySelector('.kitTag').textContent=selected?'IN HAND':'EQUIP';
    if(tool==='flashlight')card.querySelector('.kitDetail').textContent=available?(game.torchOn?'Light is on':'Light is off'):'Find it in the shed';
  }
  document.querySelectorAll('.kitEmpty').forEach((slot,i)=>{slot.hidden=i>=capacity-used;});
  const names={none:'EMPTY HAND',camera:'CAMERA',flashlight:'FLASHLIGHT',soda:'SODA',flare:'FLARE GUN',gun:'GLOCK 17'},actions={none:'EMPTY HAND',camera:'PHOTO',flashlight:game.torchOn?'LIGHT OFF':'LIGHT ON',soda:'DRINK',flare:'FIRE FLARE',gun:game.ammo>0?'FIRE':'RELOAD'};
  document.getElementById('equippedName').textContent=names[equippedTool];
  document.getElementById('handName').textContent=names[equippedTool];document.getElementById('handHint').textContent=equippedTool==='none'?'':'UNEQUIP';document.getElementById('handSlot').setAttribute('aria-label',equippedTool==='none'?'Empty hand':'Unequip '+names[equippedTool]);document.getElementById('touchUse').hidden=equippedTool==='none';
  if(!fieldKit.hidden)refreshItemPreviews();
  document.getElementById('touchUseLabel').textContent=actions[equippedTool];
  document.getElementById('touchUseIcon').setAttribute('href','#icon-'+equippedTool);
  document.getElementById('touchUse').setAttribute('aria-label',actions[equippedTool]);
  document.getElementById('kitStatus').textContent=used>=capacity?'FULL · Drop an item to make room':game.hasBackpack?'12 SLOTS · PACK EQUIPPED':'6 SLOTS · Find a backpack for more space';
  document.getElementById('touchCrouch').classList.toggle('latched',game.crouching);
  document.getElementById('touchCrouch').setAttribute('aria-pressed',String(game.crouching));
}
function openFieldKit(){
  if(!['playing','paused'].includes(game.mode))return;
  if(game.hasBackpack)sound.noise(.22,.11,550);
  kitReturn=game.mode;backpack.yaw=player.yaw;backpack.pitch=player.pitch;backpack.zoom=game.zoomTarget;backpack.closing=false;backpack.progress=0;
  fieldKit.classList.toggle('physical',!!game.hasBackpack);fieldKit.style.transform='';fieldKit.style.opacity=game.hasBackpack?'0':'1';fieldKit.style.pointerEvents=game.hasBackpack?'none':'auto';
  game.gunReload=0;if(net.active)net.action('inventory',{open:true});setMode('inventory');fieldKit.hidden=false;refreshFieldKit();
  if(document.pointerLockElement===canvas)document.exitPointerLock();
  document.getElementById('kitClose').focus({preventScroll:true});
}
function closeFieldKit(){
  if(game.mode!=='inventory')return;
  if(backpack.closing)return;
  if(game.hasBackpack&&backpack.progress>0){backpack.closing=true;if(net.active)net.action('inventory',{open:false});sound.noise(.23,.09,2700,'highpass');return;}finishCloseFieldKit();
}
function finishCloseFieldKit(){
  resetBackpack();fieldKit.style.pointerEvents='auto';if(net.active)net.action('inventory',{open:false});
  fieldKit.hidden=true;setMode(kitReturn==='paused'?'paused':'playing');
  if(game.mode==='playing')captureMouse();
}
function useEquipment(){
  if(game.mode!=='playing'||!locked)return;
  sound.start();
  if(equippedTool==='camera')takePhoto();
  else if(equippedTool==='soda')drinkSoda();
  else if(equippedTool==='flare')fireFlare();
  else if(equippedTool==='gun')fireGun();
  else if(equippedTool==='flashlight'&&game.hasFlashlight){
    toggleFlashlight();
  }
  refreshFieldKit();
}
function updateFieldKit(dt){
  fieldKit.hidden=game.mode!=='inventory';
  advanceToolMotion(equipmentMotion,equippedTool,dt,game.mode==='inventory');
  if(pendingDrop&&performance.now()-pendingDrop.at>3500)pendingDrop=null;
  updatePickupPrompt();
  const stamina=Math.max(0,Math.min(100,game.stamina??100));
  document.getElementById('staminaFill').style.transform='scaleX('+stamina/100+')';
  document.getElementById('staminaBar').setAttribute('aria-valuenow',String(Math.round(stamina)));
  document.getElementById('staminaBar').classList.toggle('exhausted',!!game.exhausted);
  document.getElementById('touchLesson').hidden=true;
  const ownsWorld=!net.active||net.snapshots.at(-1)?.ownerId===net.player?.id;document.getElementById('touchWorld').hidden=!ownsWorld;document.getElementById('touchSprint').classList.toggle('latched',mobileInput.sprint);document.getElementById('touchSprint').setAttribute('aria-pressed',String(mobileInput.sprint));
  if(game.mode!=='playing'&&game.mode!=='inventory')return;
  if(game.hasFlashlight&&!kitPreviousFlashlight){equipTool('flashlight');game.notice=touchMode?'FLASHLIGHT COLLECTED':'FLASHLIGHT ADDED / OPEN INVENTORY TO SWITCH';game.noticeTime=4;}
  kitPreviousFlashlight=game.hasFlashlight;
  kitRefresh-=dt;if(kitRefresh>0)return;kitRefresh=.12;
  refreshFieldKit();
  document.getElementById('touchZoomLabel').textContent=game.zoomTarget.toFixed(1).replace('.0','')+'×';
  document.getElementById('joyBase').classList.toggle('running',game.sprinting);
}
for(const card of kitCards){card.addEventListener('click',()=>equipTool(card.dataset.tool));card.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',card.dataset.tool));}
const handSlot=document.getElementById('handSlot');handSlot.addEventListener('click',()=>equipTool('none'));handSlot.addEventListener('dragover',e=>e.preventDefault());handSlot.addEventListener('drop',e=>{e.preventDefault();equipTool(e.dataTransfer.getData('text/plain'));});
document.getElementById('kitDrop').addEventListener('click',dropEquipment);
document.getElementById('kitClose').addEventListener('click',closeFieldKit);
document.getElementById('desktopKit').addEventListener('click',openFieldKit);
document.getElementById('touchKit').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();openFieldKit();});
document.getElementById('touchUse').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();useEquipment();});
document.getElementById('touchAim').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(equippedTool==='gun'){toggleGunAim();return;}const levels=[1,2,4,6];const next=levels.find(v=>v>game.zoomTarget+.1)||1;changeZoom(next/game.zoomTarget);});
document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;
  if((e.code==='KeyI'||e.code==='Tab')&&!e.repeat&&['playing','paused','inventory'].includes(game.mode)){
    e.preventDefault();if(game.mode==='inventory')closeFieldKit();else openFieldKit();
  }else if(e.code==='Escape'&&game.mode==='inventory'){e.preventDefault();closeFieldKit();}
  else if(e.code==='KeyR'&&!e.repeat){if(equippedTool==='gun')reloadGun();else useEquipment();}
  else if(e.code==='KeyG'&&!e.repeat)dropEquipment();
});
addEventListener('tower-back',()=>{if(game.mode==='inventory')closeFieldKit();else if(networkPanelOpen)closeMultiplayer();else if(game.mode==='playing')setMode('paused');else if(game.mode==='fieldPanel')closeFieldPanel();else if(game.mode==='paused')captureMouse();else mainMenu();});
