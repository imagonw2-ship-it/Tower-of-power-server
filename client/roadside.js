let roadsideChunks=[],trafficLights=[],trafficMeshes=[],trafficTextures={},trafficPoleMesh=null,trafficCableMesh=null,trafficWrapMesh=null,trafficJunctionMesh=null;
function roadBeamMatrix(a,b,width,depth=width,reference){
  const delta=b.map((v,k)=>v-a[k]),length=Math.hypot(...delta),axis=norm(delta),right=norm(cross(axis,reference||(Math.abs(axis[1])>.95?[0,0,1]:[0,1,0]))),front=cross(right,axis);
  return new Float32Array([...right.map(v=>v*width),0,...delta,0,...front.map(v=>v*depth),0,...a,1]);
}
function addRoadBeam(g,a,b,width,depth,color){
  const unit=infraBox(0,.5,0,1,1,1,color),m=roadBeamMatrix(a,b,width,depth),base=g.positions.length/3;
  for(let i=0;i<unit.positions.length;i+=3){const p=unit.positions.slice(i,i+3);for(let k=0;k<3;k++)g.positions.push(m[12+k]+m[k]*p[0]+m[4+k]*p[1]+m[8+k]*p[2]);}
  g.colors.push(...unit.colors);g.indices.push(...unit.indices.map(i=>i+base));
  for(let i=0;i<unit.positions.length;i+=3)g.uvs.push(unit.positions[i]*.5,unit.positions[i+1]*Math.hypot(...b.map((v,k)=>v-a[k]))*.5);
}
function buildTrafficModels(){
  trafficMeshes=TRAFFIC_LIGHT_ASSET.meshes.map(p=>({...p,mesh:unpackModel(p)}));
  for(const [key,source] of Object.entries(TRAFFIC_LIGHT_ASSET.textures))trafficTextures[key]=importedTexture(source,5);
  const pole=infraGeometry();
  for(let i=0;i<10;i++){
    const a=i*Math.PI/5,b=(i+1)*Math.PI/5,color=[.32+i%3*.018,.265+i%2*.018,.185];
    infraFace(pole,[[Math.cos(a)*.5,0,Math.sin(a)*.5],[Math.cos(b)*.5,0,Math.sin(b)*.5],[Math.cos(b)*.39,1,Math.sin(b)*.39],[Math.cos(a)*.39,1,Math.sin(a)*.39]],color,[[i/10,0],[(i+1)/10,0],[(i+1)/10,3],[i/10,3]]);
  }
  infraFace(pole,Array.from({length:10},(_,i)=>[Math.cos(-i*Math.PI/5)*.39,1,Math.sin(-i*Math.PI/5)*.39]),[.41,.33,.20]);
  infraFace(pole,Array.from({length:10},(_,i)=>[Math.cos(i*Math.PI/5)*.5,0,Math.sin(i*Math.PI/5)*.5]),[.20,.17,.12]);
  trafficPoleMesh=mesh3D(pole);trafficCableMesh=mesh3D(infraBox(0,.5,0,1,1,1,[.028,.030,.024]));
  const junction=infraBox(0,0,0,.34,.24,.22,[.34,.35,.31]);infraBox(0,0,.122,.26,.14,.025,[.23,.25,.22],junction);trafficJunctionMesh=mesh3D(junction);
  // A continuous, visibly thick cable coils around each wooden pole beneath its tip.
  // Bake the loops into one mesh per pole rather than drawing every loop segment.
  const wraps=infraGeometry();let previous=null;
  for(let i=0;i<=64;i++){
    const t=i/64,a=t*Math.PI*6,p=[Math.cos(a)*.18,SIGNAL_ATTACH_HEIGHT-.14+t*.28,Math.sin(a)*.18];
    if(previous)addRoadBeam(wraps,previous,p,.045,.045,[.09,.08,.057]);previous=p;
  }
  addRoadBeam(wraps,previous,[previous[0],previous[1]-.53,previous[2]],.045,.045,[.09,.08,.057]);
  // Short alternating climbing pegs and a narrow downlead match the wooden posts.
  for(let i=0;i<7;i++){const side=i%2?1:-1,y=1.4+i*.88;addRoadBeam(wraps,[side*.18,y,0],[side*.34,y+.12,0],.045,.045,[.18,.17,.14]);}
  addRoadBeam(wraps,[0,.5,.19],[0,SIGNAL_ATTACH_HEIGHT,.165],.024,.024,[.075,.064,.043]);
  for(let i=1;i<wraps.positions.length;i+=3)wraps.positions[i]/=SIGNAL_HEIGHT;
  trafficWrapMesh=mesh3D(wraps);
}
function resetRoadside(){
  for(const c of roadsideChunks){gl.deleteVertexArray(c.mesh.vao);gl.deleteBuffer(c.mesh.buffer);gl.deleteBuffer(c.mesh.indexBuffer);}
  roadsideChunks=[];trafficLights=createTrafficLights(activeLayout,terrainHeight);
  // One draw per short fence run; no per-post draw calls.
  for(const fence of activeLayout.roadside?.fences||[]){
    const g=infraGeometry(),dx=fence.b.x-fence.a.x,dz=fence.b.z-fence.a.z,length=Math.hypot(dx,dz),count=Math.ceil(length/3.2),posts=[];
    for(let i=0;i<=count;i++){
      const x=fence.a.x+dx*i/count,z=fence.a.z+dz*i/count,y=terrainHeight(x,z),p=[x,y,z];posts.push(p);
      addRoadBeam(g,p,[x,y+fence.height,z],.15,.15,[.30,.265,.20]);
    }
    for(let i=1;i<posts.length;i++)for(const h of [.55,1.05])addRoadBeam(g,posts[i-1].map((v,k)=>v+(k===1?h:0)),posts[i].map((v,k)=>v+(k===1?h:0)),.09,.13,[.34,.30,.225]);
    roadsideChunks.push({x:(fence.a.x+fence.b.x)/2,z:(fence.a.z+fence.b.z)/2,mesh:mesh3D(g)});
  }
}
function trafficObstacles(){return[{x:shed.x,z:shed.z,r:5.4,shelter:true},...activeLayout.turbines.map(t=>({x:t.x,z:t.z,r:9}))];}
function updateTrafficLights(dt){
  if(net.active||inForest()||game.mode!=='playing')return;
  const solo={...player,id:'solo',alive:true,godMode:game.godMode,crouching:game.crouching,vx:game.vx||0,vz:game.vz||0};
  stepTrafficLights(trafficLights,dt,[solo],terrainHeight,trafficObstacles(),()=>{sound.caught();setMode('lost');if(document.pointerLockElement===canvas)document.exitPointerLock();});
}
function visibleTrafficLights(){
  if(!net.active)return trafficLights.map(s=>s.paused?{...s,phase:'red'}:s);
  const q=snapshotPair();if(!q)return[];
  return(q.b.world.trafficLights||[]).map(cur=>{
    const prev=(q.a.world.trafficLights||[]).find(s=>s.id===cur.id)||cur,s=poseBetween(prev,cur,q.t);
    if(q.t<1&&!s.paused)s.phase=prev.phase;
    for(const k of ['swingX','swingZ','headRoll','leanX','leanZ','halfSpan'])s[k]=lerp(prev[k]||0,cur[k]||0,q.t);
    s.heads=(cur.heads||[]).map((h,i)=>({swingX:lerp(prev.heads?.[i]?.swingX??h.swingX,h.swingX,q.t),swingZ:lerp(prev.heads?.[i]?.swingZ??h.swingZ,h.swingZ,q.t)}));
    return s;
  });
}
function drawSignalCable(a,b,width=.045){if(Math.hypot(...a.map((v,k)=>v-b[k]))<.001)return;objectDraws.push({mesh:trafficCableMesh,model:roadBeamMatrix(a,b,width),material:5,assetKind:13,castShadow:false,trafficCable:true});}
function appendRoadside(){
  if(isMenuScene()||inForest())return;
  for(const c of roadsideChunks)if(Math.hypot(c.x-player.x,c.z-player.z)<220)objectDraws.push({mesh:c.mesh,model:identity(),material:1,castShadow:Math.hypot(c.x-player.x,c.z-player.z)<90,roadsideFence:true});
  for(const s of visibleTrafficLights()){
    if(Math.hypot(s.x-player.x,s.z-player.z)>240)continue;
    const geo=trafficLightGeometry(s),shadow=Math.hypot(s.x-player.x,s.z-player.z)<75;
    for(let i=0;i<2;i++){
      const facing=[Math.sin(s.heading),0,Math.cos(s.heading)];
      objectDraws.push({mesh:trafficPoleMesh,model:roadBeamMatrix(s.feet[i].position,geo.tops[i],.40,.40,facing),material:1,castShadow:shadow,trafficPole:true});
      objectDraws.push({mesh:trafficWrapMesh,model:roadBeamMatrix(s.feet[i].position,geo.tops[i],1,1,facing),material:5,assetKind:13,castShadow:false,trafficWrap:true});
    }
    let previous=geo.attachments[0];
    for(let i=0;i<=24;i++){
      const p=geo.cablePoint(i/24);
      if(i)drawSignalCable(previous,p);previous=p;
    }
    for(let i=0;i<geo.heads.length;i++){
      const h=geo.heads[i],up=h.down.map(v=>-v),front=[Math.sin(s.heading),0,Math.cos(s.heading)],right=norm(cross(up,front)),facing=cross(right,up);
      const basis=new Float32Array([...right.map(v=>v*SIGNAL_HEAD_SCALE),0,...up.map(v=>v*SIGNAL_HEAD_SCALE),0,...facing.map(v=>v*SIGNAL_HEAD_SCALE),0,...h.position,1]);
      // Reuse the supplied GE mesh upright: red above amber above green.
      const head=multiply(basis,rotateZ(-Math.PI/2));
      objectDraws.push({mesh:trafficJunctionMesh,model:multiply(transform(...h.anchor),rotateY(s.heading)),material:5,assetKind:13,castShadow:shadow,trafficJunction:true});
      drawSignalCable(h.anchor,h.position.map((v,k)=>v+up[k]*SIGNAL_HEAD_SCALE*.43),.055);
      for(const p of trafficMeshes){const lens=p.kind!=='housing',on=p.kind===s.phase;objectDraws.push({mesh:p.mesh,model:head,texture:lens?trafficTextures[p.kind+(on?'':'Off')]:null,material:5,assetKind:lens?15:13,variant:lens&&on?{red:1,yellow:2,green:3}[p.kind]:0,castShadow:shadow,signalHead:s.id,signalHeadIndex:i,signalLens:lens?p.kind:null});}
    }
  }
}
