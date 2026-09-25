const fieldKit=document.getElementById('fieldKit');
const kitCards=[...document.querySelectorAll('[data-tool]')];
let equippedTool='camera',kitPreviousFlashlight=false,kitRefresh=0,kitReturn='playing';
function canEquip(tool){return tool==='camera'||(tool==='flashlight'&&game.hasFlashlight)||(tool==='soda'&&game.sodas>0);}
function equipTool(tool){if(!canEquip(tool))return false;equippedTool=tool;refreshFieldKit();return true;}
function refreshFieldKit(){
  if(!canEquip(equippedTool))equippedTool='camera';
  document.getElementById('kitSodas').textContent=game.sodas;
  for(const card of kitCards){
    const tool=card.dataset.tool,available=canEquip(tool),selected=tool===equippedTool;
    card.disabled=!available;card.setAttribute('aria-pressed',String(selected));
    card.querySelector('.kitTag').textContent=selected?'EQUIPPED':available?'TAP TO EQUIP':tool==='soda'?'EMPTY':'NOT COLLECTED';
    if(tool==='flashlight')card.querySelector('.kitDetail').textContent=available?(game.torchOn?'Light is on':'Light is off'):'Find it in the shed';
  }
  const names={camera:'CAMERA',flashlight:'FLASHLIGHT',soda:'SODA'},actions={camera:'PHOTO',flashlight:game.torchOn?'LIGHT OFF':'LIGHT ON',soda:'DRINK'};
  document.getElementById('equippedName').textContent=names[equippedTool];
  document.getElementById('touchUseLabel').textContent=actions[equippedTool];
  document.getElementById('touchUseIcon').setAttribute('href','#icon-'+equippedTool);
  document.getElementById('touchUse').setAttribute('aria-label',actions[equippedTool]);
  document.getElementById('kitStatus').textContent=net.active?'Your online world keeps moving.':'Tap a pocket to equip and return.';
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
  else if(game.hasFlashlight){
    if(net.active)net.action('torch',{on:!game.torchOn});else game.torchOn=!game.torchOn;
    sound.noise(.045,.22,1800);
  }
  refreshFieldKit();
}
function updateFieldKit(dt){
  fieldKit.hidden=game.mode!=='inventory';
  document.getElementById('touchLesson').hidden=!(touchMode&&game.mode==='playing'&&game.hintAge<9);
  if(game.mode!=='playing'&&game.mode!=='inventory')return;
  if(game.hasFlashlight&&!kitPreviousFlashlight){equippedTool='flashlight';game.notice='FLASHLIGHT ADDED / OPEN KIT TO SWITCH TOOLS';game.noticeTime=4;}
  kitPreviousFlashlight=game.hasFlashlight;
  kitRefresh-=dt;if(kitRefresh>0)return;kitRefresh=.12;
  refreshFieldKit();
  document.getElementById('touchPickup').hidden=!nearestItem();
  document.getElementById('touchZoomLabel').textContent=game.zoomTarget.toFixed(1).replace('.0','')+'×';
  document.getElementById('joyBase').classList.toggle('running',game.sprinting);
}
for(const card of kitCards)card.addEventListener('click',()=>{if(equipTool(card.dataset.tool))closeFieldKit();});
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
const kitMenuButton=document.createElement('button');kitMenuButton.textContent='FIELD KIT';kitMenuButton.addEventListener('click',openFieldKit);ui.pausePanel.insertBefore(kitMenuButton,document.getElementById('pauseSettings'));
const worldMenuButton=document.createElement('button');worldMenuButton.textContent='WORLD CONTROLS';worldMenuButton.addEventListener('click',openFieldPanel);ui.pausePanel.insertBefore(worldMenuButton,document.getElementById('returnMenu'));
addEventListener('tower-back',()=>{if(game.mode==='inventory')closeFieldKit();else if(networkPanelOpen)closeMultiplayer();else if(game.mode==='playing')setMode('paused');else if(game.mode==='fieldPanel')closeFieldPanel();else if(game.mode==='paused')captureMouse();else mainMenu();});
