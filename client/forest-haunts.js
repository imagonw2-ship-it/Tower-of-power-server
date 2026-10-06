let localVoiceMemory=new MimicMemory(),localMimic=new ForestMimic(activeLayout),watchingEye=null,eyeTexture=null,eyeMesh=null,eyeCheck=10,eyeCooldown=0,mimicStepAt=0;
function resetForestHaunts(){localVoiceMemory.clear();localMimic=new ForestMimic(activeLayout);watchingEye=null;eyeCheck=8;eyeCooldown=0;}
function buildForestHaunts(){
  eyeTexture=importedTexture(WATCHING_EYE_TEXTURE,5);const g=infraGeometry();
  infraFace(g,[[-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0]],[1,1,1],[[0,0],[1,0],[1,1],[0,1]]);eyeMesh=mesh3D(g);
}
function appearWatchingEye(force=false){
  if(!inForest()||!streamForest)return false;
  const candidates=streamForest.trees.filter(t=>{const dx=t.x-player.x,dz=t.z-player.z,d=Math.hypot(dx,dz);return d>5&&d<27&&(dx*forward[0]+dz*forward[2])/d>.60;});
  if(!candidates.length)return false;
  const t=candidates[Math.floor(Math.random()*candidates.length)],dx=player.x-t.x,dz=player.z-t.z,d=Math.hypot(dx,dz),r=t.radius+.035;
  watchingEye={tree:t,x:t.x+dx/d*r,z:t.z+dz/d*r,y:terrainHeight(t.x,t.z)+1.7+Math.random()*.8,age:0,noticed:0,width:Math.min(1.05,t.radius*1.55),nx:dx/d,nz:dz/d};
  return true;
}
function updateForestHaunts(dt){
  if(!['playing','fieldPanel'].includes(game.mode)){watchingEye=null;return;}
  if(!net.active&&game.mode==='playing'){
    const solo={...player,id:'solo',username:'YOU',heldItem:equippedTool,torch:game.torchOn,alive:true,crouching:game.crouching,godMode:game.godMode,vx:game.vx,vz:game.vz};
    const echoes=localMimic.step(dt,[solo],localVoiceMemory);if(!solo.alive){sound.caught();setMode('lost');if(document.pointerLockElement===canvas)document.exitPointerLock();}
    for(const frame of echoes){
      if(!proximityVoice.node)continue;const dx=frame.x-player.x,dz=frame.z-player.z,d=Math.hypot(dx,dz);if(d>38)continue;
      const samples=decodeVoice(frame.bytes),gain=Math.pow(1-Math.max(0,d-3)/35,1.5)*.85,pan=clamp((dx*Math.cos(player.yaw)-dz*Math.sin(player.yaw))/Math.max(1,d),-.9,.9);
      proximityVoice.node.port.postMessage({type:'packet',id:65537,samples,gain,pan},[samples.buffer]);
    }
  }
  if(game.mode!=='playing'||!inForest()){watchingEye=null;return;}
  const m=visibleMimic();mimicStepAt-=dt;if(m&&mimicStepAt<=0&&Math.hypot(m.vx||0,m.vz||0)>.2){mimicStepAt=m.sprinting?.35:m.crouching?1:.62;const d=Math.hypot(m.x-player.x,m.z-player.z);if(d<18)sound.noise(.16,(m.crouching?.035:.11)/(1+d*.4),650);}
  eyeCooldown=Math.max(0,eyeCooldown-dt);eyeCheck-=dt;
  if(!watchingEye&&eyeCooldown<=0&&eyeCheck<=0){eyeCheck=7+Math.random()*8;if(Math.random()<.26&&appearWatchingEye())eyeCooldown=24+Math.random()*35;}
  if(watchingEye){
    const e=watchingEye;e.age+=dt;const dir=norm([e.x-cameraPosition[0],e.y-cameraPosition[1],e.z-cameraPosition[2]]);
    if(dot(dir,forward)>.986)e.noticed+=dt;
    if(e.age>2.3||e.noticed>.32||Math.hypot(e.x-player.x,e.z-player.z)<3)watchingEye=null;
  }
}
function appendWatchingEye(){
  if(!watchingEye||game.mode!=='playing')return;const e=watchingEye,n=[e.nx,0,e.nz],r=[n[2],0,-n[0]];
  const model=new Float32Array([r[0]*e.width,0,r[2]*e.width,0,0,e.width,0,0,...n,0,e.x,e.y,e.z,1]);
  objectDraws.push({mesh:eyeMesh,model,texture:eyeTexture,material:5,assetKind:12,castShadow:false,receiveTorch:false,watchingEye:true});
}

function visibleMimic(){if(!net.active)return localMimic.active?localMimic:null;const q=snapshotPair(),m=q?.b.world.mimic;if(!m?.active)return null;const a=q.a.world.mimic;return a?.active&&a.id===m.id?poseBetween(a,m,q.t):m;}
function appendMimic(){const m=visibleMimic();if(m&&!isMenuScene())appendHazmat(m,net.active?net.snapshots.at(-1).world.elapsed:localMimic.clock);}
