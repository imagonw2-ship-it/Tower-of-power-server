// The owned pack is a passive capacity upgrade. The existing I / bag control
// swings it around by its carry handle and opens only its zippered top.
const backpack={parts:[],texture:null,liner:null,progress:0,progressVelocity:0,closing:false,yaw:0,pitch:0,zoom:1,model:null,action:null,closeRequested:false};
function buildBackpack(){
  backpack.texture=importedTexture(BACKPACK_ASSET.texture,5);backpack.parts=BACKPACK_ASSET.meshes.map(p=>({name:p.name,mesh:unpackModel(p)}));
  const g=infraGeometry(),s=BACKPACK_ASSET.screen;
  infraFace(g,[[s[0],s[4]-.025,s[1]],[s[0],s[4]-.025,s[3]],[s[2],s[4]-.025,s[3]],[s[2],s[4]-.025,s[1]]],[.014,.018,.011],[[0,0],[0,1],[1,1],[1,0]]);backpack.liner=mesh3D(g);
}
function resetBackpack(){Object.assign(backpack,{progress:0,progressVelocity:0,closing:false,model:null,action:null,closeRequested:false});fieldKit.classList.remove('physical');fieldKit.style.transform='';fieldKit.style.opacity='';}
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
  const t=gunPhase(.06,.82,backpack.progress);player.yaw=backpack.yaw;player.pitch=lerp(backpack.pitch,-.82,t);game.zoom=game.zoomTarget=lerp(backpack.zoom,1,t);
  if(backpack.closing&&backpack.progress===0){player.pitch=backpack.pitch;game.zoom=game.zoomTarget=backpack.zoom;finishCloseFieldKit();}
}
function backpackBasis(){
  const t=gunPhase(.08,.84,backpack.progress),yaw=backpack.yaw;
  const r=[Math.cos(yaw),0,-Math.sin(yaw)],u=[0,1,0],f=[-Math.sin(yaw),0,-Math.cos(yaw)];
  const side=lerp(-.72,0,t),depth=lerp(-.25,.49,t),height=lerp(-.75,-.85,t)+Math.sin(Math.PI*t)*.045;
  const p=[player.x,player.y,player.z].map((v,k)=>v+r[k]*side+u[k]*height+f[k]*depth);
  const basis=new Float32Array([...r,0,...u,0,-f[0],-f[1],-f[2],0,...p,1]);
  return multiply(basis,multiply(rotateY((1-t)*2.3),multiply(rotateZ((1-t)*.18),multiply(rotateX(t*.12),transform(0,0,0,1.22,1.15,1.1)))));
}
function appendBackpackModel(model,open=0,shadow=false){
  const hinge=BACKPACK_ASSET.hinge;
  for(const part of backpack.parts){
    const pose=part.name==='top'?multiply(model,multiply(transform(...hinge),multiply(rotateX(open*BACKPACK_ASSET.openingAngle),transform(...hinge.map(v=>-v))))):model;
    objectDraws.push({mesh:part.mesh,model:pose,texture:backpack.texture,material:5,assetKind:5,castShadow:shadow,receiveTorch:shadow,backpackPart:part.name});
  }
  if(open>.05)objectDraws.push({mesh:backpack.liner,model,material:5,assetKind:11,castShadow:false,receiveTorch:false});
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
  if(backpack.progress<=.90){fieldKit.style.opacity='0';fieldKit.style.pointerEvents='none';return;}
  const s=BACKPACK_ASSET.screen,m=multiply(viewProjection,backpack.model);
  const project=(x,z)=>{const y=s[4],w=m[3]*x+m[7]*y+m[11]*z+m[15];return[((m[0]*x+m[4]*y+m[8]*z+m[12])/w*.5+.5)*innerWidth,(-((m[1]*x+m[5]*y+m[9]*z+m[13])/w)*.5+.5)*innerHeight];};
  const a=project(s[0],s[1]),b=project(s[2],s[1]),c=project(s[0],s[3]),d=project(s[2],s[3]);
  // Map all four corners to the opening, including its perspective taper.
  const dx1=b[0]-d[0],dx2=c[0]-d[0],dx3=a[0]-b[0]+d[0]-c[0],dy1=b[1]-d[1],dy2=c[1]-d[1],dy3=a[1]-b[1]+d[1]-c[1],det=dx1*dy2-dx2*dy1;
  const g=(dx3*dy2-dx2*dy3)/det,h=(dx1*dy3-dx3*dy1)/det;
  fieldKit.style.transform=`matrix3d(${(b[0]-a[0]+g*b[0])/640},${(b[1]-a[1]+g*b[1])/640},0,${g/640},${(c[0]-a[0]+h*c[0])/280},${(c[1]-a[1]+h*c[1])/280},0,${h/280},0,0,1,0,${a[0]},${a[1]},0,1)`;
  fieldKit.style.opacity=String(clamp((backpack.progress-.90)/.10,0,1)*(backpack.action ? .18 : 1));fieldKit.style.pointerEvents=backpack.progress>.97&&!backpack.closing&&!backpack.action?'auto':'none';
}
