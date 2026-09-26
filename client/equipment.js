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
    m.lower=Math.min(1,m.lower+dt/.16);
    if(m.lower>=1){m.shown=target;m.phase='raise';}
  }else if(m.phase==='raise'){
    m.lower=Math.max(0,m.lower-dt/.24);if(m.lower<=0)m.phase='idle';
  }
}
function resetEquipmentMotion(){Object.assign(equipmentMotion,createToolMotion('camera'));torchPreferred=true;}
function canEquip(tool){return tool==='none'||tool==='camera'||(tool==='flashlight'&&game.hasFlashlight)||(tool==='soda'&&(game.sodas>0||game.drinking>0));}
function setTorch(on){if(net.active)net.action('torch',{on});else game.torchOn=on;}
function equipTool(tool){
  if(!canEquip(tool))return false;
  const changed=tool!==equippedTool;
  if(equippedTool==='flashlight'&&changed)torchPreferred=game.torchOn;
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
  const dip=ease(equipmentMotion.lower),sway=Math.sin(bob.phase)*bob.blend*.008;
  const drinking=tool==='soda'&&game.drinking>0?Math.sin((1-game.drinking/1.1)*Math.PI):0;
  const x=tool==='flashlight'?.27:tool==='soda'?.22:.22;
  const y=tool==='flashlight'?.24:tool==='soda'?.35:.20,z=tool==='flashlight'?.51:tool==='soda'?.41:.42;
  const p=cameraPosition.map((v,i)=>v+right[i]*(x+sway+dip*.055)-up[i]*(y+dip*.46+(game.sprinting?.045:0)-drinking*.24)+forward[i]*(z-dip*.1));
  const basis=new Float32Array([right[0],right[1],right[2],0,up[0],up[1],up[2],0,-forward[0],-forward[1],-forward[2],0,...p,1]);
  const tilt=multiply(rotateX(dip*.62+drinking*.8),rotateZ(-dip*.17));
  return multiply(multiply(basis,tilt),tool==='flashlight'?transform(0,0,0,1.3,1.3,1.3):identity());
}
function appendHeldEquipment(){
  const tool=equipmentMotion.shown;
  if(game.mode!=='playing'||game.zoom>=2.5||tool==='none')return;
  if(tool==='flashlight'&&!game.hasFlashlight)return;
  if(tool==='soda'&&game.sodas<=0&&game.drinking<=0)return;
  objectDraws.push({mesh:tool==='flashlight'?flashlightMesh:tool==='soda'?sodaMesh:cameraItemMesh,
    model:heldEquipmentMatrix(tool),material:5,assetKind:tool==='flashlight'?1:tool==='soda'?2:6,
    texture:tool==='camera'?cameraItemTexture:undefined,castShadow:false,receiveTorch:false});
}
function torchStrength(){return game.hasFlashlight&&game.torchOn&&equippedTool==='flashlight'&&equipmentMotion.shown==='flashlight'?1-ease(equipmentMotion.lower):0;}
function refreshFieldKit(){
  if(!canEquip(equippedTool))equippedTool='camera';
  document.getElementById('kitSodas').textContent=game.sodas;
  for(const card of kitCards){
    const tool=card.dataset.tool,available=canEquip(tool),selected=tool===equippedTool;
    card.disabled=!available;card.setAttribute('aria-pressed',String(selected));
    card.querySelector('.kitTag').textContent=selected?'IN HAND':available?'EQUIP':tool==='soda'?'EMPTY':'NOT COLLECTED';
    if(tool==='flashlight')card.querySelector('.kitDetail').textContent=available?(game.torchOn?'Light is on':'Light is off'):'Find it in the shed';
  }
  const names={none:'EMPTY HAND',camera:'CAMERA',flashlight:'FLASHLIGHT',soda:'SODA'},actions={none:'EMPTY HAND',camera:'PHOTO',flashlight:game.torchOn?'LIGHT OFF':'LIGHT ON',soda:'DRINK'};
  document.getElementById('equippedName').textContent=names[equippedTool];
  document.getElementById('handName').textContent=names[equippedTool];document.getElementById('handIcon').setAttribute('href',equippedTool==='none'?'#icon-pickup':'#icon-'+equippedTool);document.getElementById('handHint').textContent=equippedTool==='none'?'':'UNEQUIP';document.getElementById('handSlot').setAttribute('aria-label',equippedTool==='none'?'Empty hand':'Unequip '+names[equippedTool]);document.getElementById('touchUse').hidden=equippedTool==='none';
  document.getElementById('touchUseLabel').textContent=actions[equippedTool];
  document.getElementById('touchUseIcon').setAttribute('href','#icon-'+equippedTool);
  document.getElementById('touchUse').setAttribute('aria-label',actions[equippedTool]);
  document.getElementById('kitStatus').textContent=net.active?'Your online world keeps moving.':'Select an item to equip it.';
  document.getElementById('touchCrouch').classList.toggle('latched',game.crouching);
  document.getElementById('touchCrouch').setAttribute('aria-pressed',String(game.crouching));
}
function openFieldKit(){
  if(!['playing','paused'].includes(game.mode))return;
  kitReturn=game.mode;setMode('inventory');fieldKit.hidden=false;refreshFieldKit();
  if(document.pointerLockElement===canvas)document.exitPointerLock();
  document.getElementById('kitClose').focus({preventScroll:true});
}
function closeFieldKit(){
  if(game.mode!=='inventory')return;
  fieldKit.hidden=true;setMode(kitReturn==='paused'?'paused':'playing');
  if(game.mode==='playing')captureMouse();
}
function useEquipment(){
  if(game.mode!=='playing'||!locked)return;
  sound.start();
  if(equippedTool==='camera')takePhoto();
  else if(equippedTool==='soda')drinkSoda();
  else if(equippedTool==='flashlight'&&game.hasFlashlight){
    toggleFlashlight();
  }
  refreshFieldKit();
}
function updateFieldKit(dt){
  fieldKit.hidden=game.mode!=='inventory';
  advanceToolMotion(equipmentMotion,equippedTool,dt,game.mode==='inventory');
  updatePickupPrompt();
  document.getElementById('touchLesson').hidden=true;
  const ownsWorld=!net.active||net.snapshots.at(-1)?.ownerId===net.player?.id;worldMenuButton.hidden=!ownsWorld;document.getElementById('touchWorld').hidden=!ownsWorld;document.getElementById('touchSprint').classList.toggle('latched',mobileInput.sprint);document.getElementById('touchSprint').setAttribute('aria-pressed',String(mobileInput.sprint));
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
document.getElementById('kitClose').addEventListener('click',closeFieldKit);
document.getElementById('desktopKit').addEventListener('click',openFieldKit);
document.getElementById('touchKit').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();openFieldKit();});
document.getElementById('touchUse').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();useEquipment();});
document.getElementById('touchAim').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();const levels=[1,2,4,6];const next=levels.find(v=>v>game.zoomTarget+.1)||1;changeZoom(next/game.zoomTarget);});
document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName))return;
  if((e.code==='KeyI'||e.code==='Tab')&&!e.repeat&&['playing','paused','inventory'].includes(game.mode)){
    e.preventDefault();if(game.mode==='inventory')closeFieldKit();else openFieldKit();
  }else if(e.code==='Escape'&&game.mode==='inventory'){e.preventDefault();closeFieldKit();}
  else if(e.code==='KeyR'&&!e.repeat)useEquipment();
});
const kitMenuButton=document.createElement('button');kitMenuButton.textContent='INVENTORY';kitMenuButton.addEventListener('click',openFieldKit);ui.pausePanel.insertBefore(kitMenuButton,document.getElementById('pauseSettings'));
const worldMenuButton=document.createElement('button');worldMenuButton.textContent='WORLD CONTROLS';worldMenuButton.addEventListener('click',openFieldPanel);ui.pausePanel.insertBefore(worldMenuButton,document.getElementById('returnMenu'));
addEventListener('tower-back',()=>{if(game.mode==='inventory')closeFieldKit();else if(networkPanelOpen)closeMultiplayer();else if(game.mode==='playing')setMode('paused');else if(game.mode==='fieldPanel')closeFieldPanel();else if(game.mode==='paused')captureMouse();else mainMenu();});
