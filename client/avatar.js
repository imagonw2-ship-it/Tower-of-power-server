// Baked Mixamo poses retargeted to the uploaded hazmat. Shared meshes, 24 fps clips,
// two skin weights and distance-limited shadows keep multiplayer inexpensive.
const avatarCache=new Map();let avatarParts=[],avatarClips={},cameraItemMesh,cameraItemTexture;
const avatarBoneCount=AVATAR_ASSET.bones.length;
const headCensorRects=new Float32Array(8*4),headCensorDepths=new Float32Array(8);
let headCensorCount=0;
// All props share the same palm frame. Each origin is adjusted to its actual grip,
// rather than putting the asset's center at the wrist.
const itemGripAnchors={camera:[.059,-.003,.008],flashlight:[-.008,-.145,.005],soda:[0,.095,0]};
const itemPalm=[-.078,-.030,.002];
function itemGripMatrix(kind){
  const a=itemGripAnchors[kind]||itemGripAnchors.camera;
  return new Float32Array([0,1,0,0,0,0,1,0,1,0,0,0,itemPalm[0]-a[2],itemPalm[1]-a[0],itemPalm[2]-a[1],1]);
}
function buildAvatars(){
  const textures={};for(const [k,v] of Object.entries(AVATAR_ASSET.textures))textures[k]=importedTexture(v,5);
  avatarParts=AVATAR_ASSET.meshes.map(m=>({mesh:unpackModel(m),texture:textures[m.texture]}));
  for(const [name,clip] of Object.entries(AVATAR_ASSET.clips))avatarClips[name]={...clip,values:new Float32Array(Uint8Array.from(atob(clip.data),c=>c.charCodeAt(0)).buffer)};
  cameraItemMesh=unpackModel(CAMERA_ASSET);cameraItemTexture=importedTexture(CAMERA_ASSET.texture,5);
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
function avatarHold(poses,pitch=0){
  const idx=name=>AVATAR_ASSET.bones.indexOf(name),u=idx('upperarm_r'),l=idx('lowerarm_r'),h=idx('hand_r');
  const pos=m=>[m[12],m[13],m[14]],a=pos(poses[u]),b=pos(poses[l]),c=pos(poses[h]),upper=b.map((v,k)=>v-a[k]),lower=c.map((v,k)=>v-b[k]);
  const aim=clamp(pitch,-.75,.65),updir=norm([.035,-.84,.54]),lowdir=norm([.02,-.12+Math.sin(aim),Math.cos(aim)]),ul=Math.hypot(...upper),ll=Math.hypot(...lower);
  poses[u]=avatarAim(poses[u],upper,updir);poses[l]=avatarAim(poses[l],lower,lowdir);poses[h]=avatarAim(poses[h],lower,lowdir);
  for(let k=0;k<3;k++){poses[l][12+k]=a[k]+updir[k]*ul;poses[h][12+k]=poses[l][12+k]+lowdir[k]*ll;}
  // Thumb upward, fingers forward, palm inward. Prevent clip-specific wrist rolls
  // from turning the camera sideways when transitioning between locomotion clips.
  const hx=lowdir.map(v=>-v),hz=norm([0,1,0].map((v,k)=>v-lowdir[k]*lowdir[1])),hy=cross(hz,hx);
  for(let k=0;k<3;k++){poses[h][k]=hx[k];poses[h][4+k]=hy[k];poses[h][8+k]=hz[k];}
}
function appendHeadCensor(root,skin){
  if(headCensorCount>=8)return;
  const model=multiply(root,skin),m=multiply(viewProjection,model);
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,depth=1,visible=false;
  // Whole hood + respirator, not only the face. Bounds are in avatar bind space.
  for(const x of [-.18,.18])for(const y of [1.45,1.92])for(const z of [-.28,.27]){
    const w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<=.02)continue;
    let u=(m[0]*x+m[4]*y+m[8]*z+m[12])/w*.5+.5,v=(m[1]*x+m[5]*y+m[9]*z+m[13])/w*.5+.5;
    depth=Math.min(depth,(m[2]*x+m[6]*y+m[10]*z+m[14])/w*.5+.5);
    // Invert the lens warp, keeping the final censor rectangular in screen space.
    const qx=u-.5,qy=v-.5;let px=qx,py=qy;
    for(let j=0;j<4;j++){const f=1+(px*px+py*py)*.062*settings.vhs;px=qx/f;py=qy/f;}
    u=px+.5;v=py+.5;minX=Math.min(minX,u);maxX=Math.max(maxX,u);minY=Math.min(minY,v);maxY=Math.max(maxY,v);visible=true;
  }
  if(!visible||maxX<0||minX>1||maxY<0||minY>1)return;
  const roll=(time*.055)%1,rollPad=roll>minY-.03&&roll<maxY+.03?.016*settings.vhs:0;
  const px=(.0035*settings.vhs+rollPad)+(2.2*settings.vhs+2)/canvas.width,py=2/canvas.height;
  headCensorRects.set([minX-px,minY-py,maxX+px,maxY+py],headCensorCount*4);
  headCensorDepths[headCensorCount++]=Math.max(0,depth-.00001);
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
    if(held!=='none')avatarHold(a.matrices,p.pitch||0);
    for(let i=0;i<avatarBoneCount;i++)a.bones.set(multiply(a.matrices[i],AVATAR_ASSET.inverseBind[i]),i*16);
    a.last=clock;a.held=held;
  }
  const root=multiply(transform(p.x,shedFloor(p.x,p.z),p.z),rotateY(p.yaw+Math.PI)),shadow=distance<32;
  for(const part of avatarParts)objectDraws.push({mesh:part.mesh,model:root,bones:a.bones,texture:part.texture,material:5,assetKind:5,castShadow:shadow});
  const head=AVATAR_ASSET.bones.indexOf('head');
  appendHeadCensor(root,a.bones.subarray(head*16,head*16+16));
  if(held!=='none'&&distance<60){
    const h=a.matrices[AVATAR_ASSET.bones.indexOf('hand_r')],grip=multiply(root,multiply(h,itemGripMatrix(held)));
    const mesh=held==='flashlight'?flashlightMesh:held==='soda'?sodaMesh:cameraItemMesh;
    objectDraws.push({mesh,model:grip,material:5,texture:held==='camera'?cameraItemTexture:undefined,assetKind:held==='camera'?6:held==='flashlight'?1:2,castShadow:shadow});
  }
}
