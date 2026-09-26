// Baked Mixamo poses retargeted to the uploaded hazmat. Shared meshes, 24 fps clips,
// two skin weights and distance-limited shadows keep multiplayer inexpensive.
const avatarCache=new Map();let avatarParts=[],avatarClips={},avatarCensor,cameraItemMesh;
const avatarBoneCount=AVATAR_ASSET.bones.length;
function buildAvatars(){
  const textures={};for(const [k,v] of Object.entries(AVATAR_ASSET.textures))textures[k]=importedTexture(v,5);
  avatarParts=AVATAR_ASSET.meshes.map(m=>({mesh:unpackModel(m),texture:textures[m.texture]}));
  for(const [name,clip] of Object.entries(AVATAR_ASSET.clips))avatarClips[name]={...clip,values:new Float32Array(Uint8Array.from(atob(clip.data),c=>c.charCodeAt(0)).buffer)};
  avatarCensor=mesh3D(infraBox(0,1.65,.259,.285,.145,.025,[0,0,0]));
  const g=infraBox(0,0,0,.19,.105,.07,[.045,.047,.05]);infraBox(0,.055,0,.07,.023,.055,[.08,.08,.08],g);infraBox(0,0,-.05,.065,.065,.04,[.012,.018,.022],g);cameraItemMesh=mesh3D(g);
}
function avatarMatrix(p,q){
  const n=Math.hypot(...q)||1,x=q[0]/n,y=q[1]/n,z=q[2]/n,w=q[3]/n;
  return new Float32Array([1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w),0,2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w),0,2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y),0,...p,1]);
}
function avatarSample(clip,clock,out){
  const c=avatarClips[clip],frame=(clock%c.duration)/c.duration*(c.frames-1),a=Math.floor(frame),b=Math.min(a+1,c.frames-1),t=frame-a,stride=avatarBoneCount*7;
  for(let i=0;i<avatarBoneCount;i++){
    const o=i*7,aa=a*stride+o,bb=b*stride+o;
    const dot=c.values[aa+3]*c.values[bb+3]+c.values[aa+4]*c.values[bb+4]+c.values[aa+5]*c.values[bb+5]+c.values[aa+6]*c.values[bb+6],sign=dot<0?-1:1;
    for(let k=0;k<7;k++)out[o+k]=lerp(c.values[aa+k],c.values[bb+k]*(k>=3?sign:1),t);
  }
}
function avatarAim(matrix,from,to){
  const a=norm(from),b=norm(to),v=cross(a,b),c=clamp(dot(a,b),-1,1),out=new Float32Array(matrix);
  if(c<-.9999)return out;
  for(let j=0;j<3;j++){
    const u=[matrix[j*4],matrix[j*4+1],matrix[j*4+2]],vu=cross(v,u),vvu=cross(v,vu);
    for(let k=0;k<3;k++)out[j*4+k]=u[k]+vu[k]+vvu[k]/(1+c);
  }
  return out;
}
function avatarHold(poses){
  const idx=name=>AVATAR_ASSET.bones.indexOf(name),u=idx('upperarm_r'),l=idx('lowerarm_r'),h=idx('hand_r');
  const pos=m=>[m[12],m[13],m[14]],a=pos(poses[u]),b=pos(poses[l]),c=pos(poses[h]),upper=b.map((v,k)=>v-a[k]),lower=c.map((v,k)=>v-b[k]);
  const updir=norm([.035,-.84,.54]),lowdir=norm([.02,-.12,.99]),ul=Math.hypot(...upper),ll=Math.hypot(...lower);
  poses[u]=avatarAim(poses[u],upper,updir);poses[l]=avatarAim(poses[l],lower,lowdir);poses[h]=avatarAim(poses[h],lower,lowdir);
  for(let k=0;k<3;k++){poses[l][12+k]=a[k]+updir[k]*ul;poses[h][12+k]=poses[l][12+k]+lowdir[k]*ll;}
}
function appendHazmat(p,clock){
  const distance=Math.hypot(p.x-player.x,p.z-player.z);if(distance>150)return;
  let a=avatarCache.get(p.id);if(!a){a={last:-1,pose:new Float32Array(avatarBoneCount*7),sample:new Float32Array(avatarBoneCount*7),bones:new Float32Array(32*16),matrices:[],held:false};avatarCache.set(p.id,a);}
  const speed=Math.hypot(p.vx||0,p.vz||0),clip=p.crouching?(speed>.2?'crouch':'crouchIdle'):speed>.2?(p.sprinting?'run':'walk'):'idle';
  const held=p.heldItem||'camera';
  if(clock-a.last>1/(distance>60?12:30)||a.last<0||held!==a.held){
    avatarSample(clip,clock,a.sample);
    const blend=a.last<0||clock<a.last?1:1-Math.exp(-Math.min(.1,clock-a.last)*18);
    for(let i=0;i<avatarBoneCount;i++){
      const o=i*7;let sign=1;if(a.pose[o+3]*a.sample[o+3]+a.pose[o+4]*a.sample[o+4]+a.pose[o+5]*a.sample[o+5]+a.pose[o+6]*a.sample[o+6]<0)sign=-1;
      for(let k=0;k<7;k++)a.pose[o+k]=lerp(a.pose[o+k],a.sample[o+k]*(k>=3?sign:1),blend);
      a.matrices[i]=avatarMatrix(a.pose.subarray(o,o+3),a.pose.subarray(o+3,o+7));
    }
    if(held!=='none')avatarHold(a.matrices);
    for(let i=0;i<avatarBoneCount;i++)a.bones.set(multiply(a.matrices[i],AVATAR_ASSET.inverseBind[i]),i*16);
    a.last=clock;a.held=held;
  }
  const root=multiply(transform(p.x,shedFloor(p.x,p.z),p.z),rotateY(p.yaw+Math.PI)),shadow=distance<32;
  for(const part of avatarParts)objectDraws.push({mesh:part.mesh,model:root,bones:a.bones,texture:part.texture,material:5,assetKind:5,castShadow:shadow});
  const head=AVATAR_ASSET.bones.indexOf('head');
  objectDraws.push({mesh:avatarCensor,model:multiply(root,a.bones.subarray(head*16,head*16+16)),material:5,assetKind:6,castShadow:false});
  if(held!=='none'){
    const h=a.matrices[AVATAR_ASSET.bones.indexOf('hand_r')],grip=multiply(root,multiply(transform(h[12],h[13]-.015,h[14]+.025),multiply(rotateY(Math.PI),rotateX(-p.pitch||0))));
    const mesh=held==='flashlight'?flashlightMesh:held==='soda'?sodaMesh:cameraItemMesh;
    objectDraws.push({mesh,model:grip,material:held==='camera'?0:5,assetKind:held==='flashlight'?1:2,castShadow:shadow});
  }
}
