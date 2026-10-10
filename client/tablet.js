const tablet={progress:0,closing:false,selectedPlayer:null,rosterKey:"",meshes:[],yaw:0,pitch:0,zoom:1,model:null,previousMode:'playing',feedbackUntil:0};
function isWorldHost(){return !net.active||net.snapshots.at(-1)?.ownerId===net.player?.id;}
function buildTablet(){tablet.meshes=TABLET_ASSET.meshes.map(m=>({name:m.name,mesh:unpackModel(m)}));}
function tabletMessage(text){document.getElementById('tabletFeedback').textContent=text;tablet.feedbackUntil=time+4;}
function hostAction(command,options={}){
  if(!isWorldHost())return false;
  if(net.active){if(!net.connected){tabletMessage('CONNECTION LOST');return false;}net.action('host',{value:{command,...options}});return true;}
  if(command==='god')game.godMode=options.enabled;
  else if(command==='traffic'){if(typeof options.enabled!=='boolean')return false;world.trafficStopped=options.enabled;setTrafficLightsStopped(trafficLights,options.enabled);}
  else if(command==='sprint'){game.infiniteSprint=options.enabled;if(options.enabled){game.stamina=100;game.exhausted=false;}}
  else if(command==='teleport'){
    const target=hostDestination(activeLayout,options.destination);if(!target)return false;
    if(options.destination==='forest')enterForest(player,activeLayout,forestLevel);else Object.assign(player,target,{biome:'meadow',levelCooldown:3});if(inForest())collideEndlessForest(player,activeLayout.seed);else collideForest(player,activeLayout);player.y=shedFloor(player.x,player.z)+game.eyeHeight;updateForestLevelClient(0);
    tablet.yaw=player.yaw;tablet.pitch=0;keys.clear();game.vx=game.vz=0;
  }else if(command==='mimic'){const solo={...player,id:'solo',username:'YOU',heldItem:equippedTool,alive:true};if(!localMimic.spawn(solo,[solo],localVoiceMemory)){tabletMessage('ENTER THE FOREST FIRST');return false;}}
  else if(command==='item'){if(!summonLocalItem(options.kind)){tabletMessage('ITEM LIMIT REACHED');return false;}}
  else if(command==='clearMimic')localMimic.clear();
  else if(command==='wake'){world.turbineStopped=world.powerStopped=false;emitNoise(10000);}
  else if(command!=='tablet')return false;
  refreshTablet();return true;
}
function refreshTablet(){
  const trafficButton=document.getElementById('trafficToggle');trafficButton.setAttribute('aria-pressed',String(!!world.trafficStopped));trafficButton.textContent=world.trafficStopped?'RESUME TRAFFIC LIGHTS':'STOP TRAFFIC LIGHTS';trafficButton.disabled=!isWorldHost();document.getElementById('trafficStatus').textContent=world.trafficStopped?'TRAFFIC LIGHTS STOPPED':'TRAFFIC LIGHTS ACTIVE';
  document.getElementById("tabletSector").textContent=inForest()?"FOREST / NO SIGNAL":"MEADOW / CONNECTED";refreshTabletPlayers();
  for(const [id,key] of [['godToggle','godMode'],['sprintToggle','infiniteSprint']]){
    const b=document.getElementById(id);b.setAttribute('aria-pressed',String(!!game[key]));
    b.querySelector('small').textContent=(game[key]?'ON':'OFF')+(key==='godMode'?' · Damage protection':' · Unlimited stamina');
  }
  const active=net.active?net.snapshots.at(-1)?.world.mimic?.active:localMimic?.active;
  document.getElementById('mimicStatus').textContent='FOREST SIGNAL · '+(active?'MIMIC PRESENT':'QUIET');
  if(time>tablet.feedbackUntil)document.getElementById('tabletFeedback').textContent=net.active?(net.connected?'HOST LINK CONNECTED':'CONNECTION LOST'):'SOLO SESSION · HOST ACCESS';
}
function updateTablet(dt){
  const open=game.mode==='fieldPanel';
  if(open&&(!isWorldHost()||(net.active&&!net.connected)))tablet.closing=true;
  tablet.progress=clamp(tablet.progress+(open&&!tablet.closing?dt/.65:-dt/.48),0,1);
  document.getElementById('hostTabletButton').hidden=game.mode!=='playing'||!isWorldHost();
  if(open){const t=ease(tablet.progress);player.yaw=tablet.yaw;player.pitch=lerp(tablet.pitch,-.18,t);game.zoom=game.zoomTarget=lerp(tablet.zoom,1,t);refreshTablet();syncFieldPanel();if(tablet.closing&&tablet.progress===0){tablet.closing=false;hostAction('tablet',{enabled:false});player.pitch=tablet.pitch;game.zoom=game.zoomTarget=tablet.zoom;setMode('paused');if(tablet.previousMode==='playing'){sound.start();captureMouse();}}}
}
function tabletBasis(){
  const drop=1-ease(tablet.progress),yaw=tablet.yaw,pitch=-.18,r=[Math.cos(yaw),0,-Math.sin(yaw)],u=[Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),Math.cos(yaw)*Math.sin(pitch)],f=[-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)],p=[player.x,player.y,player.z].map((v,i)=>v-u[i]*.007+f[i]*.43-(i===1?drop*.58:0));
  const basis=new Float32Array([...r,0,...u,0,-f[0],-f[1],-f[2],0,...p,1]);return multiply(basis,rotateX(drop*.50));
}
function appendTablet(){
  if(tablet.progress<=0||isMenuScene()||game.mode==='lost')return;
  const model=tablet.model=tabletBasis();
  for(const part of tablet.meshes)objectDraws.push({mesh:part.mesh,model,material:5,assetKind:11,castShadow:false,receiveTorch:false,tablet:true});
  // Reuse the supplied hazmat glove and the full two-bone IK sleeve. Mirror
  // the solved right arm about the view centre to hold the other tablet edge.
  const grip=multiply(model,transform(.303,-.075,.005));
  const item=multiply(grip,transform(-itemGripAnchors.camera[0],-itemGripAnchors.camera[1],-itemGripAnchors.camera[2]));
  appendPovArm(item,'camera');const arm=objectDraws.at(-1);arm.bones=new Float32Array(arm.bones);arm.tabletArm=true;
  const reflection=identity(),n=right,d=dot(n,cameraPosition);
  for(let j=0;j<3;j++)for(let i=0;i<3;i++)reflection[j*4+i]=(i===j?1:0)-2*n[i]*n[j];
  for(let i=0;i<3;i++)reflection[12+i]=2*d*n[i];
  objectDraws.push({...arm,model:reflection,tabletArm:true});
}
function positionTabletScreen(){
  if(game.mode!=='fieldPanel'||!tablet.model)return;
  const s=TABLET_ASSET.screen,m=multiply(viewProjection,tablet.model);
  function project(x,y){const z=s[4],w=m[3]*x+m[7]*y+m[11]*z+m[15];return[((m[0]*x+m[4]*y+m[8]*z+m[12])/w*.5+.5)*innerWidth,(-((m[1]*x+m[5]*y+m[9]*z+m[13])/w)*.5+.5)*innerHeight];}
  const a=project(s[0],s[3]),b=project(s[2],s[3]),c=project(s[0],s[1]);
  // At the fully raised pose this is an exact affine projection of the physical screen.
  ui.fieldPanel.style.transform=`matrix(${(b[0]-a[0])/720},${(b[1]-a[1])/720},${(c[0]-a[0])/512},${(c[1]-a[1])/512},${a[0]},${a[1]})`;
  ui.fieldPanel.style.opacity=String(clamp((tablet.progress-.85)/.15,0,1));
  ui.fieldPanel.style.pointerEvents=tablet.progress>.97&&!tablet.closing?'auto':'none';
}
for(const b of document.querySelectorAll('[data-tablet-tab]'))b.addEventListener('click',()=>{
  for(const tab of document.querySelectorAll('[data-tablet-tab]'))tab.setAttribute('aria-pressed',String(tab===b));
  for(const page of document.querySelectorAll('[data-tablet-page]'))page.hidden=page.dataset.tabletPage!==b.dataset.tabletTab;
});
for(const b of document.querySelectorAll('[data-host-destination]'))b.addEventListener('click',()=>{
  if(hostAction('teleport',{destination:b.dataset.hostDestination}))tabletMessage('TRAVEL · '+b.querySelector('b').textContent.toUpperCase());
});
for(const [id,command,label] of [['spawnMimic','mimic','MIMIC SUMMONED IN THE FOREST'],['clearMimic','clearMimic','MIMIC DISMISSED'],['wakeGiants','wake','THE GIANTS HAVE BEEN ALERTED']])document.getElementById(id).addEventListener('click',()=>{if(hostAction(command))tabletMessage(label);});
for(const [id,command,key] of [['godToggle','god','godMode'],['sprintToggle','sprint','infiniteSprint']])document.getElementById(id).addEventListener('click',()=>{const enabled=!game[key];if(hostAction(command,{enabled}))tabletMessage((command==='god'?'GOD MODE':'INFINITE SPRINT')+' · '+(enabled?'ON':'OFF'));});
document.getElementById('hostTabletButton').addEventListener('click',openFieldPanel);
document.getElementById('trafficToggle').addEventListener('click',()=>{const enabled=!world.trafficStopped;if(hostAction('traffic',{enabled}))tabletMessage('TRAFFIC LIGHTS · '+(enabled?'STOPPED':'RESUMED'));});
const originalTabletAction=net.hooks.action;
net.hooks.action=(m,r)=>{originalTabletAction?.(m,r);if(m.action==='host')tabletMessage(m.ok?'COMMAND CONFIRMED':r?.value?.command==='mimic'?'A PLAYER MUST BE IN THE FOREST':'COMMAND UNAVAILABLE');};

function refreshTabletPlayers(){
  const tab=document.getElementById('tabletPlayersTab');tab.hidden=!net.active;document.querySelector('.tabletTabs').classList.toggle('multiplayer',net.active);
  if(!net.active){if(tab.getAttribute('aria-pressed')==='true')document.querySelector('[data-tablet-tab="travel"]').click();return;}
  const players=net.snapshots.at(-1)?.players.filter(p=>p.connected)||[],roster=document.getElementById('tabletRoster'),select=document.getElementById('playerDestination');
  if(!players.some(p=>p.id===tablet.selectedPlayer))tablet.selectedPlayer=players.find(p=>p.id!==net.player?.id)?.id||players[0]?.id;
  const key=JSON.stringify(players.map(p=>[p.id,p.username,p.alive]));if(key!==tablet.rosterKey){tablet.rosterKey=key;roster.replaceChildren();for(const p of players){const b=document.createElement('button');b.type='button';b.textContent=p.username;b.dataset.playerId=p.id;b.addEventListener('click',()=>{tablet.selectedPlayer=p.id;refreshTabletPlayers();});roster.appendChild(b);}}
  for(const b of roster.children)b.setAttribute('aria-pressed',String(b.dataset.playerId===tablet.selectedPlayer));
  const target=players.find(p=>p.id===tablet.selectedPlayer),name=document.getElementById('selectedPlayerName');name.textContent=target?.username||'Select a player';document.getElementById('selectedPlayerSector').textContent=target?(target.alive?biomeOf(target).toUpperCase():'SIGNAL LOST'):'';
  const choices=players.filter(p=>p.id!==target?.id&&p.alive),destKey=JSON.stringify(choices.map(p=>[p.id,p.username]));if(select.dataset.roster!==destKey){const previous=select.value;select.replaceChildren();for(const p of choices){const option=document.createElement('option');option.value=p.id;option.textContent=p.username;select.appendChild(option);}select.dataset.roster=destKey;if(choices.some(p=>p.id===previous))select.value=previous;}
  document.getElementById('bringPlayer').disabled=!target?.alive||target.id===net.player?.id;document.getElementById('sendPlayer').disabled=!target?.alive||!choices.length;
  for(const b of document.querySelectorAll('[data-player-effect]')){b.disabled=!target?.alive;if(['god','sprint'].includes(b.dataset.playerEffect))b.setAttribute('aria-pressed',String(!!target?.[b.dataset.playerEffect==='god'?'godMode':'infiniteSprint']));}
}
document.getElementById('bringPlayer').addEventListener('click',()=>hostAction('playerTeleport',{targetId:tablet.selectedPlayer,destinationId:net.player?.id}));
document.getElementById('sendPlayer').addEventListener('click',()=>hostAction('playerTeleport',{targetId:tablet.selectedPlayer,destinationId:document.getElementById('playerDestination').value}));
for(const b of document.querySelectorAll('[data-player-effect]'))b.addEventListener('click',()=>hostAction('playerEffect',{targetId:tablet.selectedPlayer,effect:b.dataset.playerEffect,enabled:b.getAttribute('aria-pressed')!=='true'}));

for(const b of document.querySelectorAll('[data-spawn-item]'))b.addEventListener('click',()=>{if(hostAction('item',{kind:b.dataset.spawnItem}))tabletMessage(b.querySelector('b').textContent.toUpperCase()+' · SUMMONED NEAR YOU');});
