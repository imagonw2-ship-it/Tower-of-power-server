const tablet={progress:0,meshes:[],yaw:0,pitch:0,zoom:1,model:null,previousMode:'playing',feedbackUntil:0};
function isWorldHost(){return !net.active||net.snapshots.at(-1)?.ownerId===net.player?.id;}
function buildTablet(){tablet.meshes=TABLET_ASSET.meshes.map(m=>({name:m.name,mesh:unpackModel(m)}));}
function tabletMessage(text){document.getElementById('tabletFeedback').textContent=text;tablet.feedbackUntil=time+4;}
function hostAction(command,options={}){
  if(!isWorldHost())return false;
  if(net.active){if(!net.connected){tabletMessage('CONNECTION LOST');return false;}net.action('host',{value:{command,...options}});return true;}
  if(command==='god')game.godMode=options.enabled;
  else if(command==='sprint'){game.infiniteSprint=options.enabled;if(options.enabled){game.stamina=100;game.exhausted=false;}}
  else if(command==='teleport'){
    const target=hostDestination(activeLayout,options.destination);if(!target)return false;
    Object.assign(player,target);collideForest(player,activeLayout);player.y=shedFloor(player.x,player.z)+game.eyeHeight;
    tablet.yaw=player.yaw;tablet.pitch=0;keys.clear();game.vx=game.vz=0;
  }else if(command==='mimic')localMimic.spawn(player);
  else if(command==='clearMimic')localMimic.clear();
  else if(command==='wake'){world.turbineStopped=world.powerStopped=false;emitNoise(10000);}
  else if(command!=='tablet')return false;
  refreshTablet();return true;
}
function refreshTablet(){
  for(const [id,key] of [['godToggle','godMode'],['sprintToggle','infiniteSprint']]){
    const b=document.getElementById(id);b.setAttribute('aria-pressed',String(!!game[key]));
    b.querySelector('small').textContent=(game[key]?'ON':'OFF')+(key==='godMode'?' · Stomp protection':' · Unlimited stamina');
  }
  const active=net.active?net.snapshots.at(-1)?.world.mimic?.active:localMimic?.active;
  document.getElementById('mimicStatus').textContent='FOREST SIGNAL · '+(active?'MIMIC PRESENT':'QUIET');
  if(time>tablet.feedbackUntil)document.getElementById('tabletFeedback').textContent=net.active?(net.connected?'HOST LINK CONNECTED':'CONNECTION LOST'):'SOLO SESSION · HOST ACCESS';
}
function updateTablet(dt){
  const open=game.mode==='fieldPanel';
  if(open&&(!isWorldHost()||(net.active&&!net.connected))){closeFieldPanel();return;}
  tablet.progress=clamp(tablet.progress+(open?dt/.32:-dt/.22),0,1);
  document.getElementById('hostTabletButton').hidden=game.mode!=='playing'||!isWorldHost();
  if(open){player.yaw=tablet.yaw;player.pitch=-.08;game.zoom=game.zoomTarget=1;bob.blend=bob.strafe=0;refreshTablet();syncFieldPanel();}
}
function tabletBasis(){
  const drop=1-ease(tablet.progress),p=cameraPosition.map((v,i)=>v-up[i]*(.007+drop*.55)+forward[i]*.43);
  const basis=new Float32Array([...right,0,...up,0,-forward[0],-forward[1],-forward[2],0,...p,1]);
  return multiply(basis,rotateX(drop*.45));
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
  ui.fieldPanel.style.pointerEvents=tablet.progress>.97?'auto':'none';
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
const originalTabletAction=net.hooks.action;
net.hooks.action=(m,r)=>{originalTabletAction?.(m,r);if(m.action==='host'&&!m.ok)tabletMessage('REQUEST REJECTED · HOST ACCESS REQUIRED');if(m.action==='host'&&m.ok&&r?.value?.command==='teleport'){const t=hostDestination(activeLayout,r.value.destination);if(t){tablet.yaw=t.yaw;tablet.pitch=0;}}};
