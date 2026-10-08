// The owned pack is a passive capacity upgrade. The existing I / bag control
// brings it forward, opens the front, and projects the inventory into its lining.
const backpack={parts:[],texture:null,liner:null,progress:0,closing:false,yaw:0,pitch:0,zoom:1,model:null};
function buildBackpack(){
  backpack.texture=importedTexture(BACKPACK_ASSET.texture,5);backpack.parts=BACKPACK_ASSET.meshes.map(p=>({name:p.name,mesh:unpackModel(p)}));
  const g=infraGeometry(),s=BACKPACK_ASSET.screen;
  infraFace(g,[[s[0]-.01,s[1]-.015,s[4]-.002],[s[2]+.01,s[1]-.015,s[4]-.002],[s[2]+.01,s[3]+.01,s[4]-.002],[s[0]-.01,s[3]+.01,s[4]-.002]],[.025,.030,.021],[[0,0],[1,0],[1,1],[0,1]]);backpack.liner=mesh3D(g);
}
function resetBackpack(){Object.assign(backpack,{progress:0,closing:false,model:null});fieldKit.classList.remove('physical');fieldKit.style.transform='';fieldKit.style.opacity='';}
function updateBackpack(dt){
  const open=game.mode==='inventory'&&game.hasBackpack;
  if(!open&&backpack.progress>0){backpack.progress=0;backpack.closing=false;backpack.model=null;}
  if(!open)return;
  const before=backpack.progress;
  backpack.progress=clamp(backpack.progress+(backpack.closing?-dt/.72:dt/.98),0,1);
  if(before<.63&&backpack.progress>=.63)sound.noise(.24,.10,3100,'highpass');
  const t=ease(clamp(backpack.progress/.67,0,1));player.yaw=backpack.yaw;player.pitch=lerp(backpack.pitch,-.16,t);game.zoom=game.zoomTarget=lerp(backpack.zoom,1,t);
  if(backpack.closing&&backpack.progress===0){player.pitch=backpack.pitch;game.zoom=game.zoomTarget=backpack.zoom;finishCloseFieldKit();}
}
function backpackBasis(){
  const t=ease(clamp(backpack.progress/.68,0,1)),yaw=backpack.yaw,pitch=-.16;
  const r=[Math.cos(yaw),0,-Math.sin(yaw)],u=[Math.sin(yaw)*Math.sin(pitch),Math.cos(pitch),Math.cos(yaw)*Math.sin(pitch)],f=[-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)];
  const side=(1-t)*.80,depth=lerp(-.32,.60,t),height=lerp(-.50,-.29,t)+Math.sin(Math.PI*t)*.06;
  const p=[player.x,player.y,player.z].map((v,k)=>v+r[k]*side+u[k]*height+f[k]*depth);
  const basis=new Float32Array([...r,0,...u,0,-f[0],-f[1],-f[2],0,...p,1]);
  return multiply(basis,multiply(rotateY(-(1-t)*2.0),multiply(rotateZ(-(1-t)*.38),transform(0,0,0,1.45,1.27,1))));
}
function appendBackpackModel(model,open=0,shadow=false){
  const hinge=BACKPACK_ASSET.hinge;
  for(const part of backpack.parts){
    const pose=part.name==='flap'?multiply(model,multiply(transform(...hinge),multiply(rotateX(open*1.95),transform(...hinge.map(v=>-v))))):model;
    objectDraws.push({mesh:part.mesh,model:pose,texture:backpack.texture,material:5,assetKind:5,castShadow:shadow,receiveTorch:shadow,backpackPart:part.name});
  }
  if(open>.05)objectDraws.push({mesh:backpack.liner,model,material:5,assetKind:11,castShadow:false,receiveTorch:false});
}
function appendBackpack(){
  if(!game.hasBackpack||backpack.progress<=0||game.mode!=='inventory')return;
  const model=backpack.model=backpackBasis(),opening=ease(clamp((backpack.progress-.62)/.32,0,1));appendBackpackModel(model,opening);
  // Both gloved hands stay attached to the bag handles while swinging it forward.
  for(const side of [1,-1]){
    const item=multiply(model,transform(side*.175-itemGripAnchors.camera[0],.29-itemGripAnchors.camera[1],.015-itemGripAnchors.camera[2]));
    if(side===1)appendPovArm(item,'camera');else appendLeftPovArm(item,'camera');
  }
}
function positionBackpackInventory(){
  if(game.mode!=='inventory'||!game.hasBackpack||!backpack.model)return;
  const s=BACKPACK_ASSET.screen,m=multiply(viewProjection,backpack.model);
  const project=(x,y)=>{const z=s[4],w=m[3]*x+m[7]*y+m[11]*z+m[15];return[((m[0]*x+m[4]*y+m[8]*z+m[12])/w*.5+.5)*innerWidth,(-((m[1]*x+m[5]*y+m[9]*z+m[13])/w)*.5+.5)*innerHeight];};
  const a=project(s[0],s[3]),b=project(s[2],s[3]),c=project(s[0],s[1]);
  fieldKit.style.transform=`matrix(${(b[0]-a[0])/640},${(b[1]-a[1])/640},${(c[0]-a[0])/640},${(c[1]-a[1])/640},${a[0]},${a[1]})`;
  fieldKit.style.opacity=String(clamp((backpack.progress-.88)/.12,0,1));fieldKit.style.pointerEvents=backpack.progress>.97&&!backpack.closing?'auto':'none';
}
