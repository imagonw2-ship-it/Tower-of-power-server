// The owned pack is a passive capacity upgrade. The existing I / bag control
// swings it around by its carry handle and opens only its zippered top.
const backpack={parts:[],texture:null,interior:null,lidLining:null,progress:0,progressVelocity:0,closing:false,yaw:0,pitch:0,zoom:1,model:null,action:null,closeRequested:false};
function buildBackpack(){
  backpack.texture=importedTexture(BACKPACK_ASSET.texture,5);backpack.parts=BACKPACK_ASSET.meshes.map(p=>({name:p.name,mesh:unpackModel(p)}));
  // The old flat black quad extended over the front of the bag. This lining
  // follows the cut zipper contour and descends into an actual fabric cavity.
  const g=infraGeometry(),lid=infraGeometry(),rim=BACKPACK_ASSET.openingRim;
  const ring=(scale,y)=>rim.map(([x,,z],i)=>[x*scale,y+(y<.39?.002*Math.sin(i*2.7):0),.01+(z-.01)*scale]);
  const rings=[rim,ring(.963,.396),ring(.94,.32),ring(.86,.235),ring(.82,.205)];
  for(let level=0;level<rings.length-1;level++)for(let i=0;i<rim.length;i++){
    const j=(i+1)%rim.length,c=level===0?[.52,.48,.34]:level===1?[.44,.41,.29]:[.34,.33,.23];
    infraFace(g,[rings[level][i],rings[level][j],rings[level+1][j],rings[level+1][i]],c);
  }
  const floor=rings.at(-1),lidRim=ring(.99,.396);
  for(let i=0;i<rim.length;i++){
    const j=(i+1)%rim.length;
    infraFace(g,[[0,.201,.01],floor[i],floor[j]],i%3===0?[.31,.30,.21]:[.35,.34,.24]);
    infraFace(lid,[[0,.391,.01],lidRim[j],lidRim[i]],i%4===0?[.44,.41,.30]:[.48,.45,.33]);
  }
  // The stitched inner sleeve gives depth without blocking the opening.
  infraFace(g,[[-.092,.225,-.049],[.092,.225,-.049],[.096,.348,-.055],[-.096,.348,-.055]],[.43,.40,.29]);
  infraFace(g,[[-.096,.344,-.054],[.096,.344,-.054],[.096,.350,-.054],[-.096,.350,-.054]],[.56,.52,.38]);
  backpack.interior=mesh3D(g);backpack.lidLining=mesh3D(lid);
}
function resetBackpack(){Object.assign(backpack,{progress:0,progressVelocity:0,closing:false,model:null,action:null,closeRequested:false});fieldKit.classList.remove('physical');fieldKit.style.transform='';fieldKit.style.opacity='';fieldKit.style.width='';}
function queueBackpackTool(tool){
  if(backpack.action||backpack.closing||backpack.progress<.97)return false;
  if(tool===equippedTool)return true;
  backpack.action={from:equippedTool,to:tool,time:0};
  if(net.active&&!net.action('equip',{item:tool})){backpack.action=null;return false;}
  backpack.action.seq=net.actionSeq;sound.noise(.12,.06,800);refreshFieldKit();return true;
}
function updateBackpack(dt){
  const open=game.mode==='inventory'&&game.hasBackpack;
  if(!open){if(backpack.progress>0||backpack.action)resetBackpack();return;}
  if(backpack.action){
    backpack.action.time+=dt;
    const authoritative=net.active?net.snapshots.at(-1)?.players.find(p=>p.id===net.player?.id):null;
    const confirmed=!net.active||authoritative&&authoritative.actionSeq>=backpack.action.seq&&!authoritative.packAction;
    if(backpack.action.time>=PACK_TRANSFER_SECONDS&&confirmed){const tool=authoritative?.heldItem??backpack.action.to;backpack.action=null;equipTool(tool,true);if(backpack.closeRequested){backpack.closeRequested=false;closeFieldKit();}}
  }
  const before=backpack.progress;
  advancePackMotion(backpack,'progress',backpack.closing?0:1,dt);
  if(before<.63&&backpack.progress>=.63)sound.noise(.24,.10,3100,'highpass');
  const t=gunPhase(.06,.82,backpack.progress);player.yaw=backpack.yaw;player.pitch=lerp(backpack.pitch,-.56,t);game.zoom=game.zoomTarget=lerp(backpack.zoom,1,t);
  if(backpack.closing&&backpack.progress===0){player.pitch=backpack.pitch;game.zoom=game.zoomTarget=backpack.zoom;finishCloseFieldKit();}
}
function backpackBasis(){
  const t=gunPhase(.08,.84,backpack.progress),yaw=backpack.yaw;
  const r=[Math.cos(yaw),0,-Math.sin(yaw)],u=[0,1,0],f=[-Math.sin(yaw),0,-Math.cos(yaw)];
  const side=lerp(-.72,-.32,t),depth=lerp(-.25,.64,t),height=lerp(-.75,-.83,t)+Math.sin(Math.PI*t)*.045;
  const p=[player.x,player.y,player.z].map((v,k)=>v+r[k]*side+u[k]*height+f[k]*depth);
  const basis=new Float32Array([...r,0,...u,0,-f[0],-f[1],-f[2],0,...p,1]);
  return multiply(basis,multiply(rotateY((1-t)*2.3),multiply(rotateZ((1-t)*.18),multiply(rotateX(t*.12),transform(0,0,0,1,1,1)))));
}
function appendBackpackModel(model,open=0,shadow=false){
  const hinge=BACKPACK_ASSET.hinge;
  const lid=multiply(model,multiply(transform(...hinge),multiply(rotateX(open*BACKPACK_ASSET.openingAngle),transform(...hinge.map(v=>-v)))));
  for(const part of backpack.parts){
    const pose=part.name==='top'?lid:model;
    objectDraws.push({mesh:part.mesh,model:pose,texture:backpack.texture,material:5,assetKind:5,castShadow:shadow,receiveTorch:shadow,backpackPart:part.name});
  }
  if(open>.005){
    objectDraws.push({mesh:backpack.interior,model,material:5,assetKind:16,castShadow:false,receiveTorch:shadow,backpackPart:'interior'});
    objectDraws.push({mesh:backpack.lidLining,model:lid,material:5,assetKind:16,castShadow:shadow,receiveTorch:shadow,backpackPart:'lidLining'});
  }
}
function backpackGrip(model,position,kind='camera',tilt=0){
  const a=itemGripAnchors[kind]||itemGripAnchors.camera;
  return multiply(model,multiply(transform(...position),multiply(rotateX(tilt),transform(...a.map(v=>-v)))));
}
function appendPackItem(model,kind,shadow=false){
  if(!kind||kind==='none')return;
  const start=objectDraws.length;
  if(kind==='gun')appendGun(model,{ammo:1,shadow});
  else objectDraws.push({mesh:kind==='camera'?cameraItemMesh:kind==='flashlight'?flashlightMesh:kind==='flare'?flareGunMesh:sodaMesh,model,material:5,texture:kind==='camera'?cameraItemTexture:kind==='flare'?flareGunTexture:undefined,assetKind:kind==='camera'?6:kind==='flare'?7:kind==='flashlight'?1:2,castShadow:shadow,receiveTorch:shadow});
  for(let i=start;i<objectDraws.length;i++)objectDraws[i].packItem=kind;
}
function appendBackpack(){
  if(!game.hasBackpack||backpack.progress<=0||game.mode!=='inventory')return;
  const model=backpack.model=backpackBasis(),opening=gunPhase(.66,.94,backpack.progress);appendBackpackModel(model,opening);
  appendLeftPovArm(backpackGrip(model,BACKPACK_ASSET.handle),'camera');
  const pose=packHandPose(backpack.action,backpack.progress,equippedTool),kind=pose.kind==='none'?'camera':pose.kind,item=backpackGrip(model,pose.position,kind,pose.tilt);
  appendPovArm(item,kind);if(!pose.inside)appendPackItem(item,pose.kind);
}
function positionBackpackInventory(){
  if(game.mode!=='inventory'||!game.hasBackpack||!backpack.model)return;
  // Size the transparent controls to the owned tools, preserving their proportions.
  const columns=Math.max(1,kitCards.filter(card=>!card.hidden).length),width=Math.max(300,columns*98+(columns-1)*8),height=244;
  const scale=Math.min(1,(innerWidth*.51)/width,(innerHeight-48)/height);
  const x=Math.max(16,innerWidth-width*scale-32),y=Math.max(20,(innerHeight-height*scale)*.5);
  fieldKit.style.width=width+'px';
  fieldKit.style.transform=`translate(${x}px,${y}px) scale(${scale})`;
  fieldKit.style.opacity=String(gunPhase(.78,.98,backpack.progress)*(backpack.action?.7:1));
  fieldKit.style.pointerEvents=backpack.progress>.97&&!backpack.closing&&!backpack.action?'auto':'none';
}
